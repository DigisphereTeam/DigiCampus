import pool from "../config/database.js";
import { getCurrentDate } from "../utils/date.js";

import {
  sendErrorResponse,
  sendSuccessResponse,
} from "../utils/response.js";

import { hasValue, isValidId } from "../utils/validation.js";

export const createMeeting = async (req, res) => {
  const client = await pool.connect();

  try {
    const organizer_user_id = req.user.user_id;

    const {
      participant_user_ids,
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
    } = req.body;

    if (!isValidId(organizer_user_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid organizer user ID is required"
      );
    }

    const organizerResult = await client.query(
      `
      SELECT user_id, role, is_active
      FROM tbl_users
      WHERE user_id = $1
      `,
      [organizer_user_id]
    );

    if (organizerResult.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `User with ID ${organizer_user_id} not found`
      );
    }

    if (!organizerResult.rows[0].is_active) {
      return sendErrorResponse(
        res,
        400,
        "Organizer user is inactive"
      );
    }

    const participantResult = await client.query(
      `
      SELECT user_id, role, is_active
      FROM tbl_users
      WHERE user_id = ANY($1::int[])
      `,
      [participant_user_ids]
    );

    if (
      participantResult.rows.length !==
      participant_user_ids.length
    ) {
      return sendErrorResponse(
        res,
        404,
        "One or more participant users were not found"
      );
    }

    const inactiveParticipant = participantResult.rows.find(
      (participant) => !participant.is_active
    );

    if (inactiveParticipant) {
      return sendErrorResponse(
        res,
        400,
        `Participant user with ID ${inactiveParticipant.user_id} is inactive`
      );
    }

    if (participant_user_ids.includes(organizer_user_id)) {
      return sendErrorResponse(
        res,
        400,
        "Organizer cannot be a participant"
      );
    }

    await client.query("BEGIN");

    const meetingResult = await client.query(
      `
      INSERT INTO tbl_meetings (
        organizer_user_id,
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
        status
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'PENDING'
      )
      RETURNING
        meeting_id,
        organizer_user_id,
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
        status,
        created_at,
        updated_at
      `,
      [
        organizer_user_id,
        meeting_type,
        title,
        agenda || null,
        meeting_date,
        start_time,
        end_time || null,
        meeting_mode,
        meeting_link || null,
        location || null,
        remarks || null,
      ]
    );

    const meeting = meetingResult.rows[0];

    const participantValues = [];
    const participantPlaceholders = [];

    participant_user_ids.forEach((userId, index) => {
      const baseIndex = index * 2;

      participantValues.push(
        meeting.meeting_id,
        userId
      );

      participantPlaceholders.push(
        `($${baseIndex + 1}, $${baseIndex + 2}, 'PENDING')`
      );
    });

    await client.query(
      `
      INSERT INTO tbl_meeting_participants (
        meeting_id,
        user_id,
        response_status
      )
      VALUES ${participantPlaceholders.join(", ")}
      `,
      participantValues
    );

    await client.query("COMMIT");

    const participantsResult = await pool.query(
      `
      SELECT
        mp.meeting_participant_id,
        mp.user_id,
        u.name AS participant_name,
        u.role AS participant_role,
        mp.response_status
      FROM tbl_meeting_participants mp
      INNER JOIN tbl_users u
        ON u.user_id = mp.user_id
      WHERE mp.meeting_id = $1
      ORDER BY mp.meeting_participant_id
      `,
      [meeting.meeting_id]
    );

    return sendSuccessResponse(
      res,
      201,
      "Meeting created successfully",
      {
        ...meeting,
        participants: participantsResult.rows,
      }
    );
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Create meeting error:", error);

    return sendErrorResponse(
      res,
      500,
      "Failed to create meeting"
    );
  } finally {
    client.release();
  }
};

