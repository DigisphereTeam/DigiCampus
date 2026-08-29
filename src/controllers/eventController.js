import pool from "../config/database.js";

import {
  sendErrorResponse,
  sendSuccessResponse
} from "../utils/response.js";

const EVENT_STATUSES = [
  "PENDING",
  "APPROVED",
  "ONGOING",
  "COMPLETED",
  "CANCELLED"
];

const allowedTransitions = {
  PENDING: ["APPROVED", "CANCELLED"],
  APPROVED: ["ONGOING", "CANCELLED"],
  ONGOING: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: []
};

export const createEvent = async (req, res) => {
  try {
    const {
      event_name,
      category,
      event_date,
      event_slot,
      description,
      status
    } = req.body || {};

    const errors = {};

    if (!event_name || !event_name.toString().trim()) {
      errors.event_name = "Event name is required";
    }

    if (!category || !category.toString().trim()) {
      errors.category = "Category is required";
    }

    if (!event_date) {
      errors.event_date = "Event date is required";
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(event_date)) {
      errors.event_date =
        "Event date must be in YYYY-MM-DD format";
    } else {
      const dateCheck = await pool.query(
        `SELECT $1::date < CURRENT_DATE AS is_past_date`,
        [event_date]
      );

      if (dateCheck.rows[0].is_past_date) {
        errors.event_date = "Event date cannot be in the past";
      }
    }

    if (!event_slot || !event_slot.toString().trim()) {
      errors.event_slot = "Event slot is required";
    }

    if (!description || !description.toString().trim()) {
      errors.description = "Description is required";
    }

    if (
      status !== undefined &&
      !EVENT_STATUSES.includes(status)
    ) {
      errors.status =
        "Invalid status. Allowed values are PENDING, APPROVED, ONGOING, COMPLETED, CANCELLED";
    }

    if (Object.keys(errors).length > 0) {
      return sendErrorResponse(
        res,
        400,
        "Validation failed",
        errors
      );
    }

    const result = await pool.query(
      `
      INSERT INTO tbl_events (
        event_name,
        category,
        event_date,
        event_slot,
        description,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (event_date, event_slot)
      DO NOTHING
      RETURNING *
      `,
      [
        event_name.toString().trim(),
        category.toString().trim(),
        event_date,
        event_slot.toString().trim(),
        description.toString().trim(),
        status || "PENDING"
      ]
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        409,
        "Event already exists for the selected date and slot"
      );
    }

    return sendSuccessResponse(
      res,
      201,
      "Event created successfully",
      result.rows[0]
    );

  } catch (error) {
    console.error("Create Event Error:", error);

    const message =
      process.env.NODE_ENV === "development"
        ? error.message
        : "Internal server error";

    return sendErrorResponse(
      res,
      500,
      message
    );
  }
};

