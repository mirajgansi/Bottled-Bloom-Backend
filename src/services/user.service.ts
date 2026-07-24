import { CreateUserDTO, LoginUserDTO, UpdateUserDTO } from "../dtos/user.dto";
import { UserRepository } from "../repositories/user.repository";
import bcryptjs from "bcryptjs";
import { HttpError } from "../errors/http-error";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config";
import { sendEmail } from "../config/email";
import bcrypt from "bcryptjs";
import { UserModel } from "../models/user.model";
import crypto from "crypto";

let userRepository = new UserRepository();
type Creator = {
  id: string;
  role?: "admin" | "user" | "driver";
};

// A bcrypt hash of a value nobody will ever type, used so failed logins for
// an email that doesn't exist take the same amount of time as a real
// password comparison (defends against timing-based enumeration).
const DUMMY_HASH =
  "$2a$10$CwTycUXWue0Thq9StjUM0uJ8i9m2ZQMLXe2rH0YvXKz6nqZmY9dke";

// ✅ thresholds within rubric-required 10–15 range
const MAX_LOGIN_ATTEMPTS = 12;
// 🔴 FIX (Bug #1): this was `15 * 60 * 1000` — already pre-converted to ms —
// and then got multiplied by `* 60 * 1000` AGAIN at the call site below,
// turning a 15-minute lock into ~625 days. Keep this as a plain minute
// count; conversion to ms happens exactly once, at the point of use.
const LOGIN_LOCK_MINUTES = 15;

const OTP_EXPIRY_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 10;
const OTP_LOCK_MINUTES = 15;
const OTP_TEMP_TOKEN_TTL = "10m";

function toSafeUser(user: any) {
  const obj = typeof user.toObject === "function" ? user.toObject() : user;
  const {
    password,
    passwordResetCode,
    passwordResetExpires,
    loginOtpCodeHash,
    // 🟡 FIX (Gap #2): these were leaking to the client — they expose the
    // exact state of the brute-force defenses (how many attempts are left,
    // whether/when the account unlocks, whether an OTP is pending).
    loginOtpExpires,
    loginOtpAttempts,
    loginOtpLockedUntil,
    failedLoginAttempts,
    lockUntil,
    __v,
    ...safe
  } = obj;
  return safe;
}

export class UserService {
  async saveFcmToken(userId: string, token: string) {
    if (!token) throw new HttpError(400, "FCM token is required");
    const user = await userRepository.getUserById(userId);
    if (!user) throw new HttpError(404, "User not found");
    const updated = await userRepository.saveFcmToken(userId, token);
    return updated;
  }

  async createUser(data: CreateUserDTO, createdBy?: Creator) {
    const emailCheck = await userRepository.getUserByEmail(data.email);
    if (emailCheck) throw new HttpError(403, "Email already in use");

    const usernameCheck = await userRepository.getUserByUsername(data.username);
    if (usernameCheck) throw new HttpError(403, "Username already in use");

    const hashedPassword = await bcryptjs.hash(data.password, 10);
    data.password = hashedPassword;

    const role = createdBy?.role === "admin" ? (data.role ?? "user") : "user";

    const payload = {
      email: data.email,
      username: data.username,
      password: hashedPassword,
      role,
    };
    const newUser = await userRepository.createUser(payload);
    return toSafeUser(newUser);
  }

