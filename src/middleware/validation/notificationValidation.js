import { sendErrorResponse } from "../../utils/response.js";
import { hasValue, isValidId } from "../../utils/validation.js";

const notificationTypes = [
  "GENERAL",
  "ANNOUNCEMENT",
  "ATTENDANCE",
  "ASSIGNMENT",
  "EXAM",
  "RESULT",
  "FEE",
  "LEAVE",
  "EVENT",
  "MEETING",
  "LIBRARY",
  "TRANSPORT"
];

const notificationSources = [
  "MANUAL",
  "AUTOMATIC"
];

const notificationTargetTypes = [
  "ALL_USERS",
  "ROLE",
  "CLASS_SECTION",
  "USER"
];

const userRoles = [
  "SUPER_ADMIN",
  "ADMIN",
  "TEACHER",
  "ACCOUNTANT",
  "STAFF",
  "STUDENT",
  "PARENT"
];

export const validateCreateNotification = (req, res, next) => {
  let {
    title,
    message,
    notification_type,
    source,
    reference_id,
    reference_type,
    targets
  } = req.body;

  if (!hasValue(title)) {
    return sendErrorResponse(res, 400, "Notification title is required");
  }

  if (typeof title !== "string") {
    return sendErrorResponse(
      res,
      400,
      "Notification title must be a string"
    );
  }

  title = title.trim();

  if (!title) {
    return sendErrorResponse(res, 400, "Notification title is required");
  }

  if (title.length > 255) {
    return sendErrorResponse(
      res,
      400,
      "Notification title cannot exceed 255 characters"
    );
  }

  if (!hasValue(message)) {
    return sendErrorResponse(res, 400, "Notification message is required");
  }

  if (typeof message !== "string") {
    return sendErrorResponse(
      res,
      400,
      "Notification message must be a string"
    );
  }

  message = message.trim();

  if (!message) {
    return sendErrorResponse(res, 400, "Notification message is required");
  }

  if (!hasValue(notification_type)) {
    return sendErrorResponse(
      res,
      400,
      "Notification type is required"
    );
  }

  if (typeof notification_type !== "string") {
    return sendErrorResponse(
      res,
      400,
      "Notification type must be a string"
    );
  }

  notification_type = notification_type.trim().toUpperCase();

  if (!notificationTypes.includes(notification_type)) {
    return sendErrorResponse(
      res,
      400,
      "Invalid notification type"
    );
  }

  if (!hasValue(source)) {
    source = "MANUAL";
  }

  if (typeof source !== "string") {
    return sendErrorResponse(
      res,
      400,
      "Notification source must be a string"
    );
  }

  source = source.trim().toUpperCase();

  if (!notificationSources.includes(source)) {
    return sendErrorResponse(
      res,
      400,
      "Invalid notification source"
    );
  }

  if (hasValue(reference_id) && !isValidId(reference_id)) {
    return sendErrorResponse(
      res,
      400,
      "Valid reference ID is required"
    );
  }

  if (hasValue(reference_type)) {
    if (typeof reference_type !== "string") {
      return sendErrorResponse(
        res,
        400,
        "Reference type must be a string"
      );
    }

    reference_type = reference_type.trim();

    if (!reference_type) {
      reference_type = null;
    }
  }

  if (!Array.isArray(targets) || targets.length === 0) {
    return sendErrorResponse(
      res,
      400,
      "Notification targets are required"
    );
  }

  const normalizedTargets = [];

  for (const notificationTarget of targets) {
    if (!notificationTarget || typeof notificationTarget !== "object") {
      return sendErrorResponse(
        res,
        400,
        "Invalid notification target"
      );
    }

    let {
      target_type,
      target_role,
      class_section_id,
      target_user_id
    } = notificationTarget;

    if (!hasValue(target_type)) {
      return sendErrorResponse(
        res,
        400,
        "Notification target type is required"
      );
    }

    if (typeof target_type !== "string") {
      return sendErrorResponse(
        res,
        400,
        "Notification target type must be a string"
      );
    }

    target_type = target_type.trim().toUpperCase();

    if (!notificationTargetTypes.includes(target_type)) {
      return sendErrorResponse(
        res,
        400,
        "Invalid notification target type"
      );
    }

    if (target_type === "ALL_USERS") {
      normalizedTargets.push({
        target_type,
        target_role: null,
        class_section_id: null,
        target_user_id: null
      });

      continue;
    }

    if (target_type === "ROLE") {
      if (!hasValue(target_role)) {
        return sendErrorResponse(
          res,
          400,
          "Target role is required"
        );
      }

      if (typeof target_role !== "string") {
        return sendErrorResponse(
          res,
          400,
          "Target role must be a string"
        );
      }

      target_role = target_role.trim().toUpperCase();

      if (!userRoles.includes(target_role)) {
        return sendErrorResponse(
          res,
          400,
          "Invalid target role"
        );
      }

      normalizedTargets.push({
        target_type,
        target_role,
        class_section_id: null,
        target_user_id: null
      });

      continue;
    }

    if (target_type === "CLASS_SECTION") {
      if (!isValidId(class_section_id)) {
        return sendErrorResponse(
          res,
          400,
          "Valid class section ID is required"
        );
      }

      normalizedTargets.push({
        target_type,
        target_role: null,
        class_section_id,
        target_user_id: null
      });

      continue;
    }

    if (target_type === "USER") {
      if (!isValidId(target_user_id)) {
        return sendErrorResponse(
          res,
          400,
          "Valid target user ID is required"
        );
      }

      normalizedTargets.push({
        target_type,
        target_role: null,
        class_section_id: null,
        target_user_id
      });
    }
  }

  req.body = {
    title,
    message,
    notification_type,
    source,
    reference_id: hasValue(reference_id)
      ? reference_id
      : null,
    reference_type: hasValue(reference_type)
      ? reference_type
      : null,
    targets: normalizedTargets
  };

  next();
};

