/* eslint-disable @typescript-eslint/no-explicit-any */

// ---- module mocks (must be top-level) ----
jest.mock("../../../repositories/user.repository", () => ({
  UserRepository: jest.fn(),
}));

jest.mock("jsonwebtoken", () => ({
  sign: jest.fn(),
}));

jest.mock("../../../config/email", () => ({
  sendEmail: jest.fn(),
}));

jest.mock("bcryptjs", () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

function makeUser(overrides: any = {}) {
  return {
    _id: "u1",
    email: "a@b.com",
    username: "miraj",
    password: "hashed-pass",
    role: "user",
    passwordResetCode: undefined,
    passwordResetExpires: undefined,
    save: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

describe("UserService", () => {
  let service: any;
  let repo: any;

  // fresh mocks (avoid stale imports after resetModules)
  let bcryptjs: any;
  let jwt: any;
  let sendEmail: any;
  let repoModule: any;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    // get fresh mocks AFTER resetModules
    bcryptjs = jest.requireMock("bcryptjs");
    jwt = jest.requireMock("jsonwebtoken");
    ({ sendEmail } = jest.requireMock("../../../config/email"));
    repoModule = jest.requireMock("../../../repositories/user.repository");

    repo = {
      getUserById: jest.fn(),
      getUserByEmail: jest.fn(),
      getUserByUsername: jest.fn(),
      saveFcmToken: jest.fn(),
      createUser: jest.fn(),
      updateUser: jest.fn(),
      deleteUser: jest.fn(),
    };

    // make module-scope `new UserRepository()` return our repo
    repoModule.UserRepository.mockImplementation(() => repo);

    // now load service (module-scope userRepository gets our repo)
    const { UserService } = require("../../../services/user.service");
    service = new UserService();
  });

  // ---------------- saveFcmToken ----------------
  describe("saveFcmToken", () => {
    it("throws 400 if token missing", async () => {
      await expect(service.saveFcmToken("u1", "")).rejects.toMatchObject({
        statusCode: 400,
      });
      expect(repo.getUserById).not.toHaveBeenCalled();
      expect(repo.saveFcmToken).not.toHaveBeenCalled();
    });

    it("throws 404 if user not found", async () => {
      repo.getUserById.mockResolvedValue(null);

      await expect(service.saveFcmToken("u1", "abc")).rejects.toMatchObject({
        statusCode: 404,
      });

      expect(repo.getUserById).toHaveBeenCalledWith("u1");
      expect(repo.saveFcmToken).not.toHaveBeenCalled();
    });

    it("saves token and returns updated user", async () => {
      repo.getUserById.mockResolvedValue(makeUser());
      repo.saveFcmToken.mockResolvedValue({ fcmToken: "abc" });

      const res = await service.saveFcmToken("u1", "abc");

      expect(repo.saveFcmToken).toHaveBeenCalledWith("u1", "abc");
      expect(res).toEqual({ fcmToken: "abc" });
    });
  });

  // ---------------- createUser ----------------
  describe("createUser", () => {
    it("throws 403 if email already in use", async () => {
      repo.getUserByEmail.mockResolvedValue(makeUser());

      await expect(
        service.createUser({ email: "a@b.com", username: "x", password: "p" }),
      ).rejects.toMatchObject({ statusCode: 403 });

      expect(repo.getUserByEmail).toHaveBeenCalledWith("a@b.com");
      expect(repo.getUserByUsername).not.toHaveBeenCalled();
      expect(repo.createUser).not.toHaveBeenCalled();
    });

    it("throws 403 if username already in use", async () => {
      repo.getUserByEmail.mockResolvedValue(null);
      repo.getUserByUsername.mockResolvedValue(makeUser());

      await expect(
        service.createUser({
          email: "x@b.com",
          username: "miraj",
          password: "p",
        }),
      ).rejects.toMatchObject({ statusCode: 403 });

      expect(repo.getUserByUsername).toHaveBeenCalledWith("miraj");
      expect(repo.createUser).not.toHaveBeenCalled();
    });

    it("hashes password, non-admin forces role=user", async () => {
      repo.getUserByEmail.mockResolvedValue(null);
      repo.getUserByUsername.mockResolvedValue(null);

      bcryptjs.hash.mockResolvedValue("hashed123");
      repo.createUser.mockResolvedValue({ _id: "u2" });

      const data: any = {
        email: "x@b.com",
        username: "u",
        password: "plain",
        role: "admin",
      };

      const res = await service.createUser(data, { id: "c1", role: "user" });

      expect(bcryptjs.hash).toHaveBeenCalledWith("plain", 10);
      expect(repo.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "x@b.com",
          username: "u",
          password: "hashed123",
          role: "user",
        }),
      );
      expect(res).toEqual({ _id: "u2" });
    });

    it("admin creator can set role, default user if role not provided", async () => {
      repo.getUserByEmail.mockResolvedValue(null);
      repo.getUserByUsername.mockResolvedValue(null);

      bcryptjs.hash.mockResolvedValue("hashed123");
      repo.createUser.mockResolvedValue({ _id: "u3" });

      // can set role
      await service.createUser(
        {
          email: "x@b.com",
          username: "u",
          password: "plain",
          role: "driver",
        } as any,
        { id: "admin1", role: "admin" },
      );

      expect(repo.createUser).toHaveBeenCalledWith(
        expect.objectContaining({ role: "driver" }),
      );

      // defaults to user if role missing in data
      repo.createUser.mockClear();
      await service.createUser(
        { email: "y@b.com", username: "u2", password: "plain" } as any,
        { id: "admin1", role: "admin" },
      );

      expect(repo.createUser).toHaveBeenCalledWith(
        expect.objectContaining({ role: "user" }),
      );
    });
  });

  // ---------------- loginUser ----------------
  describe("loginUser", () => {
    it("throws 404 if user not found", async () => {
      repo.getUserByEmail.mockResolvedValue(null);

      await expect(
        service.loginUser({ email: "none@b.com", password: "x" }),
      ).rejects.toMatchObject({ statusCode: 404 });

      expect(repo.getUserByEmail).toHaveBeenCalledWith("none@b.com");
    });

    it("throws 401 if password invalid", async () => {
      repo.getUserByEmail.mockResolvedValue(makeUser());
      bcryptjs.compare.mockResolvedValue(false);

      await expect(
        service.loginUser({ email: "a@b.com", password: "bad" }),
      ).rejects.toMatchObject({ statusCode: 401 });

      expect(bcryptjs.compare).toHaveBeenCalled();
      expect(jwt.sign).not.toHaveBeenCalled();
    });

    it("returns token + user when valid", async () => {
      const user = makeUser({ role: "user" });
      repo.getUserByEmail.mockResolvedValue(user);

      bcryptjs.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue("jwt-token");

      const res = await service.loginUser({ email: "a@b.com", password: "ok" });

      expect(jwt.sign).toHaveBeenCalled();
      expect(res).toEqual({ token: "jwt-token", user });
    });
  });

  // ---------------- getUserbyId ----------------
  describe("getUserbyId", () => {
    it("throws 404 if not found", async () => {
      repo.getUserById.mockResolvedValue(null);

      await expect(service.getUserbyId("u1")).rejects.toMatchObject({
        statusCode: 404,
      });

      expect(repo.getUserById).toHaveBeenCalledWith("u1");
    });

    it("returns user when found", async () => {
      const user = makeUser();
      repo.getUserById.mockResolvedValue(user);

      const res = await service.getUserbyId("u1");
      expect(res).toBe(user);
    });
  });

  // ---------------- updateUser ----------------
  describe("updateUser", () => {
    it("throws 404 if user not found", async () => {
      repo.getUserById.mockResolvedValue(null);

      await expect(
        service.updateUser("u1", { email: "x" }),
      ).rejects.toMatchObject({
        statusCode: 404,
      });

      expect(repo.updateUser).not.toHaveBeenCalled();
    });

    it("checks email uniqueness when email changes", async () => {
      const user = makeUser({ email: "old@b.com" });
      repo.getUserById.mockResolvedValue(user);
      repo.getUserByEmail.mockResolvedValue(makeUser({ _id: "other" }));

      await expect(
        service.updateUser("u1", { email: "new@b.com" }),
      ).rejects.toMatchObject({
        statusCode: 409,
      });
    });

    it("checks username uniqueness when username changes", async () => {
      const user = makeUser({ username: "old" });
      repo.getUserById.mockResolvedValue(user);
      repo.getUserByEmail.mockResolvedValue(null);
      repo.getUserByUsername.mockResolvedValue(makeUser({ _id: "other" }));

      await expect(
        service.updateUser("u1", { username: "new" }),
      ).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it("hashes password if provided and updates", async () => {
      repo.getUserById.mockResolvedValue(makeUser());
      repo.getUserByEmail.mockResolvedValue(null);
      repo.getUserByUsername.mockResolvedValue(null);

      bcryptjs.hash.mockResolvedValue("hashed-new");
      repo.updateUser.mockResolvedValue({ _id: "u1", password: "hashed-new" });

      const res = await service.updateUser("u1", { password: "plain" });

      expect(bcryptjs.hash).toHaveBeenCalledWith("plain", 10);
      expect(repo.updateUser).toHaveBeenCalledWith(
        "u1",
        expect.objectContaining({ password: "hashed-new" }),
      );
      expect(res).toEqual({ _id: "u1", password: "hashed-new" });
    });

    it("stripNulls removes null fields (email=null not passed)", async () => {
      repo.getUserById.mockResolvedValue(makeUser());
      repo.updateUser.mockResolvedValue({ ok: true });

      await service.updateUser("u1", { email: null, username: "x" });

      const passed = repo.updateUser.mock.calls[0][1];
      expect(passed).toEqual({ username: "x" });
    });
  });

  // ---------------- sendResetPasswordEmail ----------------
  describe("sendResetPasswordEmail", () => {
    it("throws 400 if email missing", async () => {
      await expect(
        service.sendResetPasswordEmail(undefined),
      ).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it("throws 404 if user not found", async () => {
      repo.getUserByEmail.mockResolvedValue(null);

      await expect(
        service.sendResetPasswordEmail("x@b.com"),
      ).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it("sets reset fields, saves user, sends email", async () => {
      const user = makeUser();
      repo.getUserByEmail.mockResolvedValue(user);

      bcryptjs.hash.mockResolvedValue("hashed-code");
      sendEmail.mockResolvedValue(true);

      const res = await service.sendResetPasswordEmail("a@b.com");

      expect(bcryptjs.hash).toHaveBeenCalled(); // called with (resetCode, 10)
      expect(user.save).toHaveBeenCalled();
      expect(sendEmail).toHaveBeenCalledWith(
        "a@b.com",
        "Password Reset Code",
        expect.stringContaining("Your password reset code is"),
      );
      expect(res).toEqual({ message: "Reset code sent to email" });

      expect(user.passwordResetCode).toBe("hashed-code");
      expect(user.passwordResetExpires).toBeInstanceOf(Date);
    });
  });

  // ---------------- deleteMe ----------------
  describe("deleteMe", () => {
    it("throws 404 if user not found", async () => {
      repo.getUserById.mockResolvedValue(null);

      await expect(service.deleteMe("u1", "p")).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it("throws 400 if password incorrect", async () => {
      repo.getUserById.mockResolvedValue(makeUser());
      bcryptjs.compare.mockResolvedValue(false);

      await expect(service.deleteMe("u1", "wrong")).rejects.toMatchObject({
        statusCode: 400,
      });

      expect(repo.deleteUser).not.toHaveBeenCalled();
    });

    it("throws 404 if delete fails", async () => {
      repo.getUserById.mockResolvedValue(makeUser());
      bcryptjs.compare.mockResolvedValue(true);
      repo.deleteUser.mockResolvedValue(false);

      await expect(service.deleteMe("u1", "ok")).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it("returns true when deleted", async () => {
      repo.getUserById.mockResolvedValue(makeUser());
      bcryptjs.compare.mockResolvedValue(true);
      repo.deleteUser.mockResolvedValue(true);

      const res = await service.deleteMe("u1", "ok");
      expect(res).toBe(true);
    });
  });

  // ---------------- resetPassword ----------------
  describe("resetPassword", () => {
    it("404 if user not found", async () => {
      repo.getUserByEmail.mockResolvedValue(null);

      await expect(
        service.resetPassword("x@b.com", "123", "new"),
      ).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it("400 if no reset request fields", async () => {
      repo.getUserByEmail.mockResolvedValue(
        makeUser({
          passwordResetCode: undefined,
          passwordResetExpires: undefined,
        }),
      );

      await expect(
        service.resetPassword("a@b.com", "123", "new"),
      ).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it("400 if reset expired", async () => {
      repo.getUserByEmail.mockResolvedValue(
        makeUser({
          passwordResetCode: "hashed-code",
          passwordResetExpires: new Date(Date.now() - 1000),
        }),
      );

      await expect(
        service.resetPassword("a@b.com", "123", "new"),
      ).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it("400 if invalid reset code", async () => {
      repo.getUserByEmail.mockResolvedValue(
        makeUser({
          passwordResetCode: "hashed-code",
          passwordResetExpires: new Date(Date.now() + 100000),
        }),
      );

      bcryptjs.compare.mockResolvedValue(false);

      await expect(
        service.resetPassword("a@b.com", "bad", "new"),
      ).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it("resets password and clears reset fields", async () => {
      const user = makeUser({
        passwordResetCode: "hashed-code",
        passwordResetExpires: new Date(Date.now() + 100000),
      });
      repo.getUserByEmail.mockResolvedValue(user);

      bcryptjs.compare.mockResolvedValue(true);
      bcryptjs.hash.mockResolvedValue("new-hash");

      const res = await service.resetPassword("a@b.com", "123", "newPass");

      expect(bcryptjs.hash).toHaveBeenCalledWith("newPass", 12);
      expect(user.password).toBe("new-hash");
      expect(user.passwordResetCode).toBeUndefined();
      expect(user.passwordResetExpires).toBeUndefined();
      expect(user.save).toHaveBeenCalled();

      expect(res).toEqual({ message: "Password reset successful" });
    });
  });

  // ---------------- verifyResetPasswordCode ----------------
  describe("verifyResetPasswordCode", () => {
    it("400 if invalid code", async () => {
      const user = makeUser({
        passwordResetCode: "hashed-code",
        passwordResetExpires: new Date(Date.now() + 100000),
      });
      repo.getUserByEmail.mockResolvedValue(user);

      bcryptjs.compare.mockResolvedValue(false);

      await expect(
        service.verifyResetPasswordCode("a@b.com", "bad"),
      ).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it("returns message when verified", async () => {
      const user = makeUser({
        passwordResetCode: "hashed-code",
        passwordResetExpires: new Date(Date.now() + 100000),
      });
      repo.getUserByEmail.mockResolvedValue(user);

      bcryptjs.compare.mockResolvedValue(true);

      const res = await service.verifyResetPasswordCode("a@b.com", "123");
      expect(res).toEqual({ message: "Code verified" });
    });
  });
});
