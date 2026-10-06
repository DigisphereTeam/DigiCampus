import pool from "../config/db.js";

import {
  handleControllerError,
  sendErrorResponse,
  sendSuccessResponse
} from "../utils/response.js";

import { isValidId } from "../utils/validation.js";

const APPOINTMENT_TYPES = [
  "PARENT_TEACHER",
  "PARENT_PRINCIPAL",
  "STUDENT_TEACHER",
  "STUDENT_COUNSELOR",
  "PARENT_COUNSELOR",
  "PARENT_ADMIN",
  "STAFF_PRINCIPAL",
  "GENERAL"
];

const APPOINTMENT_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
  "COMPLETED",
  "NO_SHOW"
];

export const createAppointment = async (req, res) => {
  const userId = req.user?.user_id;

  try {
    if (!userId) {
      return sendErrorResponse(
        res,
        401,
        "Unauthorized"
      );
    }

    const {
      appointment_with,
      student_id,
      appointment_type,
      appointment_date,
      start_time,
      end_time,
      purpose,
      notes
    } = req.body || {};

    const errors = {};

    if (!isValidId(appointment_with)) {
      errors.appointment_with =
        "A valid appointment_with user ID is required";
    }

    if (
      student_id !== undefined &&
      student_id !== null &&
      student_id !== "" &&
      !isValidId(student_id)
    ) {
      errors.student_id =
        "A valid student ID is required";
    }

    if (
      !appointment_type ||
      !APPOINTMENT_TYPES.includes(
        appointment_type.toString().trim().toUpperCase()
      )
    ) {
      errors.appointment_type =
        `Appointment type must be one of: ${APPOINTMENT_TYPES.join(", ")}`;
    }


    if (!appointment_date) {
      errors.appointment_date =
        "Appointment date is required";
    }

    if (!start_time) {
      errors.start_time =
        "Start time is required";
    }

    if (!end_time) {
      errors.end_time =
        "End time is required";
    }

    // ---------------------------------------------
    // Purpose
    // ---------------------------------------------

    if (!purpose || !purpose.toString().trim()) {
      errors.purpose =
        "Purpose is required";
    }

    if (Object.keys(errors).length > 0) {
      return sendErrorResponse(
        res,
        400,
        "Validation failed",
        errors
      );
    }

    const appointmentWithId = Number(appointment_with);

    const studentId =
      student_id !== undefined &&
        student_id !== null &&
        student_id !== ""
        ? Number(student_id)
        : null;

    const normalizedType =
      appointment_type.toString().trim().toUpperCase();

    const normalizedPurpose =
      purpose.toString().trim();

    const normalizedNotes =
      notes ? notes.toString().trim() : null;


    const dateCheck = await pool.query(
      `
      SELECT
        $1::date >= CURRENT_DATE AS is_valid
      `,
      [appointment_date]
    );

    if (!dateCheck.rows[0].is_valid) {
      return sendErrorResponse(
        res,
        400,
        "Appointment date cannot be in the past"
      );
    }

    const timeCheck = await pool.query(
      `
      SELECT
        $1::time < $2::time AS is_valid
      `,
      [start_time, end_time]
    );

    if (!timeCheck.rows[0].is_valid) {
      return sendErrorResponse(
        res,
        400,
        "End time must be greater than start time"
      );
    }

    const employeeResult = await pool.query(
      `
      SELECT user_id
      FROM tbl_users
      WHERE user_id = $1
      LIMIT 1
      `,
      [appointmentWithId]
    );

    if (employeeResult.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        "Appointment recipient was not found"
      );
    }

    // ---------------------------------------------
    // Check student
    // ---------------------------------------------

    if (studentId) {
      const studentResult = await pool.query(
        `
        SELECT student_id
        FROM tbl_students
        WHERE student_id = $1
        LIMIT 1
        `,
        [studentId]
      );

      if (studentResult.rows.length === 0) {
        return sendErrorResponse(
          res,
          404,
          "Student was not found"
        );
      }
    }

    // ---------------------------------------------
    // Insert appointment
    // ---------------------------------------------

    const result = await pool.query(
      `
      INSERT INTO tbl_appointments (
        appointment_number,
        requested_by,
        appointment_with,
        student_id,
        appointment_type,
        appointment_date,
        start_time,
        end_time,
        purpose,
        notes
      )
      VALUES (
        'TEMP',
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9
      )
      RETURNING
        appointment_id,
        appointment_number,
        requested_by,
        appointment_with,
        student_id,
        appointment_type,
        appointment_date,
        start_time,
        end_time,
        purpose,
        notes,
        status,
        created_at;
      `,
      [
        userId,
        appointmentWithId,
        studentId,
        normalizedType,
        appointment_date,
        start_time,
        end_time,
        normalizedPurpose,
        normalizedNotes
      ]
    );

    const appointment = result.rows[0];

    // ---------------------------------------------
    // Generate appointment number
    // ---------------------------------------------

    const appointmentNumber =
      `APT-${new Date().getFullYear()}-${String(
        appointment.appointment_id
      ).padStart(6, "0")}`;

    const updatedResult = await pool.query(
      `
      UPDATE tbl_appointments
      SET
        appointment_number = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE appointment_id = $2
      RETURNING *;
      `,
      [
        appointmentNumber,
        appointment.appointment_id
      ]
    );

    return sendSuccessResponse(
      res,
      201,
      "Appointment created successfully",
      updatedResult.rows[0]
    );

  } catch (error) {

    // PostgreSQL exclusion constraint violation
    if (error.code === "23P01") {
      return sendErrorResponse(
        res,
        409,
        "The selected time slot is already booked"
      );
    }

    return handleControllerError(
      res,
      error,
      "Unable to create appointment",
      {
        user_id: userId
      }
    );
  }
};


