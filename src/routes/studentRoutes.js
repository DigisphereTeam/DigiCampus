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
StudentRouter.get("/:student_id", getStudentById);
StudentRouter.put("/:student_id", updateStudent);
StudentRouter.delete("/:student_id", deleteStudent);

export default StudentRouter;