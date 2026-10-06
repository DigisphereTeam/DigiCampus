import { sendErrorResponse } from "../../utils/response.js";
import { isValidId } from "../../utils/validation.js";

export const validateBulkCreateSubject = (req, res, next) => {
  const { subjects } = req.body || {};

  if (!subjects) {
    return sendErrorResponse(
      res,
      400,
      "Subjects are required"
    );
  }

  if (!Array.isArray(subjects)) {
    return sendErrorResponse(
      res,
      400,
      "Subjects must be an array"
    );
  }

  if (subjects.length === 0) {
    return sendErrorResponse(
      res,
      400,
      "At least one subject is required"
    );
  }

  for (const subject of subjects) {
    if (!subject || typeof subject !== "object") {
      return sendErrorResponse(
        res,
        400,
        "Invalid subject data"
      );
    }

    const { subject_name, description } = subject;

    if (!subject_name) {
      return sendErrorResponse(
        res,
        400,
        "Subject name is required"
      );
    }

    if (typeof subject_name !== "string") {
      return sendErrorResponse(
        res,
        400,
        "Invalid subject name"
      );
    }

    if (!subject_name.trim()) {
      return sendErrorResponse(
        res,
        400,
        "Subject name is required"
      );
    }

    if (subject_name.trim().length > 100) {
      return sendErrorResponse(
        res,
        400,
        "Subject name cannot exceed 100 characters"
      );
    }

    if (description !== undefined && description !== null) {
      if (typeof description !== "string") {
        return sendErrorResponse(
          res,
          400,
          "Invalid description"
        );
      }
    }
  }

  next();
};

export const validateCreateSubject = (req, res, next) => {
  const { subject_name, description } = req.body || {};

  if (!subject_name) {
    return sendErrorResponse(res, 400, "Subject name is required");
  }

  if (typeof subject_name !== "string") {
    return sendErrorResponse(res, 400, "Invalid subject name");
  }

  if (!subject_name.trim()) {
    return sendErrorResponse(res, 400, "Subject name is required");
  }

  if (subject_name.trim().length > 100) {
    return sendErrorResponse(
      res,
      400,
      "Subject name cannot exceed 100 characters"
    );
  }

  if (description !== undefined && description !== null) {
    if (typeof description !== "string") {
      return sendErrorResponse(res, 400, "Invalid description");
    }
  }

  next();
};

export const validateUpdateSubject = (req, res, next) => {
  const { subject_id } = req.params;
  const { subject_name, description } = req.body || {};

  if (!isValidId(subject_id)) {
    return sendErrorResponse(
      res,
      400,
      "Valid subject ID is required"
    );
  }

  if (subject_name === undefined && description === undefined) {
    return sendErrorResponse(
      res,
      400,
      "At least one field is required to update"
    );
  }

  if (subject_name !== undefined) {
    if (!subject_name) {
      return sendErrorResponse(
        res,
        400,
        "Subject name is required"
      );
    }

    if (typeof subject_name !== "string") {
      return sendErrorResponse(
        res,
        400,
        "Invalid subject name"
      );
    }

    if (!subject_name.trim()) {
      return sendErrorResponse(
        res,
        400,
        "Subject name is required"
      );
    }

    if (subject_name.trim().length > 100) {
      return sendErrorResponse(
        res,
        400,
        "Subject name cannot exceed 100 characters"
      );
    }
  }

  if (description !== undefined && description !== null) {
    if (typeof description !== "string") {
      return sendErrorResponse(
        res,
        400,
        "Invalid description"
      );
    }
  }

  next();
};