import express from "express";

import {
  createStudent,
  deleteStudent,
  getAllStudents,
  getStudentAttendanceStatistics,
  getStudentById,
  getStudentsByClassSection,
  updateStudent,
  updateStudentStatus
} from "../controllers/studentController.js";

import { USER_ROLES } from "../constants/constants.js";
import { getStudentAttendanceByDate } from "../controllers/attendanceController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import authorizeRoles from "../middleware/authorizeRoles.js";
import { validateCreateStudent, validateUpdateStudentStatus } from "../middleware/validation/studentValidation.js";

const studentRouter = express.Router();

studentRouter.use(authMiddleware);

studentRouter.post(
  "/",
  authorizeRoles(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN, USER_ROLES.ACCOUNTANT),
  validateCreateStudent,
  createStudent
);

studentRouter.get(
  "/",
  authorizeRoles(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN, USER_ROLES.ACCOUNTANT),
  getAllStudents
);

studentRouter.get(
  "/class/:class_id/section/:section_id",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "TEACHER", "STAFF"),
  getStudentsByClassSection
);

studentRouter.get(
  "/attendance",
  authorizeRoles(
    USER_ROLES.ADMIN,
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.ACCOUNTANT,
    USER_ROLES.TEACHER
  ),
  getStudentAttendanceByDate
);
studentRouter.get(
  "/attendance/statistics",
  authorizeRoles(
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.ADMIN,
    USER_ROLES.TEACHER
  ),
  getStudentAttendanceStatistics
);


studentRouter.get(
  "/:student_id",
  authorizeRoles(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN, USER_ROLES.ACCOUNTANT, USER_ROLES.TEACHER),
  getStudentById
);


studentRouter.patch(
  "/:student_id",
  authorizeRoles(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  updateStudent
);

studentRouter.patch(
  "/:student_id/status",
  authorizeRoles(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validateUpdateStudentStatus,
  updateStudentStatus,
);

studentRouter.delete(
  "/:student_id",
  authorizeRoles(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  deleteStudent
);

export default studentRouter;