import express from "express";

import {
  createUser,
  deactivateUser,
  getAllUsers,
  getUserById,
  updateUser,
} from "../controllers/userController.js";

import authMiddleware from "../middleware/authMiddleware.js";
import authorizeRoles from "../middleware/authorizeRoles.js";
import { validateCreateUser } from "../middleware/validation/userValidation.js";

const userRouter = express.Router();

userRouter.use(authMiddleware);

userRouter.post(
  "/",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "ACCOUNTANT"),
  validateCreateUser,
  createUser,
);

userRouter.get("/", authorizeRoles("SUPER_ADMIN", "ADMIN"), getAllUsers);

userRouter.get(
  "/:user_id",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "ACCOUNTANT"),
  getUserById,
);

userRouter.patch(
  "/:user_id",
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  updateUser,
);

userRouter.delete(
  "/:user_id",
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  deactivateUser,
);

export default userRouter;
