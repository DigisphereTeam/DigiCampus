import express from "express";

import {
  createAssignmentSubmission,
  deleteAssignmentSubmission,
  getAssignmentSubmissionById,
  getAssignmentSubmissions,
  updateAssignmentSubmission,
} from "../controllers/assignmentSubmissionController.js";

import authMiddleware from "../middleware/authMiddleware.js";

const assignmentSubmissionRouter = express.Router();

assignmentSubmissionRouter.use(authMiddleware);

assignmentSubmissionRouter.get(
  "/:assignment_id/submissions",
  getAssignmentSubmissions
);

assignmentSubmissionRouter.post(
  "/:assignment_id/submissions",
  createAssignmentSubmission
);

assignmentSubmissionRouter.get(
  "/submissions/:submission_id",
  getAssignmentSubmissionById
);

assignmentSubmissionRouter.put(
  "/submissions/:submission_id",
  updateAssignmentSubmission
);

assignmentSubmissionRouter.delete(
  "/submissions/:submission_id",
  deleteAssignmentSubmission
);

export default assignmentSubmissionRouter;