export const getEventDashboard = async (req, res) => {
  try {
    await pool.query(
      `
      UPDATE tbl_events
      SET
        status = CASE
          WHEN status = 'PENDING'
               AND event_date < CURRENT_DATE
            THEN 'CANCELLED'

          WHEN status = 'APPROVED'
               AND event_date = CURRENT_DATE
               AND CURRENT_TIME >= (
                 TRIM(
                   SPLIT_PART(
                     REPLACE(event_slot, ' ', ''),
                     '-',
                     1
                   )
                 )::TIME
               )
               AND CURRENT_TIME < (
                 TRIM(
                   SPLIT_PART(
                     REPLACE(event_slot, ' ', ''),
                     '-',
                     2
                   )
                 )::TIME
               )
            THEN 'ONGOING'

          WHEN status IN ('APPROVED', 'ONGOING')
               AND (
                 event_date < CURRENT_DATE
                 OR (
                   event_date = CURRENT_DATE
                   AND CURRENT_TIME >= (
                     TRIM(
                       SPLIT_PART(
                         REPLACE(event_slot, ' ', ''),
                         '-',
                         2
                       )
                     )::TIME
                   )
                 )
               )
            THEN 'COMPLETED'

          ELSE status
        END,
        updated_at = CURRENT_TIMESTAMP
      WHERE status IN ('PENDING', 'APPROVED', 'ONGOING')
      `
    );

    const [
      statisticsResult,
      upcomingEventsResult,
      pastEventsResult,
      pendingApprovalResult
    ] = await Promise.all([
      pool.query(
        `
        SELECT
          COUNT(*) AS total_events,

          COUNT(*) FILTER (
            WHERE status IN ('APPROVED', 'ONGOING')
              AND event_date >= CURRENT_DATE
          ) AS upcoming_events,

          COUNT(*) FILTER (
            WHERE event_date >= DATE_TRUNC('month', CURRENT_DATE)
              AND event_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
          ) AS this_month_events,

          COUNT(*) FILTER (
            WHERE status = 'COMPLETED'
          ) AS completed_events,

          COUNT(*) FILTER (
            WHERE status = 'PENDING'
          ) AS pending_approvals

        FROM tbl_events
        `
      ),

      pool.query(
        `
        SELECT
          event_id,
          event_name,
          category,
          event_date,
          event_slot,
          description,
          status,
          created_at,
          updated_at
        FROM tbl_events
        WHERE
          status IN ('APPROVED', 'ONGOING')
          AND event_date >= CURRENT_DATE
        ORDER BY event_date ASC, event_id ASC
        `
      ),

      pool.query(
        `
        SELECT
          event_id,
          event_name,
          category,
          event_date,
          event_slot,
          description,
          status,
          created_at,
          updated_at
        FROM tbl_events
        WHERE
          status IN ('COMPLETED', 'CANCELLED')
        ORDER BY event_date DESC, event_id DESC
        `
      ),

      pool.query(
        `
        SELECT
          event_id,
          event_name,
          category,
          event_date,
          event_slot,
          description,
          status,
          created_at,
          updated_at
        FROM tbl_events
        WHERE status = 'PENDING'
        ORDER BY event_date ASC, event_id ASC
        `
      )
    ]);

    const statistics = statisticsResult.rows[0];

    return sendSuccessResponse(
      res,
      200,
      "Event dashboard fetched successfully",
      {
        statistics: {
          total_events: Number(statistics.total_events),
          upcoming_events: Number(statistics.upcoming_events),
          this_month_events: Number(statistics.this_month_events),
          completed_events: Number(statistics.completed_events),
          pending_approvals: Number(statistics.pending_approvals)
        },
        upcoming_events: upcomingEventsResult.rows,
        past_events: pastEventsResult.rows,
        pending_approval_events: pendingApprovalResult.rows
      }
    );

  } catch (error) {
    console.error("Get Event Dashboard Error:", error);

    const message =
      process.env.NODE_ENV === "development"
        ? error.message
        : "Internal server error";

    return sendErrorResponse(
      res,
      500,
      message
    );
  }
};

