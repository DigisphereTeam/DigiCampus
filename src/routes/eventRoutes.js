import express from "express";

import {
  createEvent,
  getAllEvents,
  getEventById,
  getEventDashboard,
  updateEvent,
  updateEventStatus
} from "../controllers/eventController.js";

import authMiddleware from "../middleware/authMiddleware.js";
import authorizeRoles from "../middleware/authorizeRoles.js";

const eventRouter = express.Router();

eventRouter.post(
  "/",
  authMiddleware,
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN"
  ),
  createEvent
);

eventRouter.get(
  "/dashboard",
  authMiddleware,
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN"
  ),
  getEventDashboard
);

eventRouter.get(
  "/",
  authMiddleware,
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN"
  ),
  getAllEvents
);

eventRouter.get(
  "/:event_id",
  authMiddleware,
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN"
  ),
  getEventById
);

eventRouter.patch(
  "/:event_id",
  authMiddleware,
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN"
  ),
  updateEvent
);

eventRouter.patch(
  "/:event_id/status",
  authMiddleware,
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN"
  ),
  updateEventStatus
);

export default eventRouter;