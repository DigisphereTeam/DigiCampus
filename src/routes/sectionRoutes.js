import express from "express";

import {
  bulkCreateSections,
  createSection,
  getAllSections,
  getSectionById,
  updateSection,
  updateSectionStatus
} from "../controllers/sectionController.js";

import authMiddleware from "../middleware/authMiddleware.js";
import authorizeRoles from "../middleware/authorizeRoles.js";
import { validateCreateSection, validateUpdateSection } from "../middleware/validation/sectionValidation.js";

const sectionRouter = express.Router();

sectionRouter.post(
  "/bulk",
  authMiddleware,
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN"
  ),
  bulkCreateSections
);

sectionRouter.post(
  "/",
  authMiddleware,
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN"
  ),
  validateCreateSection,
  createSection
);

sectionRouter.get(
  "/",
  authMiddleware,
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN",
    "TEACHER"
  ),
  getAllSections
);

sectionRouter.get(
  "/:section_id",
  authMiddleware,
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN",
    "TEACHER"
  ),
  getSectionById
);

sectionRouter.patch(
  "/:section_id",
  authMiddleware,
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN"
  ),
  validateUpdateSection,
  updateSection
);

sectionRouter.patch(
  "/:section_id/status",
  authMiddleware,
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN"
  ),
  updateSectionStatus
);

export default sectionRouter;