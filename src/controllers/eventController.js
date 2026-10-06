import pool from "../config/database.js";
import {
  allowedTransitions,
  EVENT_STATUSES,
} from "../constants/constants.js";

import {
  sendErrorResponse,
  sendSuccessResponse,
} from "../utils/response.js";

import { isValidId } from "../utils/validation.js";

export const createEvent = async (req, res) => {
  try {
    const {
      event_name,
      category,
      event_date,
      event_slot,
      description,
      venue,
      organizer,
      status,
    } = req.body;

    const result = await pool.query(
      `
        INSERT INTO tbl_events (
          event_name,
          category,
          event_date,
          event_slot,
          description,
          venue,
          organizer,
          status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (event_date, event_slot)
        DO NOTHING
        RETURNING *
      `,
      [
        event_name.trim(),
        category.trim(),
        event_date,
        event_slot.trim(),
        description?.trim() || null,
        venue?.trim() || null,
        organizer?.trim() || null,
        status || "PENDING",
      ],
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        409,
        "Event already exists for the selected date and slot",
      );
    }

    return sendSuccessResponse(
      res,
      201,
      "Event created successfully",
      result.rows[0],
    );
  } catch (error) {
    console.error("Create Event Error:", error);

    return sendErrorResponse(
      res,
      500,
      process.env.NODE_ENV === "development"
        ? error.message
        : "Failed to create event",
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
      `,
    );

    const [
      statisticsResult,
      upcomingEventsResult,
      pastEventsResult,
      pendingApprovalResult,
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
              AND event_date < DATE_TRUNC('month', CURRENT_DATE)
                + INTERVAL '1 month'
          ) AS this_month_events,

          COUNT(*) FILTER (
            WHERE status = 'COMPLETED'
          ) AS completed_events,

          COUNT(*) FILTER (
            WHERE status = 'PENDING'
          ) AS pending_approvals

        FROM tbl_events
        `,
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
          venue,
          organizer,
          status,
          created_at,
          updated_at
        FROM tbl_events
        WHERE
          status IN ('APPROVED', 'ONGOING')
          AND event_date >= CURRENT_DATE
        ORDER BY event_date ASC, event_id ASC
        `,
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
          venue,
          organizer,
          status,
          created_at,
          updated_at
        FROM tbl_events
        WHERE status IN ('COMPLETED', 'CANCELLED')
        ORDER BY event_date DESC, event_id DESC
        `,
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
          venue,
          organizer,
          status,
          created_at,
          updated_at
        FROM tbl_events
        WHERE status = 'PENDING'
        ORDER BY event_date ASC, event_id ASC
        `,
      ),
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
          pending_approvals: Number(statistics.pending_approvals),
        },

        upcoming_events: upcomingEventsResult.rows,
        past_events: pastEventsResult.rows,
        pending_approval_events: pendingApprovalResult.rows,
      },
    );
  } catch (error) {
    console.error("Get Event Dashboard Error:", error);

    const message =
      process.env.NODE_ENV === "development"
        ? error.message
        : "Internal server error";

    return sendErrorResponse(res, 500, message);
  }
};

export const getAllEvents = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status: queryStatus,
    } = req.query;

    const pageNumber = Number(page);
    const limitNumber = Number(limit);

    if (!Number.isInteger(pageNumber) || pageNumber <= 0) {
      return sendErrorResponse(res, 400, "Invalid page");
    }

    if (
      !Number.isInteger(limitNumber) ||
      limitNumber <= 0 ||
      limitNumber > 100
    ) {
      return sendErrorResponse(
        res,
        400,
        "Invalid limit. Maximum limit is 100",
      );
    }

    const status = queryStatus?.trim().toUpperCase();

    if (
      status !== undefined &&
      !EVENT_STATUSES.includes(status)
    ) {
      return sendErrorResponse(
        res,
        400,
        "Invalid status. Allowed values are PENDING, APPROVED, ONGOING, COMPLETED, CANCELLED",
      );
    }

    /*
     * Automatically update event statuses based on
     * event date and event slot.
     */
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
      `,
    );

    const conditions = [];
    const values = [];

    if (status !== undefined) {
      values.push(status);

      conditions.push(
        `status = $${values.length}`,
      );
    }

    const whereClause =
      conditions.length > 0
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

    const countResult = await pool.query(
      `
      SELECT COUNT(*) AS total
      FROM tbl_events
      ${whereClause}
      `,
      values,
    );

    const total = Number(
      countResult.rows[0].total,
    );

    const statisticsResult = await pool.query(
      `
      SELECT
        COUNT(*)::INTEGER AS total_events,

        COUNT(
          CASE
            WHEN event_date >= CURRENT_DATE
              AND status NOT IN ('COMPLETED', 'CANCELLED')
            THEN 1
          END
        )::INTEGER AS upcoming_events,

        COUNT(
          CASE
            WHEN event_date >= DATE_TRUNC('month', CURRENT_DATE)
              AND event_date < (
                DATE_TRUNC('month', CURRENT_DATE)
                + INTERVAL '1 month'
              )
            THEN 1
          END
        )::INTEGER AS this_month_events,

        COUNT(
          CASE
            WHEN status = 'COMPLETED'
            THEN 1
          END
        )::INTEGER AS completed_events

      FROM tbl_events
      `,
    );

    const statistics = statisticsResult.rows[0];

    const offset =
      (pageNumber - 1) * limitNumber;

    const dataValues = [...values];

    dataValues.push(limitNumber);
    const limitIndex = dataValues.length;

    dataValues.push(offset);
    const offsetIndex = dataValues.length;

    const result = await pool.query(
      `
      SELECT
        event_id,
        event_name,
        category,
        event_date,
        event_slot,
        description,
        venue,
        organizer,
        status,
        created_at,
        updated_at
      FROM tbl_events
      ${whereClause}
      ORDER BY
        event_date ASC,
        event_id ASC
      LIMIT $${limitIndex}
      OFFSET $${offsetIndex}
      `,
      dataValues,
    );

    return sendSuccessResponse(
      res,
      200,
      "Events fetched successfully",
      {
        filters: {
          status: status ?? null,
        },

        event_statistics: {
          total_events: statistics.total_events,
          upcoming_events: statistics.upcoming_events,
          this_month_events: statistics.this_month_events,
          completed_events: statistics.completed_events,
        },

        pagination_info: {
          page: pageNumber,
          limit: limitNumber,

          prev_page:
            pageNumber > 1
              ? pageNumber - 1
              : null,

          next_page:
            pageNumber <
              Math.ceil(total / limitNumber)
              ? pageNumber + 1
              : null,

          total,
          total_pages: Math.ceil(
            total / limitNumber,
          ),
        },

        events: result.rows,
      },
    );
  } catch (error) {
    console.error(
      "Get All Events Error:",
      error,
    );

    const message =
      process.env.NODE_ENV === "development"
        ? error.message
        : "Internal server error";

    return sendErrorResponse(
      res,
      500,
      message,
    );
  }
};

