import express from "express";

import {
  createAssignmentAttachment,
  deleteAssignmentAttachment,
  getAssignmentAttachments,
} from "../controllers/assignmentAttachmentController.js";

import authMiddleware from "../middleware/authMiddleware.js";

const assignmentAttachmentRouter = express.Router();

assignmentAttachmentRouter.use(authMiddleware);

assignmentAttachmentRouter.get(
  "/:assignment_id/attachments",
  getAssignmentAttachments
);

assignmentAttachmentRouter.post(
  "/:assignment_id/attachments",
  createAssignmentAttachment
);

assignmentAttachmentRouter.delete(
  "/attachments/:attachment_id",
  deleteAssignmentAttachment
);

export default assignmentAttachmentRouter;