export const getAllMeetings = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      meeting_type,
      meeting_date,
      organizer_user_id,
      participant_user_id,
    } = req.query;

    const pageNumber = Number(page);
    const limitNumber = Number(limit);

    if (
      !Number.isInteger(pageNumber) ||
      pageNumber <= 0
    ) {
      return sendErrorResponse(
        res,
        400,
        "Valid page is required"
      );
    }

    if (
      !Number.isInteger(limitNumber) ||
      limitNumber <= 0 ||
      limitNumber > 100
    ) {
      return sendErrorResponse(
        res,
        400,
        "Limit must be between 1 and 100"
      );
    }

    if (
      hasValue(organizer_user_id) &&
      !isValidId(organizer_user_id)
    ) {
      return sendErrorResponse(
        res,
        400,
        "Valid organizer user ID is required"
      );
    }

    if (
      hasValue(participant_user_id) &&
      !isValidId(participant_user_id)
    ) {
      return sendErrorResponse(
        res,
        400,
        "Valid participant user ID is required"
      );
    }

    const offset = (pageNumber - 1) * limitNumber;

    const conditions = [];
    const values = [];

    if (hasValue(search)) {
      values.push(`%${search.trim()}%`);

      conditions.push(`
        (
          LOWER(m.title) LIKE LOWER($${values.length})
          OR LOWER(m.agenda) LIKE LOWER($${values.length})
        )
      `);
    }

    if (hasValue(status)) {
      values.push(status);

      conditions.push(
        `m.status = $${values.length}`
      );
    }

    if (hasValue(meeting_type)) {
      values.push(meeting_type);

      conditions.push(
        `m.meeting_type = $${values.length}`
      );
    }

    if (hasValue(meeting_date)) {
      values.push(meeting_date);

      conditions.push(
        `m.meeting_date = $${values.length}`
      );
    }

    if (hasValue(organizer_user_id)) {
      values.push(organizer_user_id);

      conditions.push(
        `m.organizer_user_id = $${values.length}`
      );
    }

    if (hasValue(participant_user_id)) {
      values.push(participant_user_id);

      conditions.push(`
        EXISTS (
          SELECT 1
          FROM tbl_meeting_participants mp_filter
          WHERE mp_filter.meeting_id = m.meeting_id
            AND mp_filter.user_id = $${values.length}
        )
      `);
    }

    const whereClause =
      conditions.length > 0
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

    const countResult = await pool.query(
      `
      SELECT COUNT(*) AS total
      FROM tbl_meetings m
      ${whereClause}
      `,
      values
    );

    const totalRecords = Number(
      countResult.rows[0].total
    );

    const dataValues = [
      ...values,
      limitNumber,
      offset,
    ];

    const result = await pool.query(
      `
      SELECT
        m.meeting_id,
        m.organizer_user_id,
        organizer.name AS organizer_name,
        organizer.role AS organizer_role,
        m.meeting_type,
        m.title,
        m.agenda,
        m.meeting_date,
        m.start_time,
        m.end_time,
        m.meeting_mode,
        m.meeting_link,
        m.location,
        m.remarks,
        m.status,
        m.created_at,
        m.updated_at,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'meeting_participant_id',
              mp.meeting_participant_id,
              'user_id',
              mp.user_id,
              'participant_name',
              participant.name,
              'participant_role',
              participant.role,
              'response_status',
              mp.response_status
            )
            ORDER BY mp.meeting_participant_id
          ) FILTER (WHERE mp.meeting_participant_id IS NOT NULL),
          '[]'
        ) AS participants
      FROM tbl_meetings m
      INNER JOIN tbl_users organizer
        ON organizer.user_id = m.organizer_user_id
      LEFT JOIN tbl_meeting_participants mp
        ON mp.meeting_id = m.meeting_id
      LEFT JOIN tbl_users participant
        ON participant.user_id = mp.user_id
      ${whereClause}
      GROUP BY
        m.meeting_id,
        organizer.user_id,
        organizer.name,
        organizer.role
      ORDER BY
        m.meeting_date DESC,
        m.start_time DESC
      LIMIT $${dataValues.length - 1}
      OFFSET $${dataValues.length}
      `,
      dataValues
    );

    const totalPages =
      totalRecords > 0
        ? Math.ceil(totalRecords / limitNumber)
        : 0;

    return sendSuccessResponse(
      res,
      200,
      "Meetings retrieved successfully",
      {
        meetings: result.rows,
        filters: {
          search: hasValue(search)
            ? search.trim()
            : null,
          status: hasValue(status)
            ? status
            : null,
          meeting_type: hasValue(meeting_type)
            ? meeting_type
            : null,
          meeting_date: hasValue(meeting_date)
            ? meeting_date
            : null,
          organizer_user_id: hasValue(
            organizer_user_id
          )
            ? Number(organizer_user_id)
            : null,
          participant_user_id: hasValue(
            participant_user_id
          )
            ? Number(participant_user_id)
            : null,
        },
        pagination_info: {
          current_page: pageNumber,
          per_page: limitNumber,
          total_records: totalRecords,
          total_pages: totalPages,
          has_previous_page: pageNumber > 1,
          has_next_page: pageNumber < totalPages,
          previous_page:
            pageNumber > 1
              ? pageNumber - 1
              : null,
          next_page:
            pageNumber < totalPages
              ? pageNumber + 1
              : null,
        },
      }
    );
  } catch (error) {
    console.error("Get all meetings error:", error);

    return sendErrorResponse(
      res,
      500,
      "Failed to retrieve meetings"
    );
  }
};

