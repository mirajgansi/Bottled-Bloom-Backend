import { AuthController } from "../../../controllers/auth.controller";
import { UserService } from "../../../services/user.service";
import {
  CreateUserDTO,
  LoginUserDTO,
  SaveFcmTokenDTO,
  UpdateProfileDTO,
  UpdateUserDTO,
} from "../../../dtos/user.dto";

function mockRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}
function mockReq(overrides: any = {}) {
  return { body: {}, params: {}, query: {}, ...overrides } as any;
}

describe("AuthController", () => {
  let controller: AuthController;

  let createUserSpy: jest.SpyInstance;
  let loginUserSpy: jest.SpyInstance;
  let saveFcmTokenSpy: jest.SpyInstance;
  let getUserbyIdSpy: jest.SpyInstance;
  let updateUserSpy: jest.SpyInstance;
  let sendResetPasswordEmailSpy: jest.SpyInstance;
  let deleteMeSpy: jest.SpyInstance;
  let resetPasswordSpy: jest.SpyInstance;
  let verifyResetPasswordCodeSpy: jest.SpyInstance;

  beforeEach(() => {
    controller = new AuthController();

    createUserSpy = jest.spyOn(UserService.prototype as any, "createUser");
    loginUserSpy = jest.spyOn(UserService.prototype as any, "loginUser");
    saveFcmTokenSpy = jest.spyOn(UserService.prototype as any, "saveFcmToken");
    getUserbyIdSpy = jest.spyOn(UserService.prototype as any, "getUserbyId");
    updateUserSpy = jest.spyOn(UserService.prototype as any, "updateUser");
    sendResetPasswordEmailSpy = jest.spyOn(
      UserService.prototype as any,
      "sendResetPasswordEmail",
    );
    deleteMeSpy = jest.spyOn(UserService.prototype as any, "deleteMe");
    resetPasswordSpy = jest.spyOn(
      UserService.prototype as any,
      "resetPassword",
    );
    verifyResetPasswordCodeSpy = jest.spyOn(
      UserService.prototype as any,
      "verifyResetPasswordCode",
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("register", () => {
    it("returns 201 when user created", async () => {
      const req = mockReq({
        body: { name: "A", email: "a@b.com", password: "Pass1234" },
      });
      const res = mockRes();

      // ✅ Force DTO to pass (so we test controller flow, not DTO rules)
      jest
        .spyOn(CreateUserDTO, "safeParse")
        .mockReturnValue({ success: true, data: req.body } as any);

      createUserSpy.mockResolvedValue({
        _id: "u1",
        email: "a@b.com",
        role: "user",
      });

      await controller.register(req as any, res as any);

      expect(createUserSpy).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it("returns 400 when validation fails", async () => {
      const req = mockReq({ body: {} });
      const res = mockRes();

      jest
        .spyOn(CreateUserDTO, "safeParse")
        .mockReturnValue({ success: false, error: {} } as any);

      await controller.register(req as any, res as any);

      expect(createUserSpy).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("returns error.statusCode when service throws", async () => {
      const req = mockReq({
        body: { name: "A", email: "a@b.com", password: "Pass1234" },
      });
      const res = mockRes();

      jest
        .spyOn(CreateUserDTO, "safeParse")
        .mockReturnValue({ success: true, data: req.body } as any);

      const err: any = new Error("Conflict");
      err.statusCode = 409;
      createUserSpy.mockRejectedValue(err);

      await controller.register(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(409);
    });
  });

  describe("login", () => {
    it("returns 200 with token + user", async () => {
      const req = mockReq({ body: { email: "a@b.com", password: "Pass1234" } });
      const res = mockRes();

      jest
        .spyOn(LoginUserDTO, "safeParse")
        .mockReturnValue({ success: true, data: req.body } as any);

      loginUserSpy.mockResolvedValue({
        token: "jwt-token",
        user: { _id: "u1", email: "a@b.com" },
      });

      await controller.login(req as any, res as any);

      expect(loginUserSpy).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("returns 400 when LoginUserDTO validation fails", async () => {
      const req = mockReq({ body: {} });
      const res = mockRes();

      jest
        .spyOn(LoginUserDTO, "safeParse")
        .mockReturnValue({ success: false, error: {} } as any);

      await controller.login(req as any, res as any);

      expect(loginUserSpy).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe("saveFcmToken", () => {
    it("401 if no req.user (body must be valid)", async () => {
      const req = mockReq({ body: { token: "abc" }, user: undefined });
      const res = mockRes();

      jest
        .spyOn(SaveFcmTokenDTO, "safeParse")
        .mockReturnValue({ success: true, data: req.body } as any);

      await controller.saveFcmToken(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("200 if token saved", async () => {
      const req = mockReq({ body: { token: "abc" }, user: { _id: "u1" } });
      const res = mockRes();

      jest
        .spyOn(SaveFcmTokenDTO, "safeParse")
        .mockReturnValue({ success: true, data: req.body } as any);

      saveFcmTokenSpy.mockResolvedValue({ fcmToken: "abc" });

      await controller.saveFcmToken(req as any, res as any);

      expect(saveFcmTokenSpy).toHaveBeenCalledWith("u1", "abc");
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("404 if user not found", async () => {
      const req = mockReq({ body: { token: "abc" }, user: { _id: "u1" } });
      const res = mockRes();

      jest
        .spyOn(SaveFcmTokenDTO, "safeParse")
        .mockReturnValue({ success: true, data: req.body } as any);

      saveFcmTokenSpy.mockResolvedValue(null);

      await controller.saveFcmToken(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe("getFcmToken", () => {
    it("200 returns token", async () => {
      const req = mockReq({ user: { _id: "u1" } });
      const res = mockRes();

      getUserbyIdSpy.mockResolvedValue({ fcmToken: "xyz" });

      await controller.getFcmToken(req as any, res as any);

      expect(getUserbyIdSpy).toHaveBeenCalledWith("u1");
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("getUserbyId", () => {
    it("200 returns user", async () => {
      const req = mockReq({ user: { _id: "u1" } });
      const res = mockRes();

      getUserbyIdSpy.mockResolvedValue({ _id: "u1", email: "a@b.com" });

      await controller.getUserbyId(req as any, res as any);

      expect(getUserbyIdSpy).toHaveBeenCalledWith("u1");
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("updateUser", () => {
    it("adds image path if req.file exists and returns 200", async () => {
      const req = mockReq({
        user: { _id: "u1" },
        body: { name: "New" },
        file: { filename: "pic.png" },
      });
      const res = mockRes();

      jest
        .spyOn(UpdateProfileDTO, "safeParse")
        .mockReturnValue({ success: true, data: { ...req.body } } as any);

      updateUserSpy.mockResolvedValue({ _id: "u1", image: "/uploads/pic.png" });

      await controller.updateUser(req as any, res as any);

      expect(updateUserSpy).toHaveBeenCalledWith(
        "u1",
        expect.objectContaining({ image: "/uploads/pic.png" }),
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("requestPasswordChange", () => {
    it("200 if email sent", async () => {
      const req = mockReq({ body: { email: "a@b.com" } });
      const res = mockRes();

      sendResetPasswordEmailSpy.mockResolvedValue(undefined);

      await controller.requestPasswordChange(req as any, res as any);

      expect(sendResetPasswordEmailSpy).toHaveBeenCalledWith("a@b.com");
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("deleteMe", () => {
    it("200 if deleted", async () => {
      const req = mockReq({
        user: { _id: "u1" },
        body: { password: "Pass1234" },
      });
      const res = mockRes();

      deleteMeSpy.mockResolvedValue(undefined);

      await controller.deleteMe(req as any, res as any);

      expect(deleteMeSpy).toHaveBeenCalledWith("u1", "Pass1234");
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("resetPassword", () => {
    it("200 if reset done", async () => {
      const req = mockReq({
        body: { email: "a@b.com", code: "1234", newPassword: "Pass1234" },
      });
      const res = mockRes();

      // controller uses UpdateUserDTO.pick({ password: true }).safeParse(...)
      jest
        .spyOn(UpdateUserDTO.pick({ password: true }), "safeParse")
        .mockReturnValue({
          success: true,
          data: { password: "Pass1234" },
        } as any);

      resetPasswordSpy.mockResolvedValue(undefined);

      await controller.resetPassword(req as any, res as any);

      expect(resetPasswordSpy).toHaveBeenCalledWith(
        "a@b.com",
        "1234",
        "Pass1234",
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("verifyResetPasswordCode", () => {
    it("200 if verified", async () => {
      const req = mockReq({ body: { email: "a@b.com", code: "1234" } });
      const res = mockRes();

      verifyResetPasswordCodeSpy.mockResolvedValue({
        message: "Code verified",
      });

      await controller.verifyResetPasswordCode(req as any, res as any);

      expect(verifyResetPasswordCodeSpy).toHaveBeenCalledWith(
        "a@b.com",
        "1234",
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
