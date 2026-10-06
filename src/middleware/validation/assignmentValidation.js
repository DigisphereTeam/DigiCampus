import { getCurrentDate, isValidDate } from "../../utils/date.js";
import { sendErrorResponse } from "../../utils/response.js";
import { isValidId } from "../../utils/validation.js";

export const validateCreateAssignment = (req, res, next) => {
  const {
    title,
    description,
    class_section_id,
    subject_id,
    due_date,
    max_marks
  } = req.body || {};

  if (!title) {
    return sendErrorResponse(res, 400, "Title is required");
  }

  if (typeof title !== "string") {
    return sendErrorResponse(res, 400, "Invalid title");
  }

  if (title.trim().length > 255) {
    return sendErrorResponse(
      res,
      400,
      "Title cannot exceed 255 characters"
    );
  }

  if (!isValidId(class_section_id)) {
    return sendErrorResponse(
      res,
      400,
      "Valid class section ID is required"
    );
  }

  if (!isValidId(subject_id)) {
    return sendErrorResponse(
      res,
      400,
      "Valid subject ID is required"
    );
  }

  if (!due_date) {
    return sendErrorResponse(res, 400, "Due date is required");
  }

  if (typeof due_date !== "string") {
    return sendErrorResponse(res, 400, "Invalid due date");
  }

  if (!isValidDate(due_date.trim())) {
    return sendErrorResponse(
      res,
      400,
      "Due date must be in YYYY-MM-DD format"
    );
  }

  if (due_date.trim() < getCurrentDate()) {
    return sendErrorResponse(
      res,
      400,
      "Due date cannot be before assigned date"
    );
  }

  if (description !== undefined && description !== null) {
    if (typeof description !== "string") {
      return sendErrorResponse(res, 400, "Invalid description");
    }
  }

  if (
    max_marks !== undefined &&
    max_marks !== null &&
    max_marks !== ""
  ) {
    const value = Number(max_marks);

    if (!Number.isFinite(value) || value <= 0) {
      return sendErrorResponse(
        res,
        400,
        "Max marks must be greater than 0"
      );
    }
  }

  next();
};