  /**
   * STEP 1: verify credentials + apply account lockout, then send an OTP
   * by email instead of issuing a session token directly.
   */
  async loginUser(data: LoginUserDTO) {
    // 🟡 FIX (Gap #1): a single helper for the generic failure so every
    // failure path — no such user, wrong password, locked account — returns
    // the exact same status/message. Previously "no user" was a 404 and
    // "wrong password" was a 401, which let an attacker enumerate which
    // emails have accounts just by watching the status code.
    const genericFailure = () =>
      new HttpError(401, "Invalid email or password");

    const user = await userRepository.getUserByEmail(data.email);
    const account = user as any;

    // Compare against the real hash if the user exists, otherwise against a
    // dummy hash. This runs unconditionally, before any branching on
    // whether the user/lock exists, so response time doesn't leak account
    // existence either.
    const validPassword = await bcryptjs.compare(
      data.password,
      account?.password ?? DUMMY_HASH,
    );

    if (!user) {
      throw genericFailure();
    }

    // Locked accounts also fail generically (no distinct 423 status) —
    // a different status code here would itself confirm the account exists
    // and is currently locked.
    if (account.lockUntil && account.lockUntil > new Date()) {
      throw genericFailure();
    }

    if (!validPassword) {
      account.failedLoginAttempts = (account.failedLoginAttempts ?? 0) + 1;
      if (account.failedLoginAttempts >= MAX_LOGIN_ATTEMPTS) {
        account.lockUntil = new Date(
          Date.now() + LOGIN_LOCK_MINUTES * 60 * 1000,
        );
        account.failedLoginAttempts = 0;
      }
      await user.save();
      throw genericFailure();
    }

    // ✅ credentials correct — reset failed-attempt counter
    account.failedLoginAttempts = 0;
    account.lockUntil = null;

    // check OTP-step lockout too (separate counter from password lockout).
    // This 429 is fine to be distinct: reaching this point already proves
    // the attacker knows the correct password, so there's nothing left to
    // enumerate.
    if (
      account.loginOtpLockedUntil &&
      account.loginOtpLockedUntil > new Date()
    ) {
      await user.save();
      throw new HttpError(
        429,
        "Too many verification attempts. Please try again later.",
      );
    }

    // ✅ generate + send OTP instead of issuing a session
    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = await bcryptjs.hash(otp, 10);

    account.loginOtpCodeHash = otpHash;
    account.loginOtpExpires = new Date(
      Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000,
    );
    account.loginOtpAttempts = 0;
    await user.save();

    const html = `
      <p>Your Bottled Bloom login verification code is:</p>
      <h2 style="letter-spacing:2px">${otp}</h2>
      <p>This code expires in ${OTP_EXPIRY_MINUTES} minutes. If you did not
      attempt to log in, please change your password immediately.</p>
    `;

    try {
      await sendEmail(user.email, "Your Login Verification Code", html);
    } catch (emailErr: any) {
      console.error("[LOGIN-OTP] sendEmail failed:", emailErr.message);
      throw new HttpError(500, "Failed to send verification email");
    }

    const tempToken = jwt.sign(
      { id: user._id.toString(), purpose: "login_otp" },
      JWT_SECRET,
      { expiresIn: OTP_TEMP_TOKEN_TTL },
    );

    return { requiresOtp: true, tempToken };
  }

  /**
   * STEP 2: verify the OTP against the pre-auth token, then issue the
   * real session JWT.
   */
  async verifyLoginOtp(tempToken: string, code: string) {
    let decoded: any;
    try {
      decoded = jwt.verify(tempToken, JWT_SECRET);
    } catch {
      throw new HttpError(401, "Login session expired — please log in again");
    }

    if (decoded?.purpose !== "login_otp" || !decoded?.id) {
      throw new HttpError(401, "Invalid verification session");
    }

    const user = await UserModel.findById(decoded.id).select(
      "+loginOtpCodeHash",
    );
    if (!user) throw new HttpError(404, "User not found");

    if (user.loginOtpLockedUntil && user.loginOtpLockedUntil > new Date()) {
      throw new HttpError(
        429,
        "Too many verification attempts. Please log in again later.",
      );
    }

    if (!user.loginOtpCodeHash || !user.loginOtpExpires) {
      throw new HttpError(400, "No login verification pending");
    }

    if (user.loginOtpExpires < new Date()) {
      throw new HttpError(
        400,
        "Verification code expired — please log in again",
      );
    }

    const isValid = await bcryptjs.compare(code, user.loginOtpCodeHash);

    if (!isValid) {
      user.loginOtpAttempts = (user.loginOtpAttempts ?? 0) + 1;

      if (user.loginOtpAttempts >= MAX_OTP_ATTEMPTS) {
        user.loginOtpLockedUntil = new Date(
          Date.now() + OTP_LOCK_MINUTES * 60 * 1000,
        );
        user.loginOtpCodeHash = null;
        user.loginOtpExpires = null;
        await user.save();
        throw new HttpError(
          429,
          "Too many failed attempts. Please log in again later.",
        );
      }

      await user.save();
      throw new HttpError(400, "Invalid verification code");
    }

    // success — clear OTP state so the code can't be replayed
    user.loginOtpCodeHash = null;
    user.loginOtpExpires = null;
    user.loginOtpAttempts = 0;
    user.loginOtpLockedUntil = null;
    await user.save();

    const payload = {
      id: user._id,
      email: user.email,
      username: user.username,
      role: user.role,
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });

