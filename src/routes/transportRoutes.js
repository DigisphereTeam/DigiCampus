import express from "express";
import {
  addStudentsToTransport,
  createVehicle,
  getVehicleById,
  getVehicles,
  getVehicleStudents,
  removeStudentFromTransport,
  updateVehicle,
  updateVehicleStatus
} from "../controllers/transportController.js";

import authMiddleware from "../middleware/authMiddleware.js";
import authorizeRoles from "../middleware/authorizeRoles.js";

import { validateAddStudentsToTransport, validateCreateVehicle } from "../middleware/validation/transportValidation.js";

const transportRouter = express.Router();

transportRouter.use(authMiddleware);

transportRouter.post(
  "/vehicles",
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  validateCreateVehicle,
  createVehicle
);

transportRouter.get(
  "/vehicles",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "STAFF"),
  getVehicles
);

transportRouter.get(
  "/vehicles/:vehicle_id",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "STAFF"),
  getVehicleById
);

transportRouter.patch(
  "/vehicles/:vehicle_id",
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  updateVehicle
);

transportRouter.patch(
  "/vehicles/:vehicle_id/status",
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  updateVehicleStatus
);

transportRouter.get(
  "/vehicles/:vehicle_id/students",
  authMiddleware,
  authorizeRoles("SUPER_ADMIN", "ADMIN", "TEACHER", "STAFF"),
  getVehicleStudents
);

transportRouter.post(
  "/students",
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  validateAddStudentsToTransport,
  addStudentsToTransport
);

transportRouter.delete(
  "/students/:student_id",
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  removeStudentFromTransport
);

export default transportRouter;