import { sendErrorResponse } from "../../utils/response.js";
import { isValidId } from "../../utils/validation.js";

export const validateCreateSection = (req, res, next) => {
  const { section_name, description } = req.body || {};

  if (
    !section_name ||
    (typeof section_name === "string" && !section_name.trim())
  ) {
    return sendErrorResponse(
      res,
      400,
      "Section name is required"
    );
  }

  if (typeof section_name !== "string") {
    return sendErrorResponse(
      res,
      400,
      "Invalid section name"
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

    if (!description.trim()) {
      return sendErrorResponse(
        res,
        400,
        "Description is required"
      );
    }
  }

  req.body.section_name = section_name.trim();

  if (description !== undefined && description !== null) {
    req.body.description = description.trim();
  }

  next();
};

export const validateUpdateSection = (req, res, next) => {
  const { section_id } = req.params;
  const { section_name, description } = req.body || {};

  if (
    !isValidId(section_id)
  ) {
    return sendErrorResponse(
      res,
      400,
      "Valid section ID is required"
    );
  }

  if (
    section_name === undefined &&
    description === undefined
  ) {
    return sendErrorResponse(
      res,
      400,
      "At least one field is required to update the section"
    );
  }

  if (section_name !== undefined) {
    if (typeof section_name !== "string") {
      return sendErrorResponse(
        res,
        400,
        "Invalid section name"
      );
    }

    if (!section_name.trim()) {
      return sendErrorResponse(
        res,
        400,
        "Section name is required"
      );
    }

    req.body.section_name = section_name.trim();
  }

  if (description !== undefined && description !== null) {
    if (typeof description !== "string") {
      return sendErrorResponse(
        res,
        400,
        "Invalid description"
      );
    }

    if (!description.trim()) {
      return sendErrorResponse(
        res,
        400,
        "Description is required"
      );
    }

    req.body.description = description.trim();
  }

  req.params.section_id = Number(section_id);

  next();
};