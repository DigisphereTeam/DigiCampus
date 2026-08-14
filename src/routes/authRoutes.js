import express from "express";

import {
  changePassword,
  getMe,
  login,
} from "../controllers/authController.js";

import authMiddleware from "../middleware/authMiddleware.js";

const authRouter = express.Router();

authRouter.post("/login", login);

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