// =====================================================
// GET ALL APPOINTMENTS
// =====================================================

export const getAllAppointments = async (req, res) => {
  try {

    const {
      status,
      appointment_type,
      appointment_date,
      from_date,
      to_date,
      appointment_with,
      requested_by,
      student_id,
      search,
      page = 1,
      limit = 20
    } = req.query;

    const errors = {};

    if (
      status &&
      !APPOINTMENT_STATUSES.includes(
        status.toString().trim().toUpperCase()
      )
    ) {
      errors.status =
        `Status must be one of: ${APPOINTMENT_STATUSES.join(", ")}`;
    }

    if (
      appointment_type &&
      !APPOINTMENT_TYPES.includes(
        appointment_type.toString().trim().toUpperCase()
      )
    ) {
      errors.appointment_type =
        `Appointment type must be one of: ${APPOINTMENT_TYPES.join(", ")}`;
    }

    if (
      appointment_with &&
      !isValidId(appointment_with)
    ) {
      errors.appointment_with =
        "Invalid appointment_with";
    }

    if (
      requested_by &&
      !isValidId(requested_by)
    ) {
      errors.requested_by =
        "Invalid requested_by";
    }

    if (
      student_id &&
      !isValidId(student_id)
    ) {
      errors.student_id =
        "Invalid student_id";
    }

    const pageNumber = Math.max(
      Number(page) || 1,
      1
    );

    const limitNumber = Math.min(
      Math.max(Number(limit) || 20, 1),
      100
    );

    if (Object.keys(errors).length > 0) {
      return sendErrorResponse(
        res,
        400,
        "Validation failed",
        errors
      );
    }

    const offset =
      (pageNumber - 1) * limitNumber;

    const values = [];
    const conditions = [];

    // ---------------------------------------------
    // Status
    // ---------------------------------------------

    if (status) {
      values.push(
        status.toString().trim().toUpperCase()
      );

      conditions.push(
        `a.status = $${values.length}`
      );
    }

    // ---------------------------------------------
    // Appointment type
    // ---------------------------------------------

    if (appointment_type) {
      values.push(
        appointment_type
          .toString()
          .trim()
          .toUpperCase()
      );

      conditions.push(
        `a.appointment_type = $${values.length}`
      );
    }

    // ---------------------------------------------
    // Appointment date
    // ---------------------------------------------

    if (appointment_date) {
      values.push(appointment_date);

      conditions.push(
        `a.appointment_date = $${values.length}`
      );
    }

    // ---------------------------------------------
    // Date range
    // ---------------------------------------------

    if (from_date) {
      values.push(from_date);

      conditions.push(
        `a.appointment_date >= $${values.length}`
      );
    }

    if (to_date) {
      values.push(to_date);

      conditions.push(
        `a.appointment_date <= $${values.length}`
      );
    }

    // ---------------------------------------------
    // Appointment with
    // ---------------------------------------------

    if (appointment_with) {
      values.push(Number(appointment_with));

      conditions.push(
        `a.appointment_with = $${values.length}`
      );
    }

    // ---------------------------------------------
    // Requested by
    // ---------------------------------------------

    if (requested_by) {
      values.push(Number(requested_by));

      conditions.push(
        `a.requested_by = $${values.length}`
      );
    }

    // ---------------------------------------------
    // Student
    // ---------------------------------------------

    if (student_id) {
      values.push(Number(student_id));

      conditions.push(
        `a.student_id = $${values.length}`
      );
    }

    // ---------------------------------------------
    // Search
    // ---------------------------------------------

    if (search && search.trim()) {
      values.push(`%${search.trim()}%`);

      conditions.push(`
        (
          a.appointment_number ILIKE $${values.length}
          OR a.purpose ILIKE $${values.length}
          OR requester.full_name ILIKE $${values.length}
          OR recipient.full_name ILIKE $${values.length}
          OR s.full_name ILIKE $${values.length}
        )
      `);
    }

    const whereClause =
      conditions.length > 0
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

    // ---------------------------------------------
    // Count
    // ---------------------------------------------

    const countResult = await pool.query(
      `
      SELECT COUNT(*) AS total
      FROM tbl_appointments a

      LEFT JOIN tbl_users requester
        ON requester.user_id = a.requested_by

      LEFT JOIN tbl_users recipient
        ON recipient.user_id = a.appointment_with

      LEFT JOIN tbl_students s
        ON s.student_id = a.student_id

      ${whereClause}
      `,
      values
    );

    const total =
      Number(countResult.rows[0].total);

    // ---------------------------------------------
    // Pagination
    // ---------------------------------------------

    values.push(limitNumber);
    const limitParam = values.length;

    values.push(offset);
    const offsetParam = values.length;

    // ---------------------------------------------
    // Get data
    // ---------------------------------------------

    const result = await pool.query(
      `
      SELECT
        a.appointment_id,
        a.appointment_number,

        a.requested_by,
        requester.full_name AS requested_by_name,

        a.appointment_with,
        recipient.full_name AS appointment_with_name,

        a.student_id,
        s.full_name AS student_name,
        s.admission_number,

        a.appointment_type,
        a.appointment_date,
        a.start_time,
        a.end_time,

        a.purpose,
        a.notes,

        a.status,
        a.rejection_reason,
        a.cancellation_reason,

        a.approved_at,
        a.cancelled_at,
        a.completed_at,

        a.created_at,
        a.updated_at

      FROM tbl_appointments a

      LEFT JOIN tbl_users requester
        ON requester.user_id = a.requested_by

      LEFT JOIN tbl_users recipient
        ON recipient.user_id = a.appointment_with

      LEFT JOIN tbl_students s
        ON s.student_id = a.student_id

      ${whereClause}

      ORDER BY
        a.appointment_date DESC,
        a.start_time DESC

      LIMIT $${limitParam}
      OFFSET $${offsetParam}
      `,
      values
    );

    return sendSuccessResponse(
      res,
      200,
      "Appointments fetched successfully",
      {
        appointments: result.rows,
        pagination: {
          page: pageNumber,
          limit: limitNumber,
          total,
          total_pages: Math.ceil(
            total / limitNumber
          )
        }
      }
    );

  } catch (error) {
    return handleControllerError(
      res,
      error,
      "Unable to fetch appointments"
    );
  }
};


