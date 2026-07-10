import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import { authorizedMiddleware } from "../middleware/authorized.middleware";
import { uploads } from "../middleware/upload.middleware";
import {
  authLimiter,
  resetCodeLimiter,
  otpVerifyLimiter,
} from "../middleware/ratelimit.middleware";
let authController = new AuthController();
const router = Router();

router.post("/register", authLimiter, authController.register);
router.post("/login", authLimiter, authController.login);
// add remaning routes like login, logout, etc.
router.get("/whoamI", authorizedMiddleware, authController.getUserbyId);

router.put(
  "/update-profile",
  authorizedMiddleware, //should be logined
  uploads.single("image"),
  authController.updateUser,
);
router.delete("/me", authorizedMiddleware, authController.deleteMe);
router.post(
  "/verify-reset-code",
  resetCodeLimiter,
  authController.verifyResetPasswordCode,
);
router.post(
  "/verify-login-otp",
  otpVerifyLimiter,
  authController.verifyLoginOtp,
);
router.post(
  "/request-password-reset",
  resetCodeLimiter,
  authController.requestPasswordChange,
);
router.get("/me/fcm-token", authorizedMiddleware, authController.getFcmToken);
router.post("/reset-password", resetCodeLimiter, authController.resetPassword);
router.post("/me/fcm-token", authorizedMiddleware, authController.saveFcmToken);
export default router;
