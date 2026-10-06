import { sendErrorResponse } from "../../utils/response.js";
import { hasValue, isValidId } from "../../utils/validation.js";


export const validateCreateExam = (req, res, next) => {
  const {
    exam_name,
    exam_type,
    start_date,
    end_date,
    description,
  } = req.body || {};

  if (!hasValue(exam_name) || typeof exam_name !== "string") {
    return sendErrorResponse(res, 400, "Exam name is required");
  }

  if (!hasValue(exam_type) || typeof exam_type !== "string") {
    return sendErrorResponse(res, 400, "Exam type is required");
  }

  if (!hasValue(start_date)) {
    return sendErrorResponse(res, 400, "Start date is required");
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(start_date)) {
    return sendErrorResponse(res, 400, "Valid start date is required");
  }

  if (!hasValue(end_date)) {
    return sendErrorResponse(res, 400, "End date is required");
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(end_date)) {
    return sendErrorResponse(res, 400, "Valid end date is required");
  }

  if (new Date(start_date) > new Date(end_date)) {
    return sendErrorResponse(
      res,
      400,
      "End date must be greater than or equal to start date"
    );
  }

  if (
    hasValue(description) &&
    typeof description !== "string"
  ) {
    return sendErrorResponse(res, 400, "Description must be a string");
  }

  req.body.exam_name = exam_name.trim();
  req.body.exam_type = exam_type.trim();
  req.body.start_date = start_date.trim();
  req.body.end_date = end_date.trim();

  if (hasValue(description)) {
    req.body.description = description.trim();
  }

  next();
};

export const validateGetAllExams = (req, res, next) => {
  const {
    page = 1,
    limit = 10,
    search,
    exam_type,
    status,
    academic_year_id,
    is_active,
  } = req.query;

  const pageNumber = Number(page);
  const limitNumber = Number(limit);

  if (
    !Number.isInteger(pageNumber) ||
    pageNumber <= 0
  ) {
    return sendErrorResponse(res, 400, "Valid page is required");
  }

  if (
    !Number.isInteger(limitNumber) ||
    limitNumber <= 0 ||
    limitNumber > 100
  ) {
    return sendErrorResponse(
      res,
      400,
      "Limit must be between 1 and 100"
    );
  }

  if (hasValue(academic_year_id)) {
    if (
      !Number.isInteger(Number(academic_year_id)) ||
      Number(academic_year_id) <= 0
    ) {
      return sendErrorResponse(
        res,
        400,
        "Valid academic year ID is required"
      );
    }

    req.query.academic_year_id = Number(academic_year_id);
  }

  if (hasValue(is_active) && !["true", "false"].includes(String(is_active))) {
    return sendErrorResponse(
      res,
      400,
      "is_active must be true or false"
    );
  }

  if (hasValue(search)) {
    if (typeof search !== "string") {
      return sendErrorResponse(res, 400, "Search must be a string");
    }

    req.query.search = search.trim();
  }

  if (hasValue(exam_type)) {
    if (typeof exam_type !== "string") {
      return sendErrorResponse(res, 400, "Exam type must be a string");
    }

    req.query.exam_type = exam_type.trim();
  }

  if (hasValue(status)) {
    if (typeof status !== "string") {
      return sendErrorResponse(res, 400, "Status must be a string");
    }

    req.query.status = status.trim();
  }

  req.query.page = pageNumber;
  req.query.limit = limitNumber;

  next();
};

