import { meetingModes, meetingTypes } from "../../constants/constants.js";
import { hasValue, isValidId } from "../../utils/validation.js";


export const validateCreateMeeting = (req, res, next) => {
  const {
    meeting_type,
    title,
    agenda,
    meeting_date,
    start_time,
    end_time,
    meeting_mode,
    meeting_link,
    location,
    remarks,
    participant_user_ids,
  } = req.body;

  if (!hasValue(meeting_type)) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: "Meeting type is required",
    });
  }

  if (!meetingTypes.includes(String(meeting_type).trim().toUpperCase())) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: "Invalid meeting type",
    });
  }

  if (!hasValue(title)) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: "Meeting title is required",
    });
  }

  if (typeof title !== "string") {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: "Meeting title must be a string",
    });
  }

  if (!hasValue(meeting_date)) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: "Meeting date is required",
    });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(meeting_date).trim())) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: "Meeting date must be in YYYY-MM-DD format",
    });
  }

  if (!hasValue(start_time)) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: "Start time is required",
    });
  }

  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(String(start_time).trim())) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: "Start time must be in HH:MM or HH:MM:SS format",
    });
  }

  if (!hasValue(end_time)) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: "End time is required",
    });
  }

  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(String(end_time).trim())) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: "End time must be in HH:MM or HH:MM:SS format",
    });
  }

  if (!hasValue(meeting_mode)) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: "Meeting mode is required",
    });
  }

  if (!meetingModes.includes(String(meeting_mode).trim().toUpperCase())) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: "Invalid meeting mode",
    });
  }

  if (
    meeting_mode &&
    ["ONLINE", "HYBRID"].includes(
      String(meeting_mode).trim().toUpperCase()
    ) &&
    !hasValue(meeting_link)
  ) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: "Meeting link is required for online or hybrid meetings",
    });
  }

  if (
    meeting_mode &&
    ["OFFLINE", "HYBRID"].includes(
      String(meeting_mode).trim().toUpperCase()
    ) &&
    !hasValue(location)
  ) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: "Location is required for offline or hybrid meetings",
    });
  }

  if (
    participant_user_ids === undefined ||
    participant_user_ids === null ||
    !Array.isArray(participant_user_ids) ||
    participant_user_ids.length === 0
  ) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: "At least one participant is required",
    });
  }

  const participantIds = [];

  for (const userId of participant_user_ids) {
    const normalizedId = Number(userId);

    if (!Number.isInteger(normalizedId) || !isValidId(normalizedId)) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Valid participant user IDs are required",
      });
    }

    participantIds.push(normalizedId);
  }

  if (new Set(participantIds).size !== participantIds.length) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: "Duplicate participant user IDs are not allowed",
    });
  }

  req.body.meeting_type = String(meeting_type).trim().toUpperCase();
  req.body.title = title.trim();
  req.body.meeting_date = String(meeting_date).trim();
  req.body.start_time = String(start_time).trim();
  req.body.end_time = String(end_time).trim();
  req.body.meeting_mode = String(meeting_mode).trim().toUpperCase();
  req.body.participant_user_ids = participantIds;

  if (hasValue(agenda)) {
    if (typeof agenda !== "string") {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Agenda must be a string",
      });
    }

    req.body.agenda = agenda.trim();
  }

  if (hasValue(meeting_link)) {
    if (typeof meeting_link !== "string") {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Meeting link must be a string",
      });
    }

    req.body.meeting_link = meeting_link.trim();
  }

  if (hasValue(location)) {
    if (typeof location !== "string") {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Location must be a string",
      });
    }

    req.body.location = location.trim();
  }

  if (hasValue(remarks)) {
    if (typeof remarks !== "string") {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Remarks must be a string",
      });
    }

    req.body.remarks = remarks.trim();
  }

  next();
};