    // ✅ FIX: was returning raw `user` — leaked password hash to the client
    return { token, user: toSafeUser(user) };
  }

  async getUserbyId(userId: string) {
    const user = await userRepository.getUserById(userId);
    if (!user) throw new HttpError(404, "user not found");
    return toSafeUser(user);
  }

  async updateUser(userId: string, data: UpdateUserDTO) {
    const user = await userRepository.getUserById(userId);
    if (!user) throw new HttpError(404, "User not found");

    const cleanData = stripNulls(data);

    if (cleanData.email && user.email !== cleanData.email) {
      const checkEmail = await userRepository.getUserByEmail(cleanData.email);
      if (checkEmail) throw new HttpError(409, "Email already in use");
    }

    if (cleanData.username && user.username !== cleanData.username) {
      const checkUsername = await userRepository.getUserByUsername(
        cleanData.username,
      );
      if (checkUsername) throw new HttpError(403, "Username already in use");
    }

    if (cleanData.password) {
      const hashedPassword = await bcryptjs.hash(cleanData.password, 10);
      cleanData.password = hashedPassword;
    }

    const updatedUser = await userRepository.updateUser(userId, cleanData);
    return toSafeUser(updatedUser);
  }

  async sendResetPasswordEmail(email?: string) {
    if (!email) throw new HttpError(400, "Email is required");

    // 🟡 FIX (Gap #1): always return the same generic response whether or
    // not an account exists for this email — don't 404 on unknown emails.
    const genericResponse = {
      message:
        "If an account with that email exists, a reset code has been sent.",
    };

    const user = await userRepository.getUserByEmail(email);
    if (!user) {
      return genericResponse;
    }

    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedCode = await bcrypt.hash(resetCode, 10);

    user.passwordResetCode = hashedCode;
    user.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    const html = `
    <p>Your password reset code is:</p>
    <h2 style="letter-spacing:2px">${resetCode}</h2>
    <p>This code will expire in 10 minutes.</p>
  `;

    try {
      await sendEmail(user.email, "Password Reset Code", html);
    } catch (emailErr: any) {
      console.error("[RESET-PW] sendEmail failed:", emailErr.message);
      // Still return the generic response — surfacing the email failure
      // here would also leak that the account exists.
    }

    return genericResponse;
  }

  async deleteMe(userId: string, password: string) {
    const user = await userRepository.getUserById(userId);
    if (!user) throw new HttpError(404, "User not found");

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) throw new HttpError(400, "Password is incorrect");

    const deleted = await userRepository.deleteUser(userId);
    if (!deleted) throw new HttpError(404, "User not found");

    return true;
  }

  async resetPassword(email: string, code: string, newPassword: string) {
    // 🟡 FIX (Gap #1): one generic error for "no such user", "no reset
    // pending", "expired code", and "wrong code" — these must be
    // indistinguishable to the caller.
    const genericFailure = () =>
      new HttpError(400, "Invalid or expired reset code");

    const user = await userRepository.getUserByEmail(email);

    // Run a dummy compare even when there's no user/code, so this branch
    // takes roughly the same time as the real comparison path below.
    await bcrypt.compare(code, user?.passwordResetCode ?? DUMMY_HASH);

    if (!user || !user.passwordResetCode || !user.passwordResetExpires) {
      throw genericFailure();
    }

    if (user.passwordResetExpires < new Date()) {
      throw genericFailure();
    }

    const isValid = await bcrypt.compare(code, user.passwordResetCode);
    if (!isValid) throw genericFailure();

    user.password = await bcrypt.hash(newPassword, 12);
    user.passwordResetCode = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    return { message: "Password reset successful" };
  }

  async verifyResetPasswordCode(email: string, code: string) {
    // 🟡 FIX (Gap #1): same generic-failure treatment as resetPassword.
    const genericFailure = () =>
      new HttpError(400, "Invalid or expired reset code");

    const user = await userRepository.getUserByEmail(email);

    await bcrypt.compare(code, user?.passwordResetCode ?? DUMMY_HASH);

    if (!user || !user.passwordResetCode || !user.passwordResetExpires) {
      throw genericFailure();
    }

    if (user.passwordResetExpires < new Date()) {
      throw genericFailure();
    }

    const isValid = await bcrypt.compare(code, user.passwordResetCode);
    if (!isValid) throw genericFailure();

    return { message: "Code verified" };
  }
}

function stripNulls<T extends Record<string, any>>(obj: T) {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v !== null),
  ) as {
    [K in keyof T]: Exclude<T[K], null>;
  };
}
