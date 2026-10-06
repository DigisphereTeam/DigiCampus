import express from "express";
import {
  addRevenue,
  deleteRevenue,
  getRevenueById,
  getRevenues,
  updateRevenue
} from "../controllers/revenueController.js";

const revenueRouter = express.Router();

revenueRouter.post("/", addRevenue);

revenueRouter.get("/", getRevenues);

revenueRouter.get("/:revenue_id", getRevenueById);

revenueRouter.put("/:revenue_id", updateRevenue);

revenueRouter.delete("/:revenue_id", deleteRevenue);

export default revenueRouter;