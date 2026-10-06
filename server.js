import cors from "cors";
import express from "express";
import pool from "./src/config/database.js";
import { config } from "./src/config/env.js";
import apiLogger from "./src/middleware/apiLogger.js";
import { errorHandler } from "./src/middleware/errorHandler.js";
import { notFound } from "./src/middleware/notFound.js";
import academicRouter from "./src/routes/academicRoutes.js";
import accountRouter from "./src/routes/accountRoutes.js";
import assignmentRouter from "./src/routes/assignmentRoutes.js";
import attendanceRouter from "./src/routes/attendanceRoutes.js";
import authRouter from "./src/routes/authRoutes.js";
import classRouter from "./src/routes/classRoutes.js";
import classSectionRouter from "./src/routes/classSectionRoutes.js";
import departmentRouter from "./src/routes/departmentRoutes.js";
import eventRouter from "./src/routes/eventRoutes.js";
import examRouter from "./src/routes/examRoutes.js";
import feeRouter from "./src/routes/feeRoutes.js";
import leadRouter from "./src/routes/leadRoutes.js";
import libraryRouter from "./src/routes/libraryRoutes.js";
import meetingRouter from "./src/routes/meetingRoutes.js";
import notificationRoutes from "./src/routes/notificationRoutes.js";
import resultRouter from "./src/routes/resultRoutes.js";
import revenueRouter from "./src/routes/revenueRoutes.js";
import sectionRouter from "./src/routes/sectionRoutes.js";
import staffRouter from "./src/routes/staffRoutes.js";
import studentRouter from "./src/routes/studentRoutes.js";
import subjectRouter from "./src/routes/subjectRoutes.js";
import teacherRouter from "./src/routes/teacherRoutes.js";
import transportRouter from "./src/routes/transportRoutes.js";
import userRouter from "./src/routes/userRoutes.js";
import visitorRouter from "./src/routes/visitorRoutes.js";
import { sendSuccessResponse } from "./src/utils/response.js";

const app = express();

const PORT = config.port || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(apiLogger);

app.get("/", (_, res) => {
  return sendSuccessResponse(
    res,
    200,
    "Server is up and running"
  );
});

app.use("/auth", authRouter);
app.use("/users", userRouter);
app.use("/students", studentRouter);
app.use("/leads", leadRouter);
app.use("/classes", classRouter);
app.use("/events", eventRouter);

app.use("/teachers", teacherRouter);
app.use("/staff", staffRouter);
app.use("/subjects", subjectRouter);
app.use("/assignments", assignmentRouter);
app.use("/attendance", attendanceRouter);

app.use("/visitors", visitorRouter);
app.use("/academic-years", academicRouter);
app.use("/sections", sectionRouter);
app.use("/class-sections", classSectionRouter);
app.use("/departments", departmentRouter);
app.use("/library", libraryRouter);

app.use("/meetings", meetingRouter);
app.use("/exams", examRouter);
app.use("/results", resultRouter);
app.use("/transport", transportRouter)
app.use("/notifications", notificationRoutes);
app.use("/fees", feeRouter);
app.use("/revenues", revenueRouter);
app.use("/accounts", accountRouter);

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