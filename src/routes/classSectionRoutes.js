import express from "express";

import {
  bulkCreateClassSections,
  createClassSection,
  getAllClassSections,
  getClassSectionById,
  updateClassSection,
  updateClassSectionStatus
} from "../controllers/classSectionController.js";

import authMiddleware from "../middleware/authMiddleware.js";
import authorizeRoles from "../middleware/authorizeRoles.js";
import { validateBulkCreateClassSections, validateCreateClassSection } from "../middleware/validation/classSectionValidation.js";

const classSectionRouter = express.Router();

classSectionRouter.post(
  "/bulk",
  authMiddleware,
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN"
  ),
  validateBulkCreateClassSections,
  bulkCreateClassSections
);

classSectionRouter.post(
  "/",
  authMiddleware,
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN"
  ),
  validateCreateClassSection,
  createClassSection
);

classSectionRouter.get(
  "/",
  authMiddleware,
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN",
    "TEACHER"
  ),
  getAllClassSections
);

classSectionRouter.get(
  "/:class_section_id",
  authMiddleware,
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN",
    "TEACHER"
  ),
  getClassSectionById
);

classSectionRouter.patch(
  "/:class_section_id",
  authMiddleware,
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN"
  ),
  updateClassSection
);

classSectionRouter.patch(
  "/:class_section_id/status",
  authMiddleware,
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN"
  ),
  updateClassSectionStatus
);

export default classSectionRouter;