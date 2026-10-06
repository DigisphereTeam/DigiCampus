import express from "express";
import {
  addExpense,
  getAccountReports,
  getAccountsDashboard,
  getAccountTransactions,
  getExpenseById,
  getExpenses
} from "../controllers/accountController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const accountRouter = express.Router();

accountRouter.use(authMiddleware);

accountRouter.get("/dashboard", getAccountsDashboard);

accountRouter.post("/expenses", addExpense);

accountRouter.get("/expenses", getExpenses);

accountRouter.get("/expenses/:expense_id", getExpenseById);

accountRouter.get("/transactions", getAccountTransactions);

accountRouter.get("/reports", getAccountReports);

export default accountRouter;