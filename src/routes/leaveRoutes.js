import express from "express";

import {
  cancelLeave,
  createLeave,
  deleteLeave,
  getLeaveById,
  getLeaves,
  updateLeave,
  updateLeaveStatus,
} from "../controllers/leaveController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { validateCreateLeave } from "../middleware/validation/leaveValidation.js";

const leaveRouter = express.Router();

leaveRouter.post("/", authMiddleware, validateCreateLeave, createLeave);

leaveRouter.get("/", authMiddleware, getLeaves);

leaveRouter.get("/:leave_id", authMiddleware, getLeaveById);

leaveRouter.put("/:leave_id", authMiddleware, updateLeave);

leaveRouter.patch("/:leave_id/status", authMiddleware, updateLeaveStatus);

leaveRouter.patch("/:leave_id/cancel", authMiddleware, cancelLeave);

leaveRouter.delete("/:leave_id", authMiddleware, deleteLeave);

export default leaveRouter;