export const getMeetingById = async (req, res) => {
  try {
    const { meeting_id } = req.params;

    if (!isValidId(meeting_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid meeting ID is required"
      );
    }

    const result = await pool.query(
      `
      SELECT
        m.meeting_id,
        m.organizer_user_id,
        organizer.name AS organizer_name,
        organizer.role AS organizer_role,
        m.meeting_type,
        m.title,
        m.agenda,
        m.meeting_date,
        m.start_time,
        m.end_time,
        m.meeting_mode,
        m.meeting_link,
        m.location,
        m.remarks,
        m.status,
        m.created_at,
        m.updated_at,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'meeting_participant_id',
              mp.meeting_participant_id,
              'user_id',
              mp.user_id,
              'participant_name',
              participant.name,
              'participant_role',
              participant.role,
              'response_status',
              mp.response_status
            )
            ORDER BY mp.meeting_participant_id
          ) FILTER (WHERE mp.meeting_participant_id IS NOT NULL),
          '[]'
        ) AS participants
      FROM tbl_meetings m
      INNER JOIN tbl_users organizer
        ON organizer.user_id = m.organizer_user_id
      LEFT JOIN tbl_meeting_participants mp
        ON mp.meeting_id = m.meeting_id
      LEFT JOIN tbl_users participant
        ON participant.user_id = mp.user_id
      WHERE m.meeting_id = $1
      GROUP BY
        m.meeting_id,
        organizer.user_id,
        organizer.name,
        organizer.role
      `,
      [meeting_id]
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Meeting with ID ${meeting_id} not found`
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Meeting retrieved successfully",
      result.rows[0]
    );
  } catch (error) {
    console.error("Get meeting by ID error:", error);

    return sendErrorResponse(
      res,
      500,
      "Failed to retrieve meeting"
    );
  }
};

export const updateMeeting = async (req, res) => {
  try {
    const { meeting_id } = req.params;

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

    if (!isValidId(meeting_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid meeting ID is required"
      );
    }

    const existingMeeting = await pool.query(
      `
      SELECT meeting_id, status
      FROM tbl_meetings
      WHERE meeting_id = $1
      `,
      [meeting_id]
    );

    if (existingMeeting.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Meeting with ID ${meeting_id} not found`
      );
    }

    if (
      ["COMPLETED", "CANCELLED"].includes(
        existingMeeting.rows[0].status
      )
    ) {
      return sendErrorResponse(
        res,
        400,
        "Completed or cancelled meetings cannot be updated"
      );
    }

    const fields = [];
    const values = [];

    if (hasValue(title)) {
      values.push(title.trim());
      fields.push(`title = $${values.length}`);
    }

    if (hasValue(agenda)) {
      values.push(agenda.trim());
      fields.push(`agenda = $${values.length}`);
    }

    if (hasValue(meeting_date)) {
      values.push(meeting_date);
      fields.push(`meeting_date = $${values.length}`);
    }

    if (hasValue(start_time)) {
      values.push(start_time);
      fields.push(`start_time = $${values.length}`);
    }

    if (hasValue(end_time)) {
      values.push(end_time);
      fields.push(`end_time = $${values.length}`);
    }

    if (hasValue(meeting_mode)) {
      values.push(meeting_mode);
      fields.push(`meeting_mode = $${values.length}`);
    }

    if (hasValue(meeting_link)) {
      values.push(meeting_link.trim());
      fields.push(`meeting_link = $${values.length}`);
    }

    if (hasValue(location)) {
      values.push(location.trim());
      fields.push(`location = $${values.length}`);
    }

    if (hasValue(remarks)) {
      values.push(remarks.trim());
      fields.push(`remarks = $${values.length}`);
    }

    if (fields.length === 0) {
      return sendErrorResponse(
        res,
        400,
        "At least one field is required for update"
      );
    }

    fields.push("updated_at = CURRENT_TIMESTAMP");

    values.push(meeting_id);

    const result = await pool.query(
      `
      UPDATE tbl_meetings
      SET ${fields.join(", ")}
      WHERE meeting_id = $${values.length}
      RETURNING *
      `,
      values
    );

    return sendSuccessResponse(
      res,
      200,
      "Meeting updated successfully",
      result.rows[0]
    );
  } catch (error) {
    console.error("Update meeting error:", error);

    return sendErrorResponse(
      res,
      500,
      "Failed to update meeting"
    );
  }
};

