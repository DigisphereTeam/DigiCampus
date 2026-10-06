import express from "express";

import {
  createExam,
  deleteExam,
  getAllExams,
  getExamById,
  updateExam,
  uploadSubjectResults,
} from "../controllers/examController.js";

import authMiddleware from "../middleware/authMiddleware.js";
import authorizeRoles from "../middleware/authorizeRoles.js";

import { getClassSectionExamMarks } from "../controllers/resultController.js";
import { validateCreateExam, validateGetAllExams, validateUpdateExam, validateUploadSubjectResults } from "../middleware/validation/examValidation.js";

const examRouter = express.Router();

examRouter.use(authMiddleware);

examRouter.post(
  "/",
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  validateCreateExam,
  createExam
);

examRouter.get(
  "/",
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN",
    "TEACHER",
    "STAFF"
  ),
  validateGetAllExams,
  getAllExams
);

examRouter.post(
  "/upload",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "TEACHER"),
  validateUploadSubjectResults,
  uploadSubjectResults
);

examRouter.get(
  "/:exam_id",
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN",
    "TEACHER",
    "STAFF"
  ),
  getExamById
);

examRouter.patch(
  "/:exam_id",
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  validateUpdateExam,
  updateExam
);

examRouter.delete(
  "/:exam_id",
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  deleteExam
);

examRouter.get(
  "/:exam_id/class/:class_id/section/:section_id/marks",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "TEACHER"),
  getClassSectionExamMarks
);

export default examRouter;