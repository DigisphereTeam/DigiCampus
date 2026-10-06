import pool from "../config/database.js";
import { sendErrorResponse, sendSuccessResponse } from "../utils/response.js";
import { isValidId } from "../utils/validation.js";


export const createNotification = async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      title,
      message,
      notification_type,
      source = "MANUAL",
      reference_id,
      reference_type,
      targets
    } = req.body;

    const created_by = req.user.user_id;

    if (!Array.isArray(targets) || targets.length === 0) {
      return sendErrorResponse(res, 400, "Notification targets are required");
    }

    await client.query("BEGIN");

    const notificationResult = await client.query(
      `
        INSERT INTO tbl_notifications (
          title,
          message,
          notification_type,
          source,
          reference_id,
          reference_type,
          created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `,
      [
        title,
        message,
        notification_type,
        source,
        reference_id || null,
        reference_type || null,
        created_by
      ]
    );

    const notification = notificationResult.rows[0];

    for (const target of targets) {
      await client.query(
        `
          INSERT INTO tbl_notification_targets (
            notification_id,
            target_type,
            target_role,
            class_section_id,
            target_user_id
          )
          VALUES ($1, $2, $3, $4, $5)
        `,
        [
          notification.notification_id,
          target.target_type,
          target.target_role || null,
          target.class_section_id || null,
          target.target_user_id || null
        ]
      );
    }

    await client.query("COMMIT");

    return sendSuccessResponse(
      res,
      201,
      "Notification created successfully",
      notification
    );
  } catch (error) {
    await client.query("ROLLBACK");

    return sendErrorResponse(
      res,
      500,
      "Failed to create notification"
    );
  } finally {
    client.release();
  }
};

export const getNotifications = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      notification_type,
      source,
      target_type
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);

    const values = [];
    const conditions = [];

    if (search) {
      values.push(`%${search.trim()}%`);
      conditions.push(
        `(n.title ILIKE $${values.length} OR n.message ILIKE $${values.length})`
      );
    }

    if (notification_type) {
      values.push(notification_type);
      conditions.push(`n.notification_type = $${values.length}`);
    }

    if (source) {
      values.push(source);
      conditions.push(`n.source = $${values.length}`);
    }

    if (target_type) {
      values.push(target_type);
      conditions.push(`
        EXISTS (
          SELECT 1
          FROM tbl_notification_targets nt_filter
          WHERE nt_filter.notification_id = n.notification_id
          AND nt_filter.target_type = $${values.length}
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
        FROM tbl_notifications n
        ${whereClause}
      `,
      values
    );

    const total = Number(countResult.rows[0].total);

    const dataValues = [...values, Number(limit), offset];

    const result = await pool.query(
      `
        SELECT
          n.notification_id,
          n.title,
          n.message,
          n.notification_type,
          n.source,
          n.reference_id,
          n.reference_type,
          n.created_by,
          n.created_at,
          n.updated_at,
          COALESCE(
            JSON_AGG(
              DISTINCT JSONB_BUILD_OBJECT(
                'target_type', nt.target_type,
                'target_role', nt.target_role,
                'class_section_id', nt.class_section_id,
                'target_user_id', nt.target_user_id
              )
            ) FILTER (WHERE nt.notification_target_id IS NOT NULL),
            '[]'
          ) AS targets
        FROM tbl_notifications n
        LEFT JOIN tbl_notification_targets nt
          ON nt.notification_id = n.notification_id
        ${whereClause}
        GROUP BY n.notification_id
        ORDER BY n.created_at DESC
        LIMIT $${dataValues.length - 1}
        OFFSET $${dataValues.length}
      `,
      dataValues
    );

    return sendSuccessResponse(res, 200, "Notifications fetched successfully", {
      data: result.rows,
      filters: {
        search: search || "",
        notification_type: notification_type || "",
        source: source || "",
        target_type: target_type || ""
      },
      pagination_info: {
        current_page: Number(page),
        limit: Number(limit),
        total_records: total,
        total_pages: Math.ceil(total / Number(limit)),
        has_next_page: Number(page) < Math.ceil(total / Number(limit)),
        has_previous_page: Number(page) > 1
      }
    });
  } catch (error) {
    return sendErrorResponse(
      res,
      500,
      "Failed to fetch notifications"
    );
  }
};

export const getNotificationById = async (req, res) => {
  try {
    const { notification_id } = req.params;

    if (!isValidId(notification_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid notification ID is required"
      );
    }

    const result = await pool.query(
      `
        SELECT
          n.notification_id,
          n.title,
          n.message,
          n.notification_type,
          n.source,
          n.reference_id,
          n.reference_type,
          n.created_by,
          n.created_at,
          n.updated_at,
          COALESCE(
            JSON_AGG(
              DISTINCT JSONB_BUILD_OBJECT(
                'notification_target_id', nt.notification_target_id,
                'target_type', nt.target_type,
                'target_role', nt.target_role,
                'class_section_id', nt.class_section_id,
                'target_user_id', nt.target_user_id
              )
            ) FILTER (WHERE nt.notification_target_id IS NOT NULL),
            '[]'
          ) AS targets
        FROM tbl_notifications n
        LEFT JOIN tbl_notification_targets nt
          ON nt.notification_id = n.notification_id
        WHERE n.notification_id = $1
        GROUP BY n.notification_id
      `,
      [notification_id]
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Notification with ID ${notification_id} not found`
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Notification fetched successfully",
      result.rows[0]
    );
  } catch (error) {
    return sendErrorResponse(
      res,
      500,
      "Failed to fetch notification"
    );
  }
};

export const getMyNotifications = async (req, res) => {
  try {
    const user_id = req.user.user_id;
    const role = req.user.role;

    const {
      page = 1,
      limit = 10,
      notification_type
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);

    const values = [user_id, role];
    const conditions = [];

    conditions.push(`
      (
        nt.target_type = 'ALL_USERS'
        OR (
          nt.target_type = 'ROLE'
          AND nt.target_role = $2
        )
        OR (
          nt.target_type = 'USER'
          AND nt.target_user_id = $1
        )
        OR (
          nt.target_type = 'CLASS_SECTION'
          AND nt.class_section_id IN (
            SELECT scs.class_section_id
            FROM tbl_students s
            INNER JOIN tbl_student_class_sections scs
              ON scs.student_id = s.student_id
            WHERE s.user_id = $1
              AND scs.start_date <= CURRENT_DATE
          )
        )
      )
    `);

    if (notification_type) {
      values.push(notification_type);
      conditions.push(
        `n.notification_type = $${values.length}`
      );
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    const countResult = await pool.query(
      `
        SELECT COUNT(DISTINCT n.notification_id) AS total
        FROM tbl_notifications n
        INNER JOIN tbl_notification_targets nt
          ON nt.notification_id = n.notification_id
        ${whereClause}
      `,
      values
    );

    const total = Number(countResult.rows[0].total);

    const dataValues = [
      ...values,
      Number(limit),
      offset
    ];

    const result = await pool.query(
      `
        SELECT DISTINCT
          n.notification_id,
          n.title,
          n.message,
          n.notification_type,
          n.source,
          n.reference_id,
          n.reference_type,
          n.created_at
        FROM tbl_notifications n
        INNER JOIN tbl_notification_targets nt
          ON nt.notification_id = n.notification_id
        ${whereClause}
        ORDER BY n.created_at DESC
        LIMIT $${dataValues.length - 1}
        OFFSET $${dataValues.length}
      `,
      dataValues
    );

    return sendSuccessResponse(
      res,
      200,
      "My notifications fetched successfully",
      {
        data: result.rows,
        filters: {
          notification_type: notification_type || ""
        },
        pagination_info: {
          current_page: Number(page),
          limit: Number(limit),
          total_records: total,
          total_pages: Math.ceil(total / Number(limit)),
          has_next_page:
            Number(page) < Math.ceil(total / Number(limit)),
          has_previous_page: Number(page) > 1
        }
      }
    );
  } catch (error) {
    return sendErrorResponse(
      res,
      500,
      "Failed to fetch my notifications"
    );
  }
};

export const deleteNotification = async (req, res) => {
  try {
    const { notification_id } = req.params;

    if (!isValidId(notification_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid notification ID is required"
      );
    }

    const result = await pool.query(
      `
        DELETE FROM tbl_notifications
        WHERE notification_id = $1
        RETURNING notification_id
      `,
      [notification_id]
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Notification with ID ${notification_id} not found`
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Notification deleted successfully"
    );
  } catch (error) {
    return sendErrorResponse(
      res,
      500,
      "Failed to delete notification"
    );
  }
};