// =====================================================
// GET APPOINTMENT BY ID
// =====================================================

export const getAppointmentById = async (req, res) => {
  const { appointment_id } = req.params;

  try {

    if (!isValidId(appointment_id)) {
      return sendErrorResponse(
        res,
        400,
        "A valid appointment ID is required"
      );
    }

    const result = await pool.query(
      `
      SELECT
        a.appointment_id,
        a.appointment_number,

        a.requested_by,
        requester.full_name AS requested_by_name,

        a.appointment_with,
        recipient.full_name AS appointment_with_name,

        a.student_id,
        s.full_name AS student_name,
        s.admission_number,

        a.appointment_type,
        a.appointment_date,
        a.start_time,
        a.end_time,

        a.purpose,
        a.notes,

        a.status,
        a.rejection_reason,
        a.cancellation_reason,

        a.approved_at,
        a.cancelled_at,
        a.completed_at,

        a.created_at,
        a.updated_at

      FROM tbl_appointments a

      LEFT JOIN tbl_users requester
        ON requester.user_id = a.requested_by

      LEFT JOIN tbl_users recipient
        ON recipient.user_id = a.appointment_with

      LEFT JOIN tbl_students s
        ON s.student_id = a.student_id

      WHERE a.appointment_id = $1
      LIMIT 1;
      `,
      [Number(appointment_id)]
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        "Appointment not found"
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Appointment fetched successfully",
      result.rows[0]
    );

  } catch (error) {
    return handleControllerError(
      res,
      error,
      "Unable to fetch appointment",
      { appointment_id }
    );
  }
};


