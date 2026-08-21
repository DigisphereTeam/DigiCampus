import express from "express";

import { createAcademicYear, getAcademicYearById, getAllAcademicYears, getCurrentAcademicYear, updateAcademicYear, updateAcademicYearStatus } from "../controllers/academicController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import authorizeRoles from "../middleware/authorizeRoles.js";

const academicRouter = express.Router();

academicRouter.post(
  "/",
  authMiddleware,
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN"
  ),
  createAcademicYear
);

academicRouter.get(
  "/",
  authMiddleware,
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN",
    "TEACHER"
  ),
  getAllAcademicYears
);

academicRouter.get(
  "/current",
  authMiddleware,
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN",
    "TEACHER"
  ),
  getCurrentAcademicYear
);

academicRouter.get(
  "/:academic_year_id",
  authMiddleware,
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN",
    "TEACHER"
  ),
  getAcademicYearById
);

academicRouter.patch(
  "/:academic_year_id",
  authMiddleware,
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN"
  ),
  updateAcademicYear
);

academicRouter.patch(
  "/:academic_year_id/status",
  authMiddleware,
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN"
  ),
  updateAcademicYearStatus
);

export default academicRouter;