export const validateUpdateExam = (req, res, next) => {
  const {
    exam_name,
    exam_type,
    academic_year_id,
    start_date,
    end_date,
    description,
    status,
    is_active,
  } = req.body;

  if (
    !hasValue(exam_name) &&
    !hasValue(exam_type) &&
    !hasValue(academic_year_id) &&
    !hasValue(start_date) &&
    !hasValue(end_date) &&
    !hasValue(description) &&
    !hasValue(status) &&
    !hasValue(is_active)
  ) {
    return sendErrorResponse(
      res,
      400,
      "At least one field is required for update"
    );
  }

  if (hasValue(exam_name)) {
    if (typeof exam_name !== "string" || !exam_name.trim()) {
      return sendErrorResponse(res, 400, "Valid exam name is required");
    }

    req.body.exam_name = exam_name.trim();
  }

  if (hasValue(exam_type)) {
    if (typeof exam_type !== "string" || !exam_type.trim()) {
      return sendErrorResponse(res, 400, "Valid exam type is required");
    }

    req.body.exam_type = exam_type.trim();
  }

  if (hasValue(academic_year_id)) {
    if (
      !Number.isInteger(Number(academic_year_id)) ||
      Number(academic_year_id) <= 0
    ) {
      return sendErrorResponse(
        res,
        400,
        "Valid academic year ID is required"
      );
    }

    req.body.academic_year_id = Number(academic_year_id);
  }

  if (hasValue(start_date)) {
    if (
      typeof start_date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(start_date)
    ) {
      return sendErrorResponse(res, 400, "Valid start date is required");
    }

    req.body.start_date = start_date.trim();
  }

  if (hasValue(end_date)) {
    if (
      typeof end_date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(end_date)
    ) {
      return sendErrorResponse(res, 400, "Valid end date is required");
    }

    req.body.end_date = end_date.trim();
  }

  if (hasValue(description)) {
    if (typeof description !== "string") {
      return sendErrorResponse(res, 400, "Description must be a string");
    }

    req.body.description = description.trim();
  }

  if (hasValue(status)) {
    if (typeof status !== "string") {
      return sendErrorResponse(res, 400, "Status must be a string");
    }

    req.body.status = status.trim();
  }

  if (hasValue(is_active)) {
    if (typeof is_active !== "boolean") {
      return sendErrorResponse(
        res,
        400,
        "is_active must be a boolean"
      );
    }
  }

  if (
    hasValue(start_date) &&
    hasValue(end_date) &&
    new Date(start_date) > new Date(end_date)
  ) {
    return sendErrorResponse(
      res,
      400,
      "End date must be greater than or equal to start date"
    );
  }

  next();
};

export const validateUploadSubjectResults = (req, res, next) => {
  const {
    exam_id,
    class_id,
    section_id,
    subject_id,
    results,
  } = req.body || {};

  if (!isValidId(exam_id)) {
    return sendErrorResponse(
      res,
      400,
      "Valid exam ID is required"
    );
  }

  if (!isValidId(class_id)) {
    return sendErrorResponse(
      res,
      400,
      "Valid class ID is required"
    );
  }

  if (!isValidId(section_id)) {
    return sendErrorResponse(
      res,
      400,
      "Valid section ID is required"
    );
  }

  if (!isValidId(subject_id)) {
    return sendErrorResponse(
      res,
      400,
      "Valid subject ID is required"
    );
  }

  if (!Array.isArray(results) || results.length === 0) {
    return sendErrorResponse(
      res,
      400,
      "Results are required"
    );
  }

  const studentIds = new Set();

  for (const result of results) {
    if (
      !result ||
      typeof result !== "object" ||
      Array.isArray(result)
    ) {
      return sendErrorResponse(
        res,
        400,
        "Each result must be an object"
      );
    }

    if (!isValidId(result.student_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid student ID is required"
      );
    }

    if (!hasValue(result.marks_obtained)) {
      return sendErrorResponse(
        res,
        400,
        `Marks are required for student ID ${result.student_id}`
      );
    }

    const marksObtained = Number(result.marks_obtained);

    if (
      !Number.isFinite(marksObtained) ||
      marksObtained < 0
    ) {
      return sendErrorResponse(
        res,
        400,
        `Invalid marks for student ID ${result.student_id}`
      );
    }

    const studentId = Number(result.student_id);

    if (studentIds.has(studentId)) {
      return sendErrorResponse(
        res,
        400,
        `Duplicate student ID ${result.student_id}`
      );
    }

    studentIds.add(studentId);
  }

  req.body.exam_id = Number(exam_id);
  req.body.class_id = Number(class_id);
  req.body.section_id = Number(section_id);
  req.body.subject_id = Number(subject_id);

  req.body.results = results.map((result) => ({
    student_id: Number(result.student_id),
    marks_obtained: Number(result.marks_obtained),
  }));

  next();
};