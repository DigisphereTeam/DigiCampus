import { sendErrorResponse } from "../../utils/response.js";
import {
  hasValue,
  isValidId,
} from "../../utils/validation.js";

export const validateBulkCreateClassSections = (
  req,
  res,
  next
) => {
  const {
    academic_year_id,
    sections,
  } = req.body || {};

  if (!isValidId(academic_year_id)) {
    return sendErrorResponse(
      res,
      400,
      "Valid academic year ID is required"
    );
  }

  if (!hasValue(sections)) {
    return sendErrorResponse(
      res,
      400,
      "Sections are required"
    );
  }

  if (!Array.isArray(sections) || sections.length === 0) {
    return sendErrorResponse(
      res,
      400,
      "Sections must be a non-empty array"
    );
  }

  const combinations = new Set();
  const normalizedSections = [];

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];

    if (
      !section ||
      typeof section !== "object" ||
      Array.isArray(section)
    ) {
      return sendErrorResponse(
        res,
        400,
        `Invalid section data at index ${i}`
      );
    }

    const {
      class_id,
      section_id,
      room_number,
    } = section;

    if (!isValidId(class_id)) {
      return sendErrorResponse(
        res,
        400,
        `Valid class ID is required at index ${i}`
      );
    }

    if (!isValidId(section_id)) {
      return sendErrorResponse(
        res,
        400,
        `Valid section ID is required at index ${i}`
      );
    }

    let normalizedRoomNumber = null;

    if (hasValue(room_number)) {
      if (typeof room_number !== "string") {
        return sendErrorResponse(
          res,
          400,
          `Invalid room number at index ${i}`
        );
      }

      normalizedRoomNumber = room_number.trim();

      if (!normalizedRoomNumber) {
        return sendErrorResponse(
          res,
          400,
          `Room number cannot be empty at index ${i}`
        );
      }

      if (normalizedRoomNumber.length > 20) {
        return sendErrorResponse(
          res,
          400,
          `Room number cannot exceed 20 characters at index ${i}`
        );
      }
    }

    const classId = Number(class_id);
    const sectionId = Number(section_id);

    const combination = `${classId}-${sectionId}`;

    if (combinations.has(combination)) {
      return sendErrorResponse(
        res,
        400,
        `Duplicate class and section at index ${i}`
      );
    }

    combinations.add(combination);

    normalizedSections.push({
      class_id: classId,
      section_id: sectionId,
      room_number: normalizedRoomNumber,
    });
  }

  req.body = {
    academic_year_id: Number(academic_year_id),
    sections: normalizedSections,
  };

  next();
};

export const validateCreateClassSection = (
  req,
  res,
  next
) => {
  const {
    academic_year_id,
    class_id,
    section_id,
    room_number,
  } = req.body || {};

  if (!isValidId(academic_year_id)) {
    return sendErrorResponse(
      res,
      400,
      "Valid academic year ID is required"
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

  let normalizedRoomNumber = null;

  if (hasValue(room_number)) {
    if (typeof room_number !== "string") {
      return sendErrorResponse(
        res,
        400,
        "Invalid room number"
      );
    }

    normalizedRoomNumber = room_number.trim();

    if (!normalizedRoomNumber) {
      return sendErrorResponse(
        res,
        400,
        "Room number cannot be empty"
      );
    }

    if (normalizedRoomNumber.length > 20) {
      return sendErrorResponse(
        res,
        400,
        "Room number cannot exceed 20 characters"
      );
    }
  }

  req.body = {
    academic_year_id: Number(academic_year_id),
    class_id: Number(class_id),
    section_id: Number(section_id),
    room_number: normalizedRoomNumber,
  };

  next();
};