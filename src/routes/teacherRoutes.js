import express from "express";
import {
  createTeacher,
  deleteTeacher,
  getTeacherAttendance,
  getTeacherById,
  getTeacherProfile,
  getTeachers,
  updateTeacher,
  updateTeacherStatus,
} from "../controllers/teacherController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import authorizeRoles from "../middleware/authorizeRoles.js";
import { validateCreateTeacher, validateUpdateTeacher } from "../middleware/validation/teacherValidation.js";

const teacherRouter = express.Router();

teacherRouter.use(authMiddleware);

teacherRouter.post("/", authorizeRoles("SUPER_ADMIN", "ADMIN"), validateCreateTeacher, createTeacher);

teacherRouter.get(
  "/attendance",
  getTeacherAttendance
);

teacherRouter.get("/", authorizeRoles("SUPER_ADMIN", "ADMIN"), getTeachers);

teacherRouter.get(
  "/:teacher_id/profile",
  getTeacherProfile
);

teacherRouter.get("/:teacher_id", authorizeRoles("SUPER_ADMIN", "ADMIN"), getTeacherById);

teacherRouter.patch("/:teacher_id", authorizeRoles("SUPER_ADMIN", "ADMIN"), validateUpdateTeacher, updateTeacher);

teacherRouter.patch(
  "/:teacher_id/status",
  updateTeacherStatus
);


teacherRouter.delete("/:teacher_id", authorizeRoles("SUPER_ADMIN", "ADMIN"), deleteTeacher);

export default teacherRouter;