export const getAllEvents = async (req, res) => {
  try {
    const { status } = req.query;

    if (
      status !== undefined &&
      !EVENT_STATUSES.includes(status)
    ) {
      return sendErrorResponse(
        res,
        400,
        "Invalid status. Allowed values are PENDING, APPROVED, ONGOING, COMPLETED, CANCELLED"
      );
    }

    await pool.query(
      `
      UPDATE tbl_events
      SET
        status = CASE
          WHEN status = 'PENDING'
               AND event_date < CURRENT_DATE
            THEN 'CANCELLED'

          WHEN status = 'APPROVED'
               AND event_date = CURRENT_DATE
               AND CURRENT_TIME >= (
                 TRIM(
                   SPLIT_PART(
                     REPLACE(event_slot, ' ', ''),
                     '-',
                     1
                   )
                 )::TIME
               )
               AND CURRENT_TIME < (
                 TRIM(
                   SPLIT_PART(
                     REPLACE(event_slot, ' ', ''),
                     '-',
                     2
                   )
                 )::TIME
               )
            THEN 'ONGOING'

          WHEN status = 'APPROVED'
               AND (
                 event_date < CURRENT_DATE
                 OR (
                   event_date = CURRENT_DATE
                   AND CURRENT_TIME >= (
                     TRIM(
                       SPLIT_PART(
                         REPLACE(event_slot, ' ', ''),
                         '-',
                         2
                       )
                     )::TIME
                   )
                 )
               )
            THEN 'COMPLETED'

          WHEN status = 'ONGOING'
               AND (
                 event_date < CURRENT_DATE
                 OR (
                   event_date = CURRENT_DATE
                   AND CURRENT_TIME >= (
                     TRIM(
                       SPLIT_PART(
                         REPLACE(event_slot, ' ', ''),
                         '-',
                         2
                       )
                     )::TIME
                   )
                 )
               )
            THEN 'COMPLETED'

          ELSE status
        END,
        updated_at = CURRENT_TIMESTAMP
      WHERE
        (
          status = 'PENDING'
          AND event_date < CURRENT_DATE
        )
        OR
        (
          status = 'APPROVED'
          AND (
            event_date = CURRENT_DATE
            OR event_date < CURRENT_DATE
          )
        )
        OR
        (
          status = 'ONGOING'
          AND (
            event_date < CURRENT_DATE
            OR (
              event_date = CURRENT_DATE
              AND CURRENT_TIME >= (
                TRIM(
                  SPLIT_PART(
                    REPLACE(event_slot, ' ', ''),
                    '-',
                    2
                  )
                )::TIME
              )
            )
          )
        )
      `
    );

    const queryParams = [];

    let query = `
      SELECT
        event_id,
        event_name,
        category,
        event_date,
        event_slot,
        description,
        status,
        created_at,
        updated_at
      FROM tbl_events
    `;

    if (status) {
      query += `
        WHERE status = $1
      `;

      queryParams.push(status);
    }

    query += `
      ORDER BY event_date ASC, event_id ASC
    `;

    const result = await pool.query(
      query,
      queryParams
    );

    return sendSuccessResponse(
      res,
      200,
      "Events fetched successfully",
      result.rows
    );

  } catch (error) {
    console.error("Get All Events Error:", error);

    const message =
      process.env.NODE_ENV === "development"
        ? error.message
        : "Internal server error";

    return sendErrorResponse(
      res,
      500,
      message
    );
  }
};

export const getEventById = async (req, res) => {
  try {
    const { event_id } = req.params;

    if (
      !event_id ||
      !Number.isInteger(Number(event_id)) ||
      Number(event_id) <= 0
    ) {
      return sendErrorResponse(
        res,
        400,
        "Valid event_id is required"
      );
    }

    const result = await pool.query(
      `
      SELECT
        event_id,
        event_name,
        category,
        event_date,
        event_slot,
        description,
        status,
        created_at,
        updated_at
      FROM tbl_events
      WHERE event_id = $1
      `,
      [Number(event_id)]
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        "Event not found"
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Event fetched successfully",
      result.rows[0]
    );

  } catch (error) {
    console.error("Get Event By ID Error:", error);

    const message =
      process.env.NODE_ENV === "development"
        ? error.message
        : "Internal server error";

    return sendErrorResponse(
      res,
      500,
      message
    );
  }
};