export const validateUpdateMeeting = (req, res, next) => {
  const {
    title,
    agenda,
    meeting_date,
    start_time,
    end_time,
    meeting_mode,
    meeting_link,
    location,
    remarks,
  } = req.body;

  if (
    !hasValue(title) &&
    !hasValue(agenda) &&
    !hasValue(meeting_date) &&
    !hasValue(start_time) &&
    !hasValue(end_time) &&
    !hasValue(meeting_mode) &&
    !hasValue(meeting_link) &&
    !hasValue(location) &&
    !hasValue(remarks)
  ) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: "At least one field is required for update",
    });
  }

  if (hasValue(title)) {
    if (typeof title !== "string") {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Meeting title must be a string",
      });
    }

    req.body.title = title.trim();
  }

  if (hasValue(agenda)) {
    if (typeof agenda !== "string") {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Agenda must be a string",
      });
    }

    req.body.agenda = agenda.trim();
  }

  if (hasValue(meeting_date)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(meeting_date).trim())) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Meeting date must be in YYYY-MM-DD format",
      });
    }

    req.body.meeting_date = String(meeting_date).trim();
  }

  if (hasValue(start_time)) {
    if (!/^\d{2}:\d{2}(:\d{2})?$/.test(String(start_time).trim())) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Start time must be in HH:MM or HH:MM:SS format",
      });
    }

    req.body.start_time = String(start_time).trim();
  }

  if (hasValue(end_time)) {
    if (!/^\d{2}:\d{2}(:\d{2})?$/.test(String(end_time).trim())) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "End time must be in HH:MM or HH:MM:SS format",
      });
    }

    req.body.end_time = String(end_time).trim();
  }

  if (hasValue(meeting_mode)) {
    const normalizedMode = String(meeting_mode).trim().toUpperCase();

    if (!meetingModes.includes(normalizedMode)) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Invalid meeting mode",
      });
    }

    req.body.meeting_mode = normalizedMode;
  }

  if (hasValue(meeting_link)) {
    if (typeof meeting_link !== "string") {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Meeting link must be a string",
      });
    }

    req.body.meeting_link = meeting_link.trim();
  }

  if (hasValue(location)) {
    if (typeof location !== "string") {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Location must be a string",
      });
    }

    req.body.location = location.trim();
  }

  if (hasValue(remarks)) {
    if (typeof remarks !== "string") {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Remarks must be a string",
      });
    }

    req.body.remarks = remarks.trim();
  }

  next();
};

export const validateMeetingStatus = (req, res, next) => {
  const { status } = req.body;

  if (!hasValue(status)) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: "Meeting status is required",
    });
  }

  const normalizedStatus = String(status).trim().toUpperCase();

  if (!meetingStatuses.includes(normalizedStatus)) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: "Invalid meeting status",
    });
  }

  req.body.status = normalizedStatus;

  next();
};

export const validateParticipantResponse = (req, res, next) => {
  const { response_status } = req.body;

  if (!hasValue(response_status)) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: "Participant response status is required",
    });
  }

  const normalizedStatus = String(response_status)
    .trim()
    .toUpperCase();

  if (!participantResponseStatuses.includes(normalizedStatus)) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: "Invalid participant response status",
    });
  }

  req.body.response_status = normalizedStatus;

  next();
};

export const validateMeetingParticipants = (req, res, next) => {
  const { participant_user_ids } = req.body;

  if (
    !Array.isArray(participant_user_ids) ||
    participant_user_ids.length === 0
  ) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: "At least one participant user ID is required",
    });
  }

  const participantIds = [];

  for (const userId of participant_user_ids) {
    const normalizedId = Number(userId);

    if (!Number.isInteger(normalizedId) || !isValidId(normalizedId)) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Valid participant user IDs are required",
      });
    }

    participantIds.push(normalizedId);
  }

  if (new Set(participantIds).size !== participantIds.length) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: "Duplicate participant user IDs are not allowed",
    });
  }

  req.body.participant_user_ids = participantIds;

  next();
};