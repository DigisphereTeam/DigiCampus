import express from "express";
import {
  createStaff,
  deleteStaff,
  getStaff,
  getStaffAttendance,
  getStaffById,
  getStaffProfile,
  updateStaff,
  updateStaffStatus,
} from "../controllers/staffController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import authorizeRoles from "../middleware/authorizeRoles.js";
import { validateCreateStaff, validateUpdateStaff } from "../middleware/validation/staffValidation.js";

const staffRouter = express.Router();

staffRouter.use(
  authMiddleware,
  authorizeRoles("SUPER_ADMIN", "ADMIN")
);

staffRouter.post("/", validateCreateStaff, createStaff);

staffRouter.get("/", getStaff);

staffRouter.get(
  "/attendance",
  getStaffAttendance
);

staffRouter.get(
  "/:staff_id/profile",
  getStaffProfile
);
staffRouter.get("/:staff_id", getStaffById);

staffRouter.put("/:staff_id", validateUpdateStaff, updateStaff);

staffRouter.patch(
  "/:staff_id/status",
  updateStaffStatus
);
staffRouter.delete("/:staff_id", deleteStaff);

export default staffRouter;