import express from "express";

import {
  approveAppointment,
  cancelAppointment,
  completeAppointment,
  createAppointment,
  getAllAppointments,
  getAppointmentById,
  getAppointmentCalendar,
  getAppointmentDashboard,
  getMyAppointments,
  getUpcomingAppointments,
  markAppointmentNoShow,
  rejectAppointment,
  updateAppointment
} from "../controllers/appointmentController.js";

import authMiddleware from "../middleware/authMiddleware.js";
import { validateRequestBody } from "../middleware/validateRequestBody.js";

const appointmentRouter = express.Router();



appointmentRouter.post(
  "/",
  authMiddleware,
  validateRequestBody,
  createAppointment
);

appointmentRouter.get(
  "/",
  authMiddleware,
  getAllAppointments
);

appointmentRouter.get(
  "/my",
  authMiddleware,
  getMyAppointments
);

appointmentRouter.get(
  "/upcoming",
  authMiddleware,
  getUpcomingAppointments
);

appointmentRouter.get(
  "/calendar",
  authMiddleware,
  getAppointmentCalendar
);

appointmentRouter.get(
  "/dashboard",
  authMiddleware,
  checkRole("SUPER_ADMIN", "ADMIN"),
  getAppointmentDashboard
);

appointmentRouter.get(
  "/:appointment_id",
  authMiddleware,
  getAppointmentById
);

appointmentRouter.patch(
  "/:appointment_id",
  authMiddleware,
  validateRequestBody,
  updateAppointment
);

appointmentRouter.patch(
  "/:appointment_id/approve",
  authMiddleware,
  checkRole("SUPER_ADMIN", "ADMIN", "TEACHER"),
  approveAppointment
);

appointmentRouter.patch(
  "/:appointment_id/reject",
  authMiddleware,
  checkRole("SUPER_ADMIN", "ADMIN", "TEACHER"),
  validateRequestBody,
  rejectAppointment
);

appointmentRouter.patch(
  "/:appointment_id/cancel",
  authMiddleware,
  validateRequestBody,
  cancelAppointment
);

appointmentRouter.patch(
  "/:appointment_id/complete",
  authMiddleware,
  checkRole("SUPER_ADMIN", "ADMIN", "TEACHER"),
  completeAppointment
);

appointmentRouter.patch(
  "/:appointment_id/no-show",
  authMiddleware,
  checkRole("SUPER_ADMIN", "ADMIN", "TEACHER"),
  markAppointmentNoShow
);

export default appointmentRouter;