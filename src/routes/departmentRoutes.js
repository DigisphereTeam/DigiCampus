import express from "express";

import {
  bulkCreateDepartments,
  createDepartment,
  getAllDepartments,
  getDepartmentById,
  updateDepartment,
  updateDepartmentStatus
} from "../controllers/departmentController.js";

import authMiddleware from "../middleware/authMiddleware.js";

import authorizeRoles from "../middleware/authorizeRoles.js";

const departmentRouter = express.Router();

departmentRouter.post(
  "/bulk",
  authMiddleware,
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN"
  ),
  bulkCreateDepartments
);

departmentRouter.post(
  "/",
  authMiddleware,
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN"
  ),
  createDepartment
);

departmentRouter.get(
  "/",
  authMiddleware,
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN"
  ),
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
  updateDepartment
);

departmentRouter.patch(
  "/:department_id/status",
  authMiddleware,
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN"
  ),
  updateDepartmentStatus
);

export default departmentRouter;