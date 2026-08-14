import express from "express";

import {
  createUser,
  deleteUser,
  getAllUsers,
  getUserById,
  updateUser,
} from "../controllers/userController.js";

import authMiddleware from "../middleware/authMiddleware.js";
import authorizeRoles from "../middleware/authorizeRoles.js";

const userRouter = express.Router();

userRouter.use(authMiddleware);

userRouter.get(
  "/",
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  getAllUsers
);

userRouter.get(
  "/:user_id",
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  getUserById
);

userRouter.post(
  "/",
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  createUser
);

userRouter.patch(
  "/:user_id",
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  updateUser
);

userRouter.delete(
  "/:user_id",
  authorizeRoles("SUPER_ADMIN"),
  deleteUser
);

export default userRouter;