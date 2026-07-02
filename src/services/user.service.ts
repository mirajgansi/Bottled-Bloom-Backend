import { CreateUserDTO, LoginUserDTO, UpdateUserDTO } from "../dtos/user.dto";
import { UserRepository } from "../repositories/user.repository";
import bcryptjs from "bcryptjs";
import { HttpError } from "../errors/http-error";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config";
import { sendEmail } from "../config/email";
import bcrypt from "bcryptjs";

let userRepository = new UserRepository();
type Creator = {
  id: string;
  role?: "admin" | "user" | "driver";
};

export class UserService {
  async saveFcmToken(userId: string, token: string) {
    if (!token) throw new HttpError(400, "FCM token is required");

    const user = await userRepository.getUserById(userId);
    if (!user) throw new HttpError(404, "User not found");

    const updated = await userRepository.saveFcmToken(userId, token);
    return updated;
  }
  async createUser(data: CreateUserDTO, createdBy?: Creator) {
    // business logic before creating user
    const emailCheck = await userRepository.getUserByEmail(data.email);
    if (emailCheck) {
      throw new HttpError(403, "Email already in use");
    }
    const usernameCheck = await userRepository.getUserByUsername(data.username);
    if (usernameCheck) {
      throw new HttpError(403, "Username already in use");
    }
    // hash password
    const hashedPassword = await bcryptjs.hash(data.password, 10); // 10 - complexity
    data.password = hashedPassword;

    const role =
      createdBy?.role === "admin"
        ? (data.role ?? "user") // admin can choose, default user
        : "user";
    // create user
    const payload = {
      email: data.email,
      username: data.username,
      password: hashedPassword,
      role,
      // imageUrl: data.imageUrl ?? undefined, // if you have it
    };
    const newUser = await userRepository.createUser(payload);
    return newUser;
  }

  async loginUser(data: LoginUserDTO) {
    const user = await userRepository.getUserByEmail(data.email);
    if (!user) {
      throw new HttpError(404, "User not found");
    }
    // compare password
    const validPassword = await bcryptjs.compare(data.password, user.password);
    // plaintext, hashed
    if (!validPassword) {
      throw new HttpError(401, "Invalid credentials");
    }
    // generate jwt
    const payload = {
      // user identifier
      id: user._id,
      email: user.email,
      username: user.username,
      // firstName: user.firstName,
      // lastName: user.lastName,
      role: user.role,
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" }); // 30 days
    return { token, user };
  }
  async getUserbyId(userId: string) {
    const user = await userRepository.getUserById(userId);
    if (!user) {
      throw new HttpError(404, "user not found");
    }
    return user;
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
    return updatedUser;
  }

  async sendResetPasswordEmail(email?: string) {
    if (!email) {
      throw new HttpError(400, "Email is required");
    }

    const user = await userRepository.getUserByEmail(email);
    if (!user) {
      throw new HttpError(404, "User not found");
    }

    // 6-digit reset code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Hash code using bcrypt
    const hashedCode = await bcrypt.hash(resetCode, 10);

    user.passwordResetCode = hashedCode;
    user.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 min
    await user.save();

    const html = `
    <p>Your password reset code is:</p>
    <h2 style="letter-spacing:2px">${resetCode}</h2>
    <p>This code will expire in 10 minutes.</p>
  `;

    await sendEmail(user.email, "Password Reset Code", html);

    return { message: "Reset code sent to email" };
  }

  async deleteMe(userId: string, password: string) {
    const user = await userRepository.getUserById(userId); // create if missing
    if (!user) throw new HttpError(404, "User not found");

    // if user.password is the hashed password
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) throw new HttpError(400, "Password is incorrect");

    const deleted = await userRepository.deleteUser(userId);
    if (!deleted) throw new HttpError(404, "User not found");

    return true;
  }
  //reset password token

  async resetPassword(email: string, code: string, newPassword: string) {
    const user = await userRepository.getUserByEmail(email);
    if (!user) throw new HttpError(404, "User not found");

    if (!user.passwordResetCode || !user.passwordResetExpires) {
      throw new HttpError(400, "No reset request found");
    }

    if (user.passwordResetExpires < new Date()) {
      throw new HttpError(400, "Reset code expired");
    }

    const isValid = await bcrypt.compare(code, user.passwordResetCode);
    if (!isValid) {
      throw new HttpError(400, "Invalid reset code");
    }

    // Hash new password (same as signup/login)
    user.password = await bcrypt.hash(newPassword, 12);

    // Clear reset fields
    user.passwordResetCode = undefined;
    user.passwordResetExpires = undefined;

    await user.save();

    return { message: "Password reset successful" };
  }

  // ✅ verify reset code (for ResetCodePage)
  async verifyResetPasswordCode(email: string, code: string) {
    const user = await userRepository.getUserByEmail(email);
    if (!user) throw new HttpError(404, "User not found");

    if (!user.passwordResetCode || !user.passwordResetExpires) {
      throw new HttpError(400, "No reset request found");
    }

    if (user.passwordResetExpires < new Date()) {
      throw new HttpError(400, "Reset code expired");
    }

    const isValid = await bcrypt.compare(code, user.passwordResetCode);
    if (!isValid) {
      throw new HttpError(400, "Invalid reset code");
    }

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
