import { isValidDate } from "../utils/date.js";
import { sendErrorResponse } from "../utils/response.js";
import { isValidId } from "../utils/validation.js";

export const validateCreateLeave = (req, res, next) => {
  const {
    employee_id,
    leave_type_id,
    from_date,
    to_date,
    reason,
  } = req.body || {};

  if (!isValidId(employee_id)) {
    return sendErrorResponse(
      res,
      400,
      "Valid employee ID is required",
    );
  }

  if (!isValidId(leave_type_id)) {
    return sendErrorResponse(
      res,
      400,
      "Valid leave type ID is required",
    );
  }

  if (!from_date) {
    return sendErrorResponse(
      res,
      400,
      "Leave start date is required",
    );
  }

  if (!isValidDate(from_date)) {
    return sendErrorResponse(
      res,
      400,
      "Leave start date must be in YYYY-MM-DD format",
    );
  }

  if (!to_date) {
    return sendErrorResponse(
      res,
      400,
      "Leave end date is required",
    );
  }

  if (!isValidDate(to_date)) {
    return sendErrorResponse(
      res,
      400,
      "Leave end date must be in YYYY-MM-DD format",
    );
  }

  if (to_date < from_date) {
    return sendErrorResponse(
      res,
      400,
      "Leave end date cannot be before leave start date",
    );
  }

  if (typeof reason !== "string") {
    return sendErrorResponse(
      res,
      400,
      "Invalid leave reason",
    );
  }

  if (!reason.trim()) {
    return sendErrorResponse(
      res,
      400,
      "Leave reason is required",
    );
  }

  next();
};