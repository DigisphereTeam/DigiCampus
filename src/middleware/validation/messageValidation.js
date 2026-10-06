import { sendErrorResponse } from "../../utils/response";
import { hasValue } from "../../utils/validation";


export const validateCreateConversation = (
  req,
  res,
  next
) => {
  const {
    participant_ids,
    message,
  } = req.body;

  if (
    !Array.isArray(participant_ids) ||
    participant_ids.length === 0
  ) {
    return sendErrorResponse(
      res,
      400,
      "Participant IDs are required"
    );
  }

  if (
    participant_ids.some(
      (participantId) =>
        !Number.isInteger(Number(participantId)) ||
        Number(participantId) <= 0
    )
  ) {
    return sendErrorResponse(
      res,
      400,
      "All participant IDs must be valid"
    );
  }

  req.body.participant_ids = [
    ...new Set(
      participant_ids.map((participantId) =>
        Number(participantId)
      )
    ),
  ];

  if (hasValue(message)) {
    if (typeof message !== "string") {
      return sendErrorResponse(
        res,
        400,
        "Message must be a string"
      );
    }

    const trimmedMessage = message.trim();

    if (!trimmedMessage) {
      return sendErrorResponse(
        res,
        400,
        "Message cannot be empty"
      );
    }

    if (trimmedMessage.length > 5000) {
      return sendErrorResponse(
        res,
        400,
        "Message must not exceed 5000 characters"
      );
    }

    req.body.message = trimmedMessage;
  }

  if (
    !hasValue(message) &&
    req.body.participant_ids.length < 2
  ) {
    return sendErrorResponse(
      res,
      400,
      "At least one participant is required"
    );
  }

  next();
};

export const validateSendMessage = (
  req,
  res,
  next
) => {
  const {
    message,
    attachment_url,
  } = req.body;

  if (!hasValue(message) && !hasValue(attachment_url)) {
    return sendErrorResponse(
      res,
      400,
      "Message or attachment is required"
    );
  }

  if (hasValue(message)) {
    if (typeof message !== "string") {
      return sendErrorResponse(
        res,
        400,
        "Message must be a string"
      );
    }

    const trimmedMessage = message.trim();

    if (!trimmedMessage) {
      return sendErrorResponse(
        res,
        400,
        "Message cannot be empty"
      );
    }

    if (trimmedMessage.length > 5000) {
      return sendErrorResponse(
        res,
        400,
        "Message must not exceed 5000 characters"
      );
    }

    req.body.message = trimmedMessage;
  }

  if (hasValue(attachment_url)) {
    if (typeof attachment_url !== "string") {
      return sendErrorResponse(
        res,
        400,
        "Attachment URL must be a string"
      );
    }

    const attachmentUrl = attachment_url.trim();

    if (!attachmentUrl) {
      return sendErrorResponse(
        res,
        400,
        "Attachment URL cannot be empty"
      );
    }

    if (attachmentUrl.length > 1000) {
      return sendErrorResponse(
        res,
        400,
        "Attachment URL must not exceed 1000 characters"
      );
    }

    req.body.attachment_url = attachmentUrl;
  }

  next();
};