import express from "express";

import {
  checkInVisitor,
  checkOutVisitor,
  createVisitor,
  deleteVisitor,
  getVisitorById,
  getVisitors,
  updateVisitor
} from "../controllers/visitorController.js";

import authMiddleware from "../middleware/authMiddleware.js";
import authorizeRoles from "../middleware/authorizeRoles.js";

const visitorRouter = express.Router();

visitorRouter.use(authMiddleware);

visitorRouter.post(
  "/",
  authorizeRoles("ADMIN", "SUPER_ADMIN"),
  createVisitor
);

visitorRouter.get(
  "/",
  authorizeRoles("ADMIN", "SUPER_ADMIN", "TEACHER"),
  getVisitors
);

visitorRouter.get(
  "/:visitor_id",
  authorizeRoles("ADMIN", "SUPER_ADMIN", "TEACHER"),
  getVisitorById
);

visitorRouter.patch(
  "/:visitor_id",
  authorizeRoles("ADMIN", "SUPER_ADMIN"),
  updateVisitor
);

visitorRouter.patch(
  "/:visitor_id/check-in",
  authorizeRoles("ADMIN", "SUPER_ADMIN"),
  checkInVisitor
);

visitorRouter.patch(
  "/:visitor_id/check-out",
  authorizeRoles("ADMIN", "SUPER_ADMIN"),
  checkOutVisitor
);

visitorRouter.delete(
  "/:visitor_id",
  authorizeRoles("ADMIN", "SUPER_ADMIN"),
  deleteVisitor
);

export default visitorRouter;
