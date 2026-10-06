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
classRouter.use(authMiddleware)

classRouter.post(
  "/bulk",
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN"
  ),
  createClasses
);

classRouter.post(
  "/",
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN"
  ),
  createClass
);

classRouter.get(
  "/",
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN"
  ),
  getAllClasses
);

classRouter.get(
  "/:class_id",
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN"
  ),
  getClassById
);

classRouter.patch(
  "/:class_id",
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN"
  ),
  updateClass
);

classRouter.patch(
  "/:class_id/status",
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN"
  ),
  toggleClassStatus
);

classRouter.delete(
  "/:class_id",
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN"
  ),
  deleteClass
);

classRouter.patch(
  "/:class_id/status",
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN"
  ),
  toggleClassStatus
);

export default classRouter;