export const updateMeetingStatus = async (req, res) => {
  try {
    const { meeting_id } = req.params;
    const { status } = req.body;

    if (!isValidId(meeting_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid meeting ID is required"
      );
    }

    const existingMeeting = await pool.query(
      `
      SELECT meeting_id, status
      FROM tbl_meetings
      WHERE meeting_id = $1
      `,
      [meeting_id]
    );

    if (existingMeeting.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Meeting with ID ${meeting_id} not found`
      );
    }

    const result = await pool.query(
      `
      UPDATE tbl_meetings
      SET
        status = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE meeting_id = $2
      RETURNING *
      `,
      [status, meeting_id]
    );

    return sendSuccessResponse(
      res,
      200,
      "Meeting status updated successfully",
      result.rows[0]
    );
  } catch (error) {
    console.error("Update meeting status error:", error);

    return sendErrorResponse(
      res,
      500,
      "Failed to update meeting status"
    );
  }
};

export const updateParticipantResponse = async (req, res) => {
  try {
    const {
      meeting_id,
      user_id,
    } = req.params;

    const { response_status } = req.body;

    if (!isValidId(meeting_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid meeting ID is required"
      );
    }

    if (!isValidId(user_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid user ID is required"
      );
    }

    const participantResult = await pool.query(
      `
      SELECT
        mp.meeting_participant_id,
        mp.meeting_id,
        mp.user_id,
        mp.response_status,
        m.status AS meeting_status
      FROM tbl_meeting_participants mp
      INNER JOIN tbl_meetings m
        ON m.meeting_id = mp.meeting_id
      WHERE
        mp.meeting_id = $1
        AND mp.user_id = $2
      `,
      [meeting_id, user_id]
    );

    if (participantResult.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        "Meeting participant not found"
      );
    }

    if (
      ["COMPLETED", "CANCELLED"].includes(
        participantResult.rows[0].meeting_status
      )
    ) {
      return sendErrorResponse(
        res,
        400,
        "Participant response cannot be updated for this meeting"
      );
    }

    const result = await pool.query(
      `
      UPDATE tbl_meeting_participants
      SET
        response_status = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE
        meeting_id = $2
        AND user_id = $3
      RETURNING
        meeting_participant_id,
        meeting_id,
        user_id,
        response_status,
        updated_at
      `,
      [
        response_status,
        meeting_id,
        user_id,
      ]
    );

    return sendSuccessResponse(
      res,
      200,
      "Participant response updated successfully",
      result.rows[0]
    );
  } catch (error) {
    console.error(
      "Update participant response error:",
      error
    );

    return sendErrorResponse(
      res,
      500,
      "Failed to update participant response"
    );
  }
};

export const addMeetingParticipants = async (req, res) => {
  try {
    const { meeting_id } = req.params;
    const { participant_user_ids } = req.body;

    if (!isValidId(meeting_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid meeting ID is required"
      );
    }

    const meetingResult = await pool.query(
      `
      SELECT meeting_id, organizer_user_id, status
      FROM tbl_meetings
      WHERE meeting_id = $1
      `,
      [meeting_id]
    );

    if (meetingResult.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Meeting with ID ${meeting_id} not found`
      );
    }

    if (
      ["COMPLETED", "CANCELLED"].includes(
        meetingResult.rows[0].status
      )
    ) {
      return sendErrorResponse(
        res,
        400,
        "Participants cannot be added to this meeting"
      );
    }

    if (
      participant_user_ids.includes(
        meetingResult.rows[0].organizer_user_id
      )
    ) {
      return sendErrorResponse(
        res,
        400,
        "Organizer cannot be added as a participant"
      );
    }

    const participantResult = await pool.query(
      `
      SELECT user_id, is_active
      FROM tbl_users
      WHERE user_id = ANY($1::int[])
      `,
      [participant_user_ids]
    );

    if (
      participantResult.rows.length !==
      participant_user_ids.length
    ) {
      return sendErrorResponse(
        res,
        404,
        "One or more participant users were not found"
      );
    }

    const inactiveParticipant = participantResult.rows.find(
      (participant) => !participant.is_active
    );

    if (inactiveParticipant) {
      return sendErrorResponse(
        res,
        400,
        `Participant user with ID ${inactiveParticipant.user_id} is inactive`
      );
    }

    const existingParticipants = await pool.query(
      `
      SELECT user_id
      FROM tbl_meeting_participants
      WHERE
        meeting_id = $1
        AND user_id = ANY($2::int[])
      `,
      [
        meeting_id,
        participant_user_ids,
      ]
    );

    if (existingParticipants.rows.length > 0) {
      return sendErrorResponse(
        res,
        409,
        "One or more users are already participants in this meeting"
      );
    }

    const values = [];
    const placeholders = [];

    participant_user_ids.forEach((userId, index) => {
      const baseIndex = index * 3;

      values.push(
        meeting_id,
        userId,
        "PENDING"
      );

      placeholders.push(
        `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3})`
      );
    });

    const result = await pool.query(
      `
      INSERT INTO tbl_meeting_participants (
        meeting_id,
        user_id,
        response_status
      )
      VALUES ${placeholders.join(", ")}
      RETURNING
        meeting_participant_id,
        meeting_id,
        user_id,
        response_status,
        created_at,
        updated_at
      `,
      values
    );

    return sendSuccessResponse(
      res,
      201,
      "Meeting participants added successfully",
      result.rows
    );
  } catch (error) {
    console.error(
      "Add meeting participants error:",
      error
    );

    return sendErrorResponse(
      res,
      500,
      "Failed to add meeting participants"
    );
  }
};

