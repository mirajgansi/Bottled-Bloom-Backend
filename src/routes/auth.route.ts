import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import { authorizedMiddleware } from "../middleware/authorized.middleware";
import { uploads } from "../middleware/upload.middleware";
let authController = new AuthController();
const router = Router();

router.post("/register", authController.register);
router.post("/login", authController.login);
// add remaning routes like login, logout, etc.
router.get("/whoamI", authorizedMiddleware, authController.getUserbyId);

router.put(
  "/update-profile",
  authorizedMiddleware, //should be logined
  uploads.single("image"),
  authController.updateUser,
);
router.delete("/me", authorizedMiddleware, authController.deleteMe);
router.post("/verify-reset-code", authController.verifyResetPasswordCode);

router.post("/request-password-reset", authController.requestPasswordChange);
router.get("/me/fcm-token", authorizedMiddleware, authController.getFcmToken);
router.post("/reset-password", authController.resetPassword);
router.post("/me/fcm-token", authorizedMiddleware, authController.saveFcmToken);
export default router;
