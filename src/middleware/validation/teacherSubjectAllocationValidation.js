import { sendErrorResponse } from "../../utils/response";

export const validateCreateTeacherSubjectAllocation = (req, res, next) => {
  const {
    teacher_id,
    academic_year_id,
    class_section_id,
    subject_id,
  } = req.body;

  if (
    teacher_id === undefined ||
    !Number.isInteger(Number(teacher_id)) ||
    Number(teacher_id) <= 0
  ) {
    return sendErrorResponse(res, 422, "Valid teacher ID is required");
  }

  if (
    academic_year_id === undefined ||
    !Number.isInteger(Number(academic_year_id)) ||
    Number(academic_year_id) <= 0
  ) {
    return sendErrorResponse(
      res,
      422,
      "Valid academic year ID is required"
    );
  }

  if (
    class_section_id === undefined ||
    !Number.isInteger(Number(class_section_id)) ||
    Number(class_section_id) <= 0
  ) {
    return sendErrorResponse(
      res,
      422,
      "Valid class section ID is required"
    );
  }

  if (
    subject_id === undefined ||
    !Number.isInteger(Number(subject_id)) ||
    Number(subject_id) <= 0
  ) {
    return sendErrorResponse(res, 422, "Valid subject ID is required");
  }

  next();
};

export const validateAllocationId = (req, res, next) => {
  const { allocation_id } = req.params;

  if (
    !allocation_id ||
    !Number.isInteger(Number(allocation_id)) ||
    Number(allocation_id) <= 0
  ) {
    return sendErrorResponse(
      res,
      422,
      "Valid allocation ID is required"
    );
  }

  next();
};

export const validateUpdateTeacherSubjectAllocation = (
  req,
  res,
  next
) => {
  const {
    teacher_id,
    academic_year_id,
    class_section_id,
    subject_id,
  } = req.body;

  if (
    teacher_id === undefined &&
    academic_year_id === undefined &&
    class_section_id === undefined &&
    subject_id === undefined
  ) {
    return sendErrorResponse(
      res,
      422,
      "At least one field is required for update"
    );
  }

  if (
    teacher_id !== undefined &&
    (!Number.isInteger(Number(teacher_id)) ||
      Number(teacher_id) <= 0)
  ) {
    return sendErrorResponse(res, 422, "Valid teacher ID is required");
  }

  if (
    academic_year_id !== undefined &&
    (!Number.isInteger(Number(academic_year_id)) ||
      Number(academic_year_id) <= 0)
  ) {
    return sendErrorResponse(
      res,
      422,
      "Valid academic year ID is required"
    );
  }

  if (
    class_section_id !== undefined &&
    (!Number.isInteger(Number(class_section_id)) ||
      Number(class_section_id) <= 0)
  ) {
    return sendErrorResponse(
      res,
      422,
      "Valid class section ID is required"
    );
  }

  if (
    subject_id !== undefined &&
    (!Number.isInteger(Number(subject_id)) ||
      Number(subject_id) <= 0)
  ) {
    return sendErrorResponse(
      res,
      422,
      "Valid subject ID is required"
    );
  }

  next();
};