export const removeMeetingParticipant = async (req, res) => {
  try {
    const {
      meeting_id,
      user_id,
    } = req.params;

    if (!isValidId(meeting_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid meeting ID is required"
      );
    }

    if (!isValidId(user_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid user ID is required"
      );
    }

    const meetingResult = await pool.query(
      `
      SELECT meeting_id, status
      FROM tbl_meetings
      WHERE meeting_id = $1
      `,
      [meeting_id]
    );

    if (meetingResult.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Meeting with ID ${meeting_id} not found`
      );
    }

    if (
      ["COMPLETED", "CANCELLED"].includes(
        meetingResult.rows[0].status
      )
    ) {
      return sendErrorResponse(
        res,
        400,
        "Participant cannot be removed from this meeting"
      );
    }

    const result = await pool.query(
      `
      DELETE FROM tbl_meeting_participants
      WHERE
        meeting_id = $1
        AND user_id = $2
      RETURNING
        meeting_participant_id,
        meeting_id,
        user_id
      `,
      [meeting_id, user_id]
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        "Meeting participant not found"
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Meeting participant removed successfully",
      result.rows[0]
    );
  } catch (error) {
    console.error(
      "Remove meeting participant error:",
      error
    );

    return sendErrorResponse(
      res,
      500,
      "Failed to remove meeting participant"
    );
  }
};

export const cancelMeeting = async (req, res) => {
  try {
    const { meeting_id } = req.params;

    if (!isValidId(meeting_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid meeting ID is required"
      );
    }

    const existingMeeting = await pool.query(
      `
      SELECT meeting_id, status
      FROM tbl_meetings
      WHERE meeting_id = $1
      `,
      [meeting_id]
    );

    if (existingMeeting.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Meeting with ID ${meeting_id} not found`
      );
    }

    if (existingMeeting.rows[0].status === "CANCELLED") {
      return sendErrorResponse(
        res,
        400,
        "Meeting is already cancelled"
      );
    }

    if (existingMeeting.rows[0].status === "COMPLETED") {
      return sendErrorResponse(
        res,
        400,
        "Completed meeting cannot be cancelled"
      );
    }

    const result = await pool.query(
      `
      UPDATE tbl_meetings
      SET
        status = 'CANCELLED',
        updated_at = CURRENT_TIMESTAMP
      WHERE meeting_id = $1
      RETURNING *
      `,
      [meeting_id]
    );

    return sendSuccessResponse(
      res,
      200,
      "Meeting cancelled successfully",
      result.rows[0]
    );
  } catch (error) {
    console.error("Cancel meeting error:", error);

    return sendErrorResponse(
      res,
      500,
      "Failed to cancel meeting"
    );
  }
};

