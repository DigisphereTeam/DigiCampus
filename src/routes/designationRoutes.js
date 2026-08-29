import express from "express";

import {
  bulkCreateDesignations,
  createDesignation,
  getAllDesignations,
  getDesignationById,
  updateDesignation,
  updateDesignationStatus
} from "../controllers/designationController.js";

import authMiddleware from "../middleware/authMiddleware.js";

import authorizeRoles from "../middleware/authorizeRoles.js";

const designationRouter = express.Router();

designationRouter.post(
  "/bulk",
  authMiddleware,
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN"
  ),
  bulkCreateDesignations
);

designationRouter.post(
  "/",
  authMiddleware,
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN"
  ),
  createDesignation
);

designationRouter.get(
  "/",
  authMiddleware,
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN"
  ),
  getAllDesignations
);

designationRouter.get(
  "/:designation_id",
  authMiddleware,
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN"
  ),
  getDesignationById
);

designationRouter.patch(
  "/:designation_id",
  authMiddleware,
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN"
  ),
  updateDesignation
);

designationRouter.patch(
  "/:designation_id/status",
  authMiddleware,
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN"
  ),
  updateDesignationStatus
);

export default designationRouter;