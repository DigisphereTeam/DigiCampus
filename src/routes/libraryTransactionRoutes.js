import express from "express";

import {issueBook,returnBook,getAllTransactions,getTransactionById,deleteTransaction} from "../controllers/libraryTransactionController.js";

const LibraryTransactionRouter = express.Router();

LibraryTransactionRouter.post("/issue",issueBook);

LibraryTransactionRouter.put("/return/:transaction_id",returnBook);

LibraryTransactionRouter.get("/",getAllTransactions);

LibraryTransactionRouter.get("/:transaction_id",getTransactionById);

LibraryTransactionRouter.delete("/:transaction_id",deleteTransaction);

export default LibraryTransactionRouter;