export const getMyMeetings = async (req, res) => {
  try {
    const userId = req.user.user_id;

    if (!isValidId(userId)) {
      return sendErrorResponse(
        res,
        400,
        "Valid user ID is required"
      );
    }

    const result = await pool.query(
      `
      SELECT
        m.meeting_id,
        m.organizer_user_id,
        organizer.name AS organizer_name,
        organizer.role AS organizer_role,
        m.meeting_type,
        m.title,
        m.agenda,
        m.meeting_date,
        m.start_time,
        m.end_time,
        m.meeting_mode,
        m.meeting_link,
        m.location,
        m.remarks,
        m.status,
        m.created_at,
        m.updated_at,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'meeting_participant_id',
              mp.meeting_participant_id,
              'user_id',
              mp.user_id,
              'participant_name',
              participant.name,
              'participant_role',
              participant.role,
              'response_status',
              mp.response_status
            )
            ORDER BY mp.meeting_participant_id
          ) FILTER (WHERE mp.meeting_participant_id IS NOT NULL),
          '[]'
        ) AS participants
      FROM tbl_meetings m
      INNER JOIN tbl_users organizer
        ON organizer.user_id = m.organizer_user_id
      LEFT JOIN tbl_meeting_participants mp
        ON mp.meeting_id = m.meeting_id
      LEFT JOIN tbl_users participant
        ON participant.user_id = mp.user_id
      WHERE
        m.organizer_user_id = $1
        OR EXISTS (
          SELECT 1
          FROM tbl_meeting_participants mp_user
          WHERE
            mp_user.meeting_id = m.meeting_id
            AND mp_user.user_id = $1
        )
      GROUP BY
        m.meeting_id,
        organizer.user_id,
        organizer.name,
        organizer.role
      ORDER BY
        m.meeting_date DESC,
        m.start_time DESC
      `,
      [userId]
    );

    return sendSuccessResponse(
      res,
      200,
      "My meetings retrieved successfully",
      result.rows
    );
  } catch (error) {
    console.error("Get my meetings error:", error);

    return sendErrorResponse(
      res,
      500,
      "Failed to retrieve my meetings"
    );
  }
};

