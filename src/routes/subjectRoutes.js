import express from "express";

import {
  createSubject,
  getAllSubjects,
  getSubjectById,
  updateSubject,
  deleteSubject,
} from "../controllers/subjectController.js";

const subjectRouter = express.Router();

subjectRouter.post("/", createSubject);

subjectRouter.get("/", getAllSubjects);

subjectRouter.get("/:subject_id", getSubjectById);

subjectRouter.put("/:subject_id", updateSubject);

subjectRouter.delete("/:subject_id", deleteSubject);

export default subjectRouter;