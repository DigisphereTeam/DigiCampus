import { ATTENDANCE_STATUSES } from "../../constants/constants.js";
import { isValidId } from "../../utils/validation.js";

export const validateCreateAttendance = (req, res, next) => {
  let {
    class_id,
    section_id,
    attendance_date,
    subject_id,
    attendance,
  } = req.body;

  class_id =
    typeof class_id === "string" ? class_id.trim() : class_id;

  section_id =
    typeof section_id === "string" ? section_id.trim() : section_id;

  attendance_date =
    typeof attendance_date === "string"
      ? attendance_date.trim()
      : attendance_date;

  subject_id =
    typeof subject_id === "string"
      ? subject_id.trim()
      : subject_id;

  if (!isValidId(class_id)) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: "Valid class ID is required",
    });
  }

  if (!isValidId(section_id)) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: "Valid section ID is required",
    });
  }

  if (!attendance_date) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: "Attendance date is required",
    });
  }

  if (subject_id && !isValidId(subject_id)) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: "Valid subject ID is required",
    });
  }

  if (!Array.isArray(attendance) || attendance.length === 0) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: "Attendance records are required",
    });
  }

  const normalizedAttendance = [];

  for (const record of attendance) {
    let { student_id, status } = record;

    student_id =
      typeof student_id === "string"
        ? student_id.trim()
        : student_id;

    status =
      typeof status === "string"
        ? status.trim().toUpperCase()
        : status;

    if (!isValidId(student_id)) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Valid student ID is required",
      });
    }

    if (!status || !ATTENDANCE_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Valid attendance status is required",
      });
    }

    normalizedAttendance.push({
      student_id,
      status,
    });
  }

  req.body = {
    class_id,
    section_id,
    attendance_date,
    subject_id: subject_id || null,
    attendance: normalizedAttendance,
  };

  next();
};

