import express from "express";

import {
  deleteTransaction,
  getAllTransactions,
  getBookHistory,
  getStudentBookHistory,
  getTransactionById,
  issueBook,
  returnBook,
} from "../controllers/libraryTransactionController.js";

import authMiddleware from "../middleware/authMiddleware.js";
import { validateIssueBook, validateReturnBook } from "../middleware/validation/libraryTransactionValidation.js";

const libraryTransactionRouter = express.Router();

libraryTransactionRouter.use(authMiddleware)

libraryTransactionRouter.post(
  "/issue",
  validateIssueBook,
  issueBook,
);

libraryTransactionRouter.get(
  "/book/:book_id/history",
  getBookHistory,
);

libraryTransactionRouter.get(
  "/students/:student_id/history",
  getStudentBookHistory,
);

libraryTransactionRouter.patch(
  "/return/:transaction_id",
  validateReturnBook,
  returnBook,
);

libraryTransactionRouter.get(
  "/",
  getAllTransactions,
);

libraryTransactionRouter.get(
  "/:transaction_id",
  getTransactionById,
);

libraryTransactionRouter.delete(
  "/:transaction_id",
  deleteTransaction,
);

export default libraryTransactionRouter;