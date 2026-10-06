import express from "express";
import {
  createNotification,
  deleteNotification,
  getMyNotifications,
  getNotificationById,
  getNotifications
} from "../controllers/notificationController.js";
import authMiddleware from "../middleware/authMiddleware.js";

import authorizeRoles from "../middleware/authorizeRoles.js";
import { validateCreateNotification, validateNotificationQuery } from "../middleware/validation/notificationValidation.js";

const notificationRoutes = express.Router();

notificationRoutes.use(authMiddleware);

notificationRoutes.get(
  "/my",
  validateNotificationQuery,
  getMyNotifications
);

notificationRoutes.get(
  "/",
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  validateNotificationQuery,
  getNotifications
);

notificationRoutes.post(
  "/",
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  validateCreateNotification,
  createNotification
);

notificationRoutes.get(
  "/:notification_id",
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  getNotificationById
);

notificationRoutes.delete(
  "/:notification_id",
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  deleteNotification
);

export default notificationRoutes;