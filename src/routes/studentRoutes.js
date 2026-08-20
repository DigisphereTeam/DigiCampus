import express from "express";

import {
  createStudent,
  getAllStudents,
  getStudentById,
  updateStudent,
  deleteStudent
} from "../controllers/studentController.js";


const StudentRouter = express.Router();

StudentRouter.post("/", createStudent);
StudentRouter.get("/", getAllStudents);
StudentRouter.get("/:id", getStudentById);
StudentRouter.put("/:id", updateStudent);
StudentRouter.delete("/:id", deleteStudent);

export default StudentRouter;