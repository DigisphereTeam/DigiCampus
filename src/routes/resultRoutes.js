import express from "express";

import {
  getExamResults,
  getMyExamResult,
  getMyResults,
  getStudentResult
} from "../controllers/resultController.js";

import authMiddleware from "../middleware/authMiddleware.js";
import authorizeRoles from "../middleware/authorizeRoles.js";

const resultRouter = express.Router();

resultRouter.use(authMiddleware);

resultRouter.get(
  "/exam/:exam_id",
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN",
    "TEACHER",
    "STAFF"
  ),
  getExamResults
);

resultRouter.get(
  "/exam/:exam_id/student/:student_id",
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN",
    "TEACHER",
    "STAFF"
  ),
  getStudentResult
);

resultRouter.get(
  "/my-results",
  authorizeRoles("STUDENT"),
  getMyResults
);

resultRouter.get(
  "/my-results/:exam_id",
  authorizeRoles("STUDENT"),
  getMyExamResult
);

export default resultRouter;