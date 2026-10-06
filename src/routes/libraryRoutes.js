import express from "express";
import bookRouter from "./bookRoutes.js";
import libraryTransactionRouter from "./libraryTransactionRoutes.js";

const libraryRouter = express.Router();

libraryRouter.use("/books", bookRouter);
libraryRouter.use("/transactions", libraryTransactionRouter);

export default libraryRouter;