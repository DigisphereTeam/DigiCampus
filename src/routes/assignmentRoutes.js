import express from "express";

import {
  createAssignment,
  deleteAssignment,
  getAllAssignments,
  getAssignmentById,
  updateAssignment,
} from "../controllers/assignmentController.js";

import authMiddleware from "../middleware/authMiddleware.js";
import assignmentAttachmentRouter from "./assignmentAttachmentRoutes.js";
import assignmentSubmissionRouter from "./assignmentSubmissionRoutes.js";

const assignmentRouter = express.Router();

assignmentRouter.use(authMiddleware);

assignmentRouter.get(
  "/",
  getAllAssignments
);

assignmentRouter.post(
  "/",
  createAssignment
);

assignmentRouter.get(
  "/:assignment_id",
  getAssignmentById
);

assignmentRouter.patch(
  "/:assignment_id",
  updateAssignment
);

assignmentRouter.delete(
  "/:assignment_id",
  deleteAssignment
);

assignmentRouter.use(assignmentAttachmentRouter);
assignmentRouter.use(assignmentSubmissionRouter);

export default assignmentRouter;