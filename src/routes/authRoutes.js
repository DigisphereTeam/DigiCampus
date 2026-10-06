import express from "express";

import {
  changePassword,
  getMe,
  login,
} from "../controllers/authController.js";

import authMiddleware from "../middleware/authMiddleware.js";
import { validateLogin } from "../middleware/validation/authValidation.js";

const authRouter = express.Router();

authRouter.post(
  "/login",
  validateLogin,
  login
);

authRouter.get(
  "/me",
  authMiddleware,
  getMe
);

authRouter.put(
  "/password",
  authMiddleware,
  changePassword
);

export default authRouter;