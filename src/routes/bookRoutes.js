import express from "express";

import {
  createBook,
  deleteBook,
  getAllBooks,
  getBookById,
  updateBook,
} from "../controllers/bookController.js";

import { getBookStudentHistory } from "../controllers/libraryTransactionController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { validateCreateBook, validateUpdateBook } from "../middleware/validation/bookValidation.js";

const bookRouter = express.Router();

bookRouter.use(authMiddleware);

bookRouter.post(
  "/",
  validateCreateBook,
  createBook
);

bookRouter.get(
  "/",
  getAllBooks
);

bookRouter.get(
  "/:book_id",
  getBookById
);

bookRouter.get(
  "/:book_id/students/:student_id/history",
  getBookStudentHistory
);

bookRouter.patch(
  "/:book_id",
  validateUpdateBook,
  updateBook
);

bookRouter.delete(
  "/:book_id",
  deleteBook
);

export default bookRouter;

