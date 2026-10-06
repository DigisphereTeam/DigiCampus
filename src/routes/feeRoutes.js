import express from "express";

import {
  addFeePayment,
  assignFeeToStudent,
  getClassFeeDetails,
  getFeeSummary,
  getPaymentHistory,
  getStudentFeeDetails
} from "../controllers/feeController.js";

import authMiddleware from "../middleware/authMiddleware.js";
import authorizeRoles from "../middleware/authorizeRoles.js";

import { validateAddFeePayment, validateAssignFeeToStudent } from "../middleware/validation/feeValidation.js";

const feeRouter = express.Router();

feeRouter.use(authMiddleware);

feeRouter.get(
  "/summary",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "ACCOUNTANT"),
  getFeeSummary
);

feeRouter.get(
  "/class/:class_id",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "ACCOUNTANT"),
  getClassFeeDetails
);

feeRouter.get(
  "/student/:student_id",
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN",
    "ACCOUNTANT",
    "STUDENT",
    "PARENT"
  ),
  getStudentFeeDetails
);

feeRouter.post(
  "/assign",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "ACCOUNTANT"),
  validateAssignFeeToStudent,
  assignFeeToStudent
);

feeRouter.post(
  "/payment",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "ACCOUNTANT"),
  // upload.single("receipt"),
  validateAddFeePayment,
  addFeePayment
);

feeRouter.get(
  "/student/:student_id/payments",
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN",
    "ACCOUNTANT",
    "STUDENT",
    "PARENT"
  ),
  getPaymentHistory
);

export default feeRouter;