export const validateNotificationQuery = (req, res, next) => {
  let {
    page = 1,
    limit = 10,
    search,
    notification_type,
    source,
    target_type
  } = req.query;

  page = Number(page);
  limit = Number(limit);

  if (!Number.isInteger(page) || page < 1) {
    return sendErrorResponse(
      res,
      400,
      "Valid page number is required"
    );
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return sendErrorResponse(
      res,
      400,
      "Limit must be between 1 and 100"
    );
  }

  if (hasValue(search)) {
    if (typeof search !== "string") {
      return sendErrorResponse(
        res,
        400,
        "Search must be a string"
      );
    }

    search = search.trim();
  } else {
    search = "";
  }

  if (hasValue(notification_type)) {
    if (typeof notification_type !== "string") {
      return sendErrorResponse(
        res,
        400,
        "Notification type must be a string"
      );
    }

    notification_type = notification_type.trim().toUpperCase();

    if (!notificationTypes.includes(notification_type)) {
      return sendErrorResponse(
        res,
        400,
        "Invalid notification type"
      );
    }
  } else {
    notification_type = "";
  }

  if (hasValue(source)) {
    if (typeof source !== "string") {
      return sendErrorResponse(
        res,
        400,
        "Notification source must be a string"
      );
    }

    source = source.trim().toUpperCase();

    if (!notificationSources.includes(source)) {
      return sendErrorResponse(
        res,
        400,
        "Invalid notification source"
      );
    }
  } else {
    source = "";
  }

  if (hasValue(target_type)) {
    if (typeof target_type !== "string") {
      return sendErrorResponse(
        res,
        400,
        "Target type must be a string"
      );
    }

    target_type = target_type.trim().toUpperCase();

    if (!notificationTargetTypes.includes(target_type)) {
      return sendErrorResponse(
        res,
        400,
        "Invalid target type"
      );
    }
  } else {
    target_type = "";
  }

  req.query = {
    page,
    limit,
    search,
    notification_type,
    source,
    target_type
  };

  next();
};