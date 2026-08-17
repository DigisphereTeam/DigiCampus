import cors from "cors";
import "dotenv/config";
import express from "express";
import pool from "./src/config/database.js";
import { errorHandler } from "./src/middleware/errorHandler.js";
import { notFound } from "./src/middleware/notFound.js";
import authRouter from "./src/routes/authRoutes.js";
import userRouter from "./src/routes/userRoutes.js";
import { sendSuccessResponse } from "./src/utils/response.js";

const app = express();

const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  return sendSuccessResponse(
    res,
    200,
    "Server is up and running"
  );
});

app.use("/auth", authRouter);
app.use("/users", userRouter);

app.use(notFound);
app.use(errorHandler);

app.listen(PORT, async () => {
  try {
    await pool.query("SELECT 1");

    console.log("DB connected successfully");
    console.log(
      `Server is running on http://localhost:${PORT}`
    );
  } catch (error) {
    console.error(
      "Database connection failed:",
      error.message
    );

    process.exit(1);
  }
});