import express from "express";

import {
  createTeacherSubjectAllocation,
  deleteTeacherSubjectAllocation,
  getTeacherSubjectAllocationById,
  getTeacherSubjectAllocations,
  updateTeacherSubjectAllocation,
} from "../controllers/teacherSubjectAllocationController.js";

import { checkRole } from "../middleware/checkRole.js";
import { validateAllocationId, validateCreateTeacherSubjectAllocation, validateUpdateTeacherSubjectAllocation } from "../middleware/validation/teacherSubjectAllocationValidation.js";

const router = express.Router();

router.post(
  "/",
  checkRole("SUPER_ADMIN", "ADMIN"),
  validateCreateTeacherSubjectAllocation,
  createTeacherSubjectAllocation
);

router.get(
  "/",
  getTeacherSubjectAllocations
);

router.get(
  "/:allocation_id",
  validateAllocationId,
  getTeacherSubjectAllocationById
);

router.put(
  "/:allocation_id",
  checkRole("SUPER_ADMIN", "ADMIN"),
  validateAllocationId,
  validateUpdateTeacherSubjectAllocation,
  updateTeacherSubjectAllocation
);

router.delete(
  "/:allocation_id",
  checkRole("SUPER_ADMIN", "ADMIN"),
  validateAllocationId,
  deleteTeacherSubjectAllocation
);

export default router;