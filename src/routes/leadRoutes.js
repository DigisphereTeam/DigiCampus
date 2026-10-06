import express from "express";

import {
  convertLeadToStudent,
  createLead,
  deleteLead,
  getAllLeads,
  getLeadById,
  updateLead,
  updateLeadStatus,
} from "../controllers/leadController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { validateConvertLead, validateCreateLead, validateUpdateLead, validateUpdateLeadStatus } from "../middleware/validation/leadValidation.js";

const leadRouter = express.Router();

leadRouter.use(authMiddleware);

leadRouter.post(
  "/",
  validateCreateLead,
  createLead
);

leadRouter.get(
  "/",
  getAllLeads
);

leadRouter.get(
  "/:lead_id",
  getLeadById
);

leadRouter.patch(
  "/:lead_id",
  validateUpdateLead,
  updateLead
);

leadRouter.patch(
  "/:lead_id/status",
  validateUpdateLeadStatus,
  updateLeadStatus
);

leadRouter.post(
  "/:lead_id/convert",
  validateConvertLead,
  convertLeadToStudent
);

leadRouter.delete(
  "/:lead_id",
  deleteLead
);

export default leadRouter;