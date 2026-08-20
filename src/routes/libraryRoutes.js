import express from "express";
import { createBook,getAllBooks,getBookById,updateBook,deleteBook } from "../controllers/libraryController.js";

const LibraryRouter = express.Router();

LibraryRouter.post("/", createBook);
LibraryRouter.get("/", getAllBooks);
LibraryRouter.get("/:book_id", getBookById);
LibraryRouter.put("/:book_id", updateBook);
LibraryRouter.delete("/:book_id", deleteBook);

export default LibraryRouter;