// =====================================================
// UPDATE APPOINTMENT
// =====================================================

export const updateAppointment = async (req, res) => {
  const { appointment_id } = req.params;

  try {

    if (!isValidId(appointment_id)) {
      return sendErrorResponse(
        res,
        400,
        "A valid appointment ID is required"
      );
    }

    const {
      appointment_with,
      student_id,
      appointment_type,
      appointment_date,
      start_time,
      end_time,
      purpose,
      notes
    } = req.body || {};

    const fields = [];
    const values = [];

    // ---------------------------------------------
    // appointment_with
    // ---------------------------------------------

    if (appointment_with !== undefined) {

      if (!isValidId(appointment_with)) {
        return sendErrorResponse(
          res,
          400,
          "A valid appointment_with user ID is required"
        );
      }

      values.push(Number(appointment_with));

      fields.push(
        `appointment_with = $${values.length}`
      );
    }

    // ---------------------------------------------
    // student_id
    // ---------------------------------------------

    if (student_id !== undefined) {

      if (
        student_id !== null &&
        student_id !== "" &&
        !isValidId(student_id)
      ) {
        return sendErrorResponse(
          res,
          400,
          "A valid student ID is required"
        );
      }

      values.push(
        student_id === null ||
          student_id === ""
          ? null
          : Number(student_id)
      );

      fields.push(
        `student_id = $${values.length}`
      );
    }

    // ---------------------------------------------
    // appointment type
    // ---------------------------------------------

    if (appointment_type !== undefined) {

      const normalizedType =
        appointment_type
          .toString()
          .trim()
          .toUpperCase();

      if (!APPOINTMENT_TYPES.includes(normalizedType)) {
        return sendErrorResponse(
          res,
          400,
          `Appointment type must be one of: ${APPOINTMENT_TYPES.join(", ")}`
        );
      }

      values.push(normalizedType);

      fields.push(
        `appointment_type = $${values.length}`
      );
    }

    // ---------------------------------------------
    // date
    // ---------------------------------------------

    if (appointment_date !== undefined) {

      const dateCheck = await pool.query(
        `
        SELECT
          $1::date >= CURRENT_DATE AS is_valid
        `,
        [appointment_date]
      );

      if (!dateCheck.rows[0].is_valid) {
        return sendErrorResponse(
          res,
          400,
          "Appointment date cannot be in the past"
        );
      }

      values.push(appointment_date);

      fields.push(
        `appointment_date = $${values.length}`
      );
    }

    // ---------------------------------------------
    // start time
    // ---------------------------------------------

    if (start_time !== undefined) {
      values.push(start_time);

      fields.push(
        `start_time = $${values.length}`
      );
    }

    // ---------------------------------------------
    // end time
    // ---------------------------------------------

    if (end_time !== undefined) {
      values.push(end_time);

      fields.push(
        `end_time = $${values.length}`
      );
    }

    // ---------------------------------------------
    // purpose
    // ---------------------------------------------

    if (purpose !== undefined) {

      if (!purpose.toString().trim()) {
        return sendErrorResponse(
          res,
          400,
          "Purpose cannot be empty"
        );
      }

      values.push(
        purpose.toString().trim()
      );

      fields.push(
        `purpose = $${values.length}`
      );
    }

    // ---------------------------------------------
    // notes
    // ---------------------------------------------

    if (notes !== undefined) {

      values.push(
        notes === null
          ? null
          : notes.toString().trim()
      );

      fields.push(
        `notes = $${values.length}`
      );
    }

    if (fields.length === 0) {
      return sendErrorResponse(
        res,
        400,
        "At least one field is required to update"
      );
    }

    fields.push(
      "updated_at = CURRENT_TIMESTAMP"
    );

    values.push(Number(appointment_id));

    // ---------------------------------------------
    // UPDATE FIRST
    // ---------------------------------------------

    const result = await pool.query(
      `
      UPDATE tbl_appointments
      SET
        ${fields.join(", ")}

      WHERE appointment_id = $${values.length}
        AND status = 'PENDING'

      RETURNING *;
      `,
      values
    );

    if (result.rows.length === 0) {

      const checkResult = await pool.query(
        `
        SELECT status
        FROM tbl_appointments
        WHERE appointment_id = $1
        LIMIT 1;
        `,
        [Number(appointment_id)]
      );

      if (checkResult.rows.length === 0) {
        return sendErrorResponse(
          res,
          404,
          "Appointment not found"
        );
      }

      return sendErrorResponse(
        res,
        409,
        "Only pending appointments can be updated"
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Appointment updated successfully",
      result.rows[0]
    );

  } catch (error) {

    if (error.code === "23P01") {
      return sendErrorResponse(
        res,
        409,
        "The selected time slot is already booked"
      );
    }

    return handleControllerError(
      res,
      error,
      "Unable to update appointment",
      { appointment_id }
    );
  }
};


// =====================================================
// APPROVE APPOINTMENT
// =====================================================

export const approveAppointment = async (req, res) => {
  const { appointment_id } = req.params;

  try {

    if (!isValidId(appointment_id)) {
      return sendErrorResponse(
        res,
        400,
        "A valid appointment ID is required"
      );
    }

    const result = await pool.query(
      `
      UPDATE tbl_appointments
      SET
        status = 'APPROVED',
        approved_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP

      WHERE appointment_id = $1
        AND status = 'PENDING'

      RETURNING *;
      `,
      [Number(appointment_id)]
    );

    if (result.rows.length === 0) {

      const checkResult = await pool.query(
        `
        SELECT status
        FROM tbl_appointments
        WHERE appointment_id = $1
        LIMIT 1;
        `,
        [Number(appointment_id)]
      );

      if (checkResult.rows.length === 0) {
        return sendErrorResponse(
          res,
          404,
          "Appointment not found"
        );
      }

      return sendErrorResponse(
        res,
        409,
        `Appointment cannot be approved because its current status is ${checkResult.rows[0].status}`
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Appointment approved successfully",
      result.rows[0]
    );

  } catch (error) {
    return handleControllerError(
      res,
      error,
      "Unable to approve appointment",
      { appointment_id }
    );
  }
};


// =====================================================
// REJECT APPOINTMENT
// =====================================================

export const rejectAppointment = async (req, res) => {
  const { appointment_id } = req.params;

  const {
    rejection_reason
  } = req.body || {};

  try {

    if (!isValidId(appointment_id)) {
      return sendErrorResponse(
        res,
        400,
        "A valid appointment ID is required"
      );
    }

    if (
      !rejection_reason ||
      !rejection_reason.toString().trim()
    ) {
      return sendErrorResponse(
        res,
        400,
        "Rejection reason is required"
      );
    }

    const result = await pool.query(
      `
      UPDATE tbl_appointments
      SET
        status = 'REJECTED',
        rejection_reason = $2,
        updated_at = CURRENT_TIMESTAMP

      WHERE appointment_id = $1
        AND status = 'PENDING'

      RETURNING *;
      `,
      [
        Number(appointment_id),
        rejection_reason.toString().trim()
      ]
    );

    if (result.rows.length === 0) {

      const checkResult = await pool.query(
        `
        SELECT status
        FROM tbl_appointments
        WHERE appointment_id = $1
        LIMIT 1;
        `,
        [Number(appointment_id)]
      );

      if (checkResult.rows.length === 0) {
        return sendErrorResponse(
          res,
          404,
          "Appointment not found"
        );
      }

      return sendErrorResponse(
        res,
        409,
        "Only pending appointments can be rejected"
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Appointment rejected successfully",
      result.rows[0]
    );

  } catch (error) {
    return handleControllerError(
      res,
      error,
      "Unable to reject appointment",
      { appointment_id }
    );
  }
};


// =====================================================
// CANCEL APPOINTMENT
// =====================================================

export const cancelAppointment = async (req, res) => {
  const { appointment_id } = req.params;

  const {
    cancellation_reason
  } = req.body || {};

  try {

    if (!isValidId(appointment_id)) {
      return sendErrorResponse(
        res,
        400,
        "A valid appointment ID is required"
      );
    }

    if (
      !cancellation_reason ||
      !cancellation_reason.toString().trim()
    ) {
      return sendErrorResponse(
        res,
        400,
        "Cancellation reason is required"
      );
    }

    const result = await pool.query(
      `
      UPDATE tbl_appointments
      SET
        status = 'CANCELLED',
        cancellation_reason = $2,
        cancelled_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP

      WHERE appointment_id = $1
        AND status IN ('PENDING', 'APPROVED')

      RETURNING *;
      `,
      [
        Number(appointment_id),
        cancellation_reason.toString().trim()
      ]
    );

    if (result.rows.length === 0) {

      const checkResult = await pool.query(
        `
        SELECT status
        FROM tbl_appointments
        WHERE appointment_id = $1
        LIMIT 1;
        `,
        [Number(appointment_id)]
      );

      if (checkResult.rows.length === 0) {
        return sendErrorResponse(
          res,
          404,
          "Appointment not found"
        );
      }

      return sendErrorResponse(
        res,
        409,
        "Appointment cannot be cancelled in its current state"
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Appointment cancelled successfully",
      result.rows[0]
    );

  } catch (error) {
    return handleControllerError(
      res,
      error,
      "Unable to cancel appointment",
      { appointment_id }
    );
  }
};


// =====================================================
// COMPLETE APPOINTMENT
// =====================================================

export const completeAppointment = async (req, res) => {
  const { appointment_id } = req.params;

  try {

    if (!isValidId(appointment_id)) {
      return sendErrorResponse(
        res,
        400,
        "A valid appointment ID is required"
      );
    }

    const result = await pool.query(
      `
      UPDATE tbl_appointments
      SET
        status = 'COMPLETED',
        completed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP

      WHERE appointment_id = $1
        AND status = 'APPROVED'

      RETURNING *;
      `,
      [Number(appointment_id)]
    );

    if (result.rows.length === 0) {

      const checkResult = await pool.query(
        `
        SELECT status
        FROM tbl_appointments
        WHERE appointment_id = $1
        LIMIT 1;
        `,
        [Number(appointment_id)]
      );

      if (checkResult.rows.length === 0) {
        return sendErrorResponse(
          res,
          404,
          "Appointment not found"
        );
      }

      return sendErrorResponse(
        res,
        409,
        "Only approved appointments can be completed"
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Appointment completed successfully",
      result.rows[0]
    );

  } catch (error) {
    return handleControllerError(
      res,
      error,
      "Unable to complete appointment",
      { appointment_id }
    );
  }
};


// =====================================================
// MARK NO SHOW
// =====================================================

export const markAppointmentNoShow = async (req, res) => {
  const { appointment_id } = req.params;

  try {

    if (!isValidId(appointment_id)) {
      return sendErrorResponse(
        res,
        400,
        "A valid appointment ID is required"
      );
    }

    const result = await pool.query(
      `
      UPDATE tbl_appointments
      SET
        status = 'NO_SHOW',
        updated_at = CURRENT_TIMESTAMP

      WHERE appointment_id = $1
        AND status = 'APPROVED'

      RETURNING *;
      `,
      [Number(appointment_id)]
    );

    if (result.rows.length === 0) {

      const checkResult = await pool.query(
        `
        SELECT status
        FROM tbl_appointments
        WHERE appointment_id = $1
        LIMIT 1;
        `,
        [Number(appointment_id)]
      );

      if (checkResult.rows.length === 0) {
        return sendErrorResponse(
          res,
          404,
          "Appointment not found"
        );
      }

      return sendErrorResponse(
        res,
        409,
        "Only approved appointments can be marked as no-show"
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Appointment marked as no-show",
      result.rows[0]
    );

  } catch (error) {
    return handleControllerError(
      res,
      error,
      "Unable to update appointment",
      { appointment_id }
    );
  }
};


// =====================================================
// MY APPOINTMENTS
// =====================================================

export const getMyAppointments = async (req, res) => {
  const userId = req.user?.user_id;

  try {

    if (!userId) {
      return sendErrorResponse(
        res,
        401,
        "Unauthorized"
      );
    }

    const result = await pool.query(
      `
      SELECT
        a.appointment_id,
        a.appointment_number,

        a.requested_by,
        requester.full_name AS requested_by_name,

        a.appointment_with,
        recipient.full_name AS appointment_with_name,

        a.student_id,
        s.full_name AS student_name,
        s.admission_number,

        a.appointment_type,
        a.appointment_date,
        a.start_time,
        a.end_time,

        a.purpose,
        a.notes,
        a.status,

        a.created_at,
        a.updated_at

      FROM tbl_appointments a

      LEFT JOIN tbl_users requester
        ON requester.user_id = a.requested_by

      LEFT JOIN tbl_users recipient
        ON recipient.user_id = a.appointment_with

      LEFT JOIN tbl_students s
        ON s.student_id = a.student_id

      WHERE
        a.requested_by = $1
        OR a.appointment_with = $1

      ORDER BY
        a.appointment_date DESC,
        a.start_time DESC;
      `,
      [userId]
    );

    return sendSuccessResponse(
      res,
      200,
      "My appointments fetched successfully",
      result.rows
    );

  } catch (error) {
    return handleControllerError(
      res,
      error,
      "Unable to fetch your appointments"
    );
  }
};


// =====================================================
// UPCOMING APPOINTMENTS
// =====================================================

export const getUpcomingAppointments = async (req, res) => {
  try {

    const result = await pool.query(
      `
      SELECT
        a.appointment_id,
        a.appointment_number,

        requester.full_name AS requested_by_name,
        recipient.full_name AS appointment_with_name,

        a.student_id,
        s.full_name AS student_name,
        s.admission_number,

        a.appointment_type,
        a.appointment_date,
        a.start_time,
        a.end_time,

        a.purpose,
        a.status

      FROM tbl_appointments a

      LEFT JOIN tbl_users requester
        ON requester.user_id = a.requested_by

      LEFT JOIN tbl_users recipient
        ON recipient.user_id = a.appointment_with

      LEFT JOIN tbl_students s
        ON s.student_id = a.student_id

      WHERE
        a.appointment_date >= CURRENT_DATE
        AND a.status IN ('PENDING', 'APPROVED')

      ORDER BY
        a.appointment_date ASC,
        a.start_time ASC;
      `
    );

    return sendSuccessResponse(
      res,
      200,
      "Upcoming appointments fetched successfully",
      result.rows
    );

  } catch (error) {
    return handleControllerError(
      res,
      error,
      "Unable to fetch upcoming appointments"
    );
  }
};


// =====================================================
// CALENDAR
// =====================================================

export const getAppointmentCalendar = async (req, res) => {
  try {

    const currentDate = new Date();

    const month =
      Number(req.query.month) ||
      currentDate.getMonth() + 1;

    const year =
      Number(req.query.year) ||
      currentDate.getFullYear();

    if (
      month < 1 ||
      month > 12 ||
      year < 2000 ||
      year > 2100
    ) {
      return sendErrorResponse(
        res,
        400,
        "Invalid month or year"
      );
    }

    const result = await pool.query(
      `
      SELECT
        a.appointment_id,
        a.appointment_number,

        requester.full_name AS requested_by_name,
        recipient.full_name AS appointment_with_name,

        a.student_id,
        s.full_name AS student_name,

        a.appointment_type,
        a.appointment_date,
        a.start_time,
        a.end_time,

        a.purpose,
        a.status

      FROM tbl_appointments a

      LEFT JOIN tbl_users requester
        ON requester.user_id = a.requested_by

      LEFT JOIN tbl_users recipient
        ON recipient.user_id = a.appointment_with

      LEFT JOIN tbl_students s
        ON s.student_id = a.student_id

      WHERE
        EXTRACT(MONTH FROM a.appointment_date) = $1
        AND EXTRACT(YEAR FROM a.appointment_date) = $2

      ORDER BY
        a.appointment_date ASC,
        a.start_time ASC;
      `,
      [month, year]
    );

    return sendSuccessResponse(
      res,
      200,
      "Appointment calendar fetched successfully",
      result.rows
    );

  } catch (error) {
    return handleControllerError(
      res,
      error,
      "Unable to fetch appointment calendar"
    );
  }
};


// =====================================================
// APPOINTMENT DASHBOARD
// =====================================================

export const getAppointmentDashboard = async (req, res) => {
  try {

    const result = await pool.query(
      `
      SELECT
        COUNT(*) AS total_appointments,

        COUNT(*) FILTER (
          WHERE status = 'PENDING'
        ) AS pending_appointments,

        COUNT(*) FILTER (
          WHERE status = 'APPROVED'
        ) AS approved_appointments,

        COUNT(*) FILTER (
          WHERE status = 'REJECTED'
        ) AS rejected_appointments,

        COUNT(*) FILTER (
          WHERE status = 'CANCELLED'
        ) AS cancelled_appointments,

        COUNT(*) FILTER (
          WHERE status = 'COMPLETED'
        ) AS completed_appointments,

        COUNT(*) FILTER (
          WHERE status = 'NO_SHOW'
        ) AS no_show_appointments,

        COUNT(*) FILTER (
          WHERE appointment_date = CURRENT_DATE
        ) AS today_appointments,

        COUNT(*) FILTER (
          WHERE appointment_date >= CURRENT_DATE
            AND status IN ('PENDING', 'APPROVED')
        ) AS upcoming_appointments,

        COUNT(*) FILTER (
          WHERE appointment_date >= DATE_TRUNC(
            'month',
            CURRENT_DATE
          )
          AND appointment_date < DATE_TRUNC(
            'month',
            CURRENT_DATE
          ) + INTERVAL '1 month'
        ) AS this_month_appointments

      FROM tbl_appointments;
      `
    );

    return sendSuccessResponse(
      res,
      200,
      "Appointment dashboard fetched successfully",
      result.rows[0]
    );

  } catch (error) {
    return handleControllerError(
      res,
      error,
      "Unable to fetch appointment dashboard"
    );
  }
};