export const updateEvent = async (req, res) => {
  try {
    const { event_id } = req.params;

    const {
      event_name,
      category,
      event_date,
      event_slot,
      description
    } = req.body || {};

    if (
      !event_id ||
      !Number.isInteger(Number(event_id)) ||
      Number(event_id) <= 0
    ) {
      return sendErrorResponse(
        res,
        400,
        "Valid event_id is required"
      );
    }

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
        "At least one field is required for update"
      );
    }

    const errors = {};

    if (
      event_name !== undefined &&
      !event_name.toString().trim()
    ) {
      errors.event_name =
        "Event name cannot be empty";
    }

    if (
      category !== undefined &&
      !category.toString().trim()
    ) {
      errors.category =
        "Category cannot be empty";
    }

    if (
      event_date !== undefined &&
      !/^\d{4}-\d{2}-\d{2}$/.test(event_date)
    ) {
      errors.event_date =
        "Event date must be in YYYY-MM-DD format";
    }

    if (
      event_slot !== undefined &&
      !event_slot.toString().trim()
    ) {
      errors.event_slot =
        "Event slot cannot be empty";
    }

    if (
      description !== undefined &&
      !description.toString().trim()
    ) {
      errors.description =
        "Description cannot be empty";
    }

    if (Object.keys(errors).length > 0) {
      return sendErrorResponse(
        res,
        400,
        "Validation failed",
        errors
      );
    }

    const existingEvent = await pool.query(
      `
      SELECT *
      FROM tbl_events
      WHERE event_id = $1
      `,
      [Number(event_id)]
    );

    if (existingEvent.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        "Event not found"
      );
    }

    const currentEvent = existingEvent.rows[0];

    const result = await pool.query(
      `
      UPDATE tbl_events
      SET
        event_name = $1,
        category = $2,
        event_date = $3,
        event_slot = $4,
        description = $5,
        updated_at = CURRENT_TIMESTAMP
      WHERE event_id = $6
      RETURNING *
      `,
      [
        event_name !== undefined
          ? event_name.toString().trim()
          : currentEvent.event_name,

        category !== undefined
          ? category.toString().trim()
          : currentEvent.category,

        event_date !== undefined
          ? event_date
          : currentEvent.event_date,

        event_slot !== undefined
          ? event_slot.toString().trim()
          : currentEvent.event_slot,

        description !== undefined
          ? description.toString().trim()
          : currentEvent.description,

        Number(event_id)
      ]
    );

    return sendSuccessResponse(
      res,
      200,
      "Event updated successfully",
      result.rows[0]
    );

  } catch (error) {
    console.error("Update Event Error:", error);

    const message =
      process.env.NODE_ENV === "development"
        ? error.message
        : "Internal server error";

    return sendErrorResponse(
      res,
      500,
      message
    );
  }
};

export const updateEventStatus = async (req, res) => {
  try {
    const { event_id } = req.params;
    const { status } = req.body || {};

    if (
      !event_id ||
      !Number.isInteger(Number(event_id)) ||
      Number(event_id) <= 0
    ) {
      return sendErrorResponse(
        res,
        400,
        "Valid event_id is required"
      );
    }

    if (!status) {
      return sendErrorResponse(
        res,
        400,
        "Status is required"
      );
    }

    if (!EVENT_STATUSES.includes(status)) {
      return sendErrorResponse(
        res,
        400,
        "Invalid status. Allowed values are PENDING, APPROVED, ONGOING, COMPLETED, CANCELLED"
      );
    }

    const existingEvent = await pool.query(
      `
      SELECT
        event_id,
        status,
        event_date
      FROM tbl_events
      WHERE event_id = $1
      `,
      [Number(event_id)]
    );

    if (existingEvent.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        "Event not found"
      );
    }

    const currentStatus = existingEvent.rows[0].status;

    if (!allowedTransitions[currentStatus].includes(status)) {
      return sendErrorResponse(
        res,
        400,
        `Cannot change event status from ${currentStatus} to ${status}`
      );
    }

    const result = await pool.query(
      `
      UPDATE tbl_events
      SET
        status = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE event_id = $2
      RETURNING *
      `,
      [
        status,
        Number(event_id)
      ]
    );

    return sendSuccessResponse(
      res,
      200,
      "Event status updated successfully",
      result.rows[0]
    );

  } catch (error) {
    console.error("Update Event Status Error:", error);

    const message =
      process.env.NODE_ENV === "development"
        ? error.message
        : "Internal server error";

    return sendErrorResponse(
      res,
      500,
      message
    );
  }
};