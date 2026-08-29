import express from "express";

import {
  createClass,
  createClasses,
  deleteClass,
  getAllClasses,
  getClassById,
  toggleClassStatus,
  updateClass,
} from "../controllers/classController.js";

import authMiddleware from "../middleware/authMiddleware.js";
import authorizeRoles from "../middleware/authorizeRoles.js";

const classRouter = express.Router();

classRouter.post(
  "/bulk",
  authMiddleware,
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN"
  ),
  createClasses
);

classRouter.post(
  "/",
  authMiddleware,
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN"
  ),
  createClass
);

classRouter.get(
  "/",
  authMiddleware,
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN"
  ),
  getAllClasses
);

classRouter.get(
  "/:class_id",
  authMiddleware,
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN"
  ),
  getClassById
);

classRouter.patch(
  "/:class_id",
  authMiddleware,
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN"
  ),
  updateClass
);

classRouter.patch(
  "/:class_id/status",
  authMiddleware,
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN"
  ),
  toggleClassStatus
);

classRouter.delete(
  "/:class_id",
  authMiddleware,
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN"
  ),
  deleteClass
);

classRouter.patch(
  "/:class_id/status",
  authMiddleware,
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN"
  ),
  toggleClassStatus
);

export default classRouter;