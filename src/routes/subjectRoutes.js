import express from "express";
import {
  createBulkSubjects,
  createSubject,
  deleteSubject,
  getSubjectById,
  getSubjects,
  updateSubject,
} from "../controllers/subjectController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  validateBulkCreateSubject,
  validateCreateSubject,
  validateUpdateSubject,
} from "../middleware/validation/subjectValidation.js";

const subjectRouter = express.Router();

subjectRouter.post(
  "/bulk",
  authMiddleware,
  validateBulkCreateSubject,
  createBulkSubjects,
);

subjectRouter.post("/", authMiddleware, validateCreateSubject, createSubject);

subjectRouter.get("/", authMiddleware, getSubjects);

subjectRouter.get("/:subject_id", authMiddleware, getSubjectById);

subjectRouter.patch(
  "/:subject_id",
  authMiddleware,
  validateUpdateSubject,
  updateSubject,
);

subjectRouter.delete("/:subject_id", authMiddleware, deleteSubject);

export default subjectRouter;
