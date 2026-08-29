import express from "express";

import {
  createEmployee,
  getAllEmployees,
  getEmployeeById,
  updateEmployee,
  updateEmployeeStatus
} from "../controllers/employeeController.js";

import authMiddleware from "../middleware/authMiddleware.js";

import authorizeRoles from "../middleware/authorizeRoles.js";

const employeeRouter = express.Router();

employeeRouter.post(
  "/",
  authMiddleware,
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN"
  ),
  createEmployee
);

employeeRouter.get(
  "/",
  authMiddleware,
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN"
  ),
  getAllEmployees
);

employeeRouter.get(
  "/:employee_id",
  authMiddleware,
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN"
  ),
  getEmployeeById
);

employeeRouter.patch(
  "/:employee_id",
  authMiddleware,
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN"
  ),
  updateEmployee
);

employeeRouter.patch(
  "/:employee_id/status",
  authMiddleware,
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN"
  ),
  updateEmployeeStatus
);

export default employeeRouter;