export const getUpcomingMeetings = async (req, res) => {
  try {
    const userId = req.user.user_id;

    if (!isValidId(userId)) {
      return sendErrorResponse(
        res,
        400,
        "Valid user ID is required"
      );
    }

    const result = await pool.query(
      `
      SELECT
        m.meeting_id,
        m.organizer_user_id,
        organizer.name AS organizer_name,
        organizer.role AS organizer_role,
        m.meeting_type,
        m.title,
        m.agenda,
        m.meeting_date,
        m.start_time,
        m.end_time,
        m.meeting_mode,
        m.meeting_link,
        m.location,
        m.status,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'meeting_participant_id',
              mp.meeting_participant_id,
              'user_id',
              mp.user_id,
              'participant_name',
              participant.name,
              'participant_role',
              participant.role,
              'response_status',
              mp.response_status
            )
            ORDER BY mp.meeting_participant_id
          ) FILTER (WHERE mp.meeting_participant_id IS NOT NULL),
          '[]'
        ) AS participants
      FROM tbl_meetings m
      INNER JOIN tbl_users organizer
        ON organizer.user_id = m.organizer_user_id
      LEFT JOIN tbl_meeting_participants mp
        ON mp.meeting_id = m.meeting_id
      LEFT JOIN tbl_users participant
        ON participant.user_id = mp.user_id
      WHERE
        (
          m.organizer_user_id = $1
          OR EXISTS (
            SELECT 1
            FROM tbl_meeting_participants mp_user
            WHERE
              mp_user.meeting_id = m.meeting_id
              AND mp_user.user_id = $1
          )
        )
        AND m.meeting_date >= $2
        AND m.status IN (
          'PENDING',
          'APPROVED',
          'SCHEDULED'
        )
      GROUP BY
        m.meeting_id,
        organizer.user_id,
        organizer.name,
        organizer.role
      ORDER BY
        m.meeting_date ASC,
        m.start_time ASC
      `,
      [userId, getCurrentDate()]
    );

    return sendSuccessResponse(
      res,
      200,
      "Upcoming meetings retrieved successfully",
      result.rows
    );
  } catch (error) {
    console.error(
      "Get upcoming meetings error:",
      error
    );

    return sendErrorResponse(
      res,
      500,
      "Failed to retrieve upcoming meetings"
    );
  }
};

export const getMeetingHistory = async (req, res) => {
  try {
    const userId = req.user.user_id;

    if (!isValidId(userId)) {
      return sendErrorResponse(
        res,
        400,
        "Valid user ID is required"
      );
    }

    const result = await pool.query(
      `
      SELECT
        m.meeting_id,
        m.organizer_user_id,
        organizer.name AS organizer_name,
        organizer.role AS organizer_role,
        m.meeting_type,
        m.title,
        m.agenda,
        m.meeting_date,
        m.start_time,
        m.end_time,
        m.meeting_mode,
        m.meeting_link,
        m.location,
        m.remarks,
        m.status,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'meeting_participant_id',
              mp.meeting_participant_id,
              'user_id',
              mp.user_id,
              'participant_name',
              participant.name,
              'participant_role',
              participant.role,
              'response_status',
              mp.response_status
            )
            ORDER BY mp.meeting_participant_id
          ) FILTER (WHERE mp.meeting_participant_id IS NOT NULL),
          '[]'
        ) AS participants
      FROM tbl_meetings m
      INNER JOIN tbl_users organizer
        ON organizer.user_id = m.organizer_user_id
      LEFT JOIN tbl_meeting_participants mp
        ON mp.meeting_id = m.meeting_id
      LEFT JOIN tbl_users participant
        ON participant.user_id = mp.user_id
      WHERE
        (
          m.organizer_user_id = $1
          OR EXISTS (
            SELECT 1
            FROM tbl_meeting_participants mp_user
            WHERE
              mp_user.meeting_id = m.meeting_id
              AND mp_user.user_id = $1
          )
        )
        AND (
          m.meeting_date < $2
          OR m.status IN (
            'COMPLETED',
            'CANCELLED',
            'REJECTED'
          )
        )
      GROUP BY
        m.meeting_id,
        organizer.user_id,
        organizer.name,
        organizer.role
      ORDER BY
        m.meeting_date DESC,
        m.start_time DESC
      `,
      [userId, getCurrentDate()]
    );

    return sendSuccessResponse(
      res,
      200,
      "Meeting history retrieved successfully",
      result.rows
    );
  } catch (error) {
    console.error(
      "Get meeting history error:",
      error
    );

    return sendErrorResponse(
      res,
      500,
      "Failed to retrieve meeting history"
    );
  }
};