export const getEventById = async (req, res) => {
  try {
    const { event_id } = req.params;

    if (!isValidId(event_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid event ID is required",
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
        venue,
        organizer,
        status,
        created_at,
        updated_at
      FROM tbl_events
      WHERE event_id = $1
      `,
      [Number(event_id)],
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Event with ID ${event_id} not found`,
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Event fetched successfully",
      result.rows[0],
    );
  } catch (error) {
    console.error(
      "Get Event By ID Error:",
      error,
    );

    const message =
      process.env.NODE_ENV === "development"
        ? error.message
        : "Internal server error";

    return sendErrorResponse(
      res,
      500,
      message,
    );
  }
};

export const updateEvent = async (req, res) => {
  try {
    const { event_id } = req.params;

    if (!isValidId(event_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid event ID is required",
      );
    }

    const {
      event_name,
      category,
      event_date,
      event_slot,
      description,
      venue,
      organizer,
    } = req.body;

    const existingEvent = await pool.query(
      `
      SELECT event_id
      FROM tbl_events
      WHERE event_id = $1
      `,
      [Number(event_id)],
    );

    if (existingEvent.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Event with ID ${event_id} not found`,
      );
    }

    const fields = [];
    const values = [];

    const updates = {
      event_name,
      category,
      event_date,
      event_slot,
      description,
      venue,
      organizer,
    };

    Object.entries(updates).forEach(
      ([field, value]) => {
        if (value !== undefined) {
          fields.push(
            `${field} = $${values.length + 1}`,
          );

          values.push(
            typeof value === "string"
              ? value.trim()
              : value,
          );
        }
      },
    );

    /*
     * Nothing except updated_at was supplied.
     */
    if (fields.length === 0) {
      return sendErrorResponse(
        res,
        400,
        "No fields provided for update",
      );
    }

    fields.push(
      "updated_at = CURRENT_TIMESTAMP",
    );

    values.push(Number(event_id));

    const result = await pool.query(
      `
      UPDATE tbl_events
      SET ${fields.join(", ")}
      WHERE event_id = $${values.length}
      RETURNING *
      `,
      values,
    );

    return sendSuccessResponse(
      res,
      200,
      "Event updated successfully",
      result.rows[0],
    );
  } catch (error) {
    console.error(
      "Update Event Error:",
      error,
    );

    if (error.code === "23505") {
      return sendErrorResponse(
        res,
        409,
        "An event already exists for the selected date and time slot",
      );
    }

    return sendErrorResponse(
      res,
      500,
      process.env.NODE_ENV === "development"
        ? error.message
        : "Internal server error",
    );
  }
};

export const updateEventStatus = async (req, res) => {
  try {
    const { event_id } = req.params;
    const { status } = req.body || {};

    if (!isValidId(event_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid event ID is required",
      );
    }

    if (!status) {
      return sendErrorResponse(
        res,
        400,
        "Status is required",
      );
    }

    const normalizedStatus = status
      .toString()
      .trim()
      .toUpperCase();

    if (!EVENT_STATUSES.includes(normalizedStatus)) {
      return sendErrorResponse(
        res,
        400,
        "Invalid status. Allowed values are PENDING, APPROVED, ONGOING, COMPLETED, CANCELLED",
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
      [Number(event_id)],
    );

    if (existingEvent.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Event with ID ${event_id} not found`,
      );
    }

    const currentStatus =
      existingEvent.rows[0].status;

    if (
      !allowedTransitions[currentStatus]?.includes(
        normalizedStatus,
      )
    ) {
      return sendErrorResponse(
        res,
        400,
        `Cannot change event status from ${currentStatus} to ${normalizedStatus}`,
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
        normalizedStatus,
        Number(event_id),
      ],
    );

    return sendSuccessResponse(
      res,
      200,
      "Event status updated successfully",
      result.rows[0],
    );
  } catch (error) {
    console.error(
      "Update Event Status Error:",
      error,
    );

    const message =
      process.env.NODE_ENV === "development"
        ? error.message
        : "Internal server error";

    return sendErrorResponse(
      res,
      500,
      message,
    );
  }
};
