import express from "express";

import {
  bulkCreateDepartments,
  createDepartment,
  getAllDepartments,
  getDepartmentById,
  updateDepartment,
  updateDepartmentStatus,
} from "../controllers/departmentController.js";

import authMiddleware from "../middleware/authMiddleware.js";
import authorizeRoles from "../middleware/authorizeRoles.js";
import { validateBulkCreateDepartments, validateCreateDepartment, validateGetDepartments, validateUpdateDepartment, validateUpdateDepartmentStatus } from "../middleware/validation/departmentValidation.js";

const departmentRouter = express.Router();

departmentRouter.post(
  "/bulk",
  authMiddleware,
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN"
  ),
  validateBulkCreateDepartments,
  bulkCreateDepartments
);

departmentRouter.post(
  "/",
  authMiddleware,
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN"
  ),
  validateCreateDepartment,
  createDepartment
);

departmentRouter.get(
  "/",
  authMiddleware,
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN"
  ),
  validateGetDepartments,
  getAllDepartments
);

departmentRouter.get(
  "/:department_id",
  authMiddleware,
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN"
  ),
  getDepartmentById
);

departmentRouter.patch(
  "/:department_id",
  authMiddleware,
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN"
  ),
  validateUpdateDepartment,
  updateDepartment
);

departmentRouter.patch(
  "/:department_id/status",
  authMiddleware,
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN"
  ),
  validateUpdateDepartmentStatus,
  updateDepartmentStatus
);

export default departmentRouter;