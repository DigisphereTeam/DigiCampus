import { EVENT_STATUSES } from "../../constants/constants.js";
import { getCurrentDate, isValidDate } from "../../utils/date.js";
import { sendErrorResponse } from "../../utils/response.js";

export const validateCreateEvent = (req, res, next) => {
  const { event_name, category, event_date, event_slot, description, status } =
    req.body || {};

  if (!event_name || (typeof event_name === "string" && !event_name.trim())) {
    return sendErrorResponse(res, 400, "Event name is required");
  }

  if (typeof event_name !== "string") {
    return sendErrorResponse(res, 400, "Invalid event name");
  }

  if (!category || (typeof category === "string" && !category.trim())) {
    return sendErrorResponse(res, 400, "Category is required");
  }

  if (typeof category !== "string") {
    return sendErrorResponse(res, 400, "Invalid category");
  }

  if (!event_date) {
    return sendErrorResponse(res, 400, "Event date is required");
  }

  if (!isValidDate(event_date)) {
    return sendErrorResponse(
      res,
      400,
      "Event date must be in YYYY-MM-DD format",
    );
  }

  const currentDate = getCurrentDate();

  if (event_date < currentDate) {
    return sendErrorResponse(
      res,
      400,
      "Event date cannot be in the past",
    );
  }

  if (!event_slot || (typeof event_slot === "string" && !event_slot.trim())) {
    return sendErrorResponse(res, 400, "Event slot is required");
  }

  if (typeof event_slot !== "string") {
    return sendErrorResponse(res, 400, "Invalid event slot");
  }

  if (description !== undefined) {
    if (typeof description !== "string") {
      return sendErrorResponse(res, 400, "Invalid description");
    }

    if (!description.trim()) {
      return sendErrorResponse(res, 400, "Description is required");
    }
  }

  if (status !== undefined && status !== null) {
    if (typeof status !== "string") {
      return sendErrorResponse(res, 400, "Invalid status");
    }

    const normalizedStatus = status.trim().toUpperCase();

    if (!EVENT_STATUSES.includes(normalizedStatus)) {
      return sendErrorResponse(res, 400, "Invalid status");
    }

    req.body.status = normalizedStatus;
  }

  next();
};

export const validateUpdateEvent = (req, res, next) => {
  const { event_name, category, event_date, event_slot, description } =
    req.body || {};

  if (
    event_name === undefined &&
    category === undefined &&
    event_date === undefined &&
    event_slot === undefined &&
    description === undefined
  ) {
    return sendErrorResponse(
      res,
      400,
      "At least one field is required to update the event"
    );
  }

  if (event_name !== undefined) {
    if (typeof event_name !== "string") {
      return sendErrorResponse(res, 400, "Invalid event name");
    }

    if (!event_name.trim()) {
      return sendErrorResponse(res, 400, "Event name is required");
    }
  }

  if (category !== undefined) {
    if (typeof category !== "string") {
      return sendErrorResponse(res, 400, "Invalid category");
    }

    if (!category.trim()) {
      return sendErrorResponse(res, 400, "Category is required");
    }
  }

  if (event_date !== undefined) {
    if (typeof event_date !== "string" || !isValidDate(event_date)) {
      return sendErrorResponse(
        res,
        400,
        "Event date must be in YYYY-MM-DD format",
      );
    }

    if (event_date < getCurrentDate()) {
      return sendErrorResponse(
        res,
        400,
        "Event date cannot be in the past",
      );
    }
  }

  if (event_slot !== undefined) {
    if (typeof event_slot !== "string") {
      return sendErrorResponse(res, 400, "Invalid event slot");
    }

    if (!event_slot.trim()) {
      return sendErrorResponse(res, 400, "Event slot is required");
    }
  }

  if (description !== undefined) {
    if (typeof description !== "string") {
      return sendErrorResponse(res, 400, "Invalid description");
    }

    if (!description.trim()) {
      return sendErrorResponse(res, 400, "Description is required");
    }
  }

  next();
};
