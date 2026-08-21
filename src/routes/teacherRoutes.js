import express from "express";

import {
  changeTeacherPassword,
  getTeacherClasses,
  getTeacherProfile,
  updateTeacherProfile
} from "../controllers/teacherController.js";

import authMiddleware from "../middleware/authMiddleware.js";
import authorizeRoles from "../middleware/authorizeRoles.js";

const teacherRouter = express.Router();

teacherRouter.get(
  "/profile",
  authMiddleware,
  authorizeRoles("TEACHER"),
  getTeacherProfile
);

teacherRouter.patch(
  "/profile",
  authMiddleware,
  authorizeRoles("TEACHER"),
  updateTeacherProfile
);

teacherRouter.patch(
  "/change-password",
  authMiddleware,
  authorizeRoles("TEACHER"),
  changeTeacherPassword
);

teacherRouter.get(
  "/classes",
  authMiddleware,
  authorizeRoles("TEACHER"),
  getTeacherClasses
);

export default teacherRouter;

