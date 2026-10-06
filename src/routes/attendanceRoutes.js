import express from "express";

import {
  createAttendance,
  getAttendanceStatistics,
  getAttendanceSummary,
  getStudentAttendance,
  getTodayAttendance
} from "../controllers/attendanceController.js";

import { getStaffAttendanceSummary } from "../controllers/staffController.js";
import { getTeacherAttendanceSummary } from "../controllers/teacherController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import authorizeRoles from "../middleware/authorizeRoles.js";
import { validateCreateAttendance } from "../middleware/validation/attendanceValidation.js";


const attendanceRouter = express.Router();

attendanceRouter.post(
  "/",
  authMiddleware,
  authorizeRoles("SUPER_ADMIN", "ADMIN", "TEACHER", "STAFF"),
  validateCreateAttendance,
  createAttendance
);

attendanceRouter.get(
  "/statistics",
  authMiddleware,
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  getAttendanceStatistics
);

attendanceRouter.get(
  "/teacher/:teacher_id/summary",
  authMiddleware,
  authorizeRoles("SUPER_ADMIN", "ADMIN", "TEACHER", "STAFF"),
  getTeacherAttendanceSummary
);

attendanceRouter.get(
  "/staff/:staff_id/summary",
  authMiddleware,
  authorizeRoles("SUPER_ADMIN", "ADMIN", "STAFF"),
  getStaffAttendanceSummary
);

attendanceRouter.get(
  "/today",
  authMiddleware,
  authorizeRoles("SUPER_ADMIN", "ADMIN", "TEACHER", "STAFF"),
  getTodayAttendance
);

attendanceRouter.get(
  "/student/:student_id",
  authMiddleware,
  authorizeRoles("SUPER_ADMIN", "ADMIN", "TEACHER", "STAFF"),
  getStudentAttendance
);

attendanceRouter.get(
  "/summary",
  authMiddleware,
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  getAttendanceSummary
);


export default attendanceRouter;
