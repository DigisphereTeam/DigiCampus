import pool from "../config/db.js";
import {
  sendErrorResponse,
  sendSuccessResponse,
} from "../utils/response.js";

const LEAVE_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
];

export const createLeave = async (req, res) => {
  try {
    const {
      employee_id,
      leave_type_id,
      from_date,
      to_date,
      reason,
    } = req.body || {};

    const result = await pool.query(
      `
      INSERT INTO tbl_leaves (
        employee_id,
        leave_type_id,
        from_date,
        to_date,
        reason,
        status
      )
      VALUES ($1, $2, $3, $4, $5, 'PENDING')
      RETURNING *
      `,
      [
        Number(employee_id),
        Number(leave_type_id),
        from_date,
        to_date,
        reason.trim(),
      ],
    );

    return sendSuccessResponse(
      res,
      201,
      "Leave application submitted successfully",
      result.rows[0],
    );
  } catch (error) {
    console.error("Create Leave Error:", error);

    return sendErrorResponse(
      res,
      500,
      process.env.NODE_ENV === "development"
        ? error.message
        : "Internal server error",
    );
  }
};

export const getLeaves = async (req, res) => {
  try {
    const {
      employee_id,
      leave_type_id,
      status,
      from_date,
      to_date,
      page = 1,
      limit = 10,
    } = req.query;

    const conditions = [];
    const values = [];

    if (employee_id !== undefined) {
      conditions.push(`l.employee_id = $${values.length + 1}`);
      values.push(Number(employee_id));
    }

    if (leave_type_id !== undefined) {
      conditions.push(`l.leave_type_id = $${values.length + 1}`);
      values.push(Number(leave_type_id));
    }

    if (status !== undefined) {
      conditions.push(`l.status = $${values.length + 1}`);
      values.push(status.trim().toUpperCase());
    }

    if (from_date !== undefined) {
      conditions.push(`l.from_date >= $${values.length + 1}`);
      values.push(from_date);
    }

    if (to_date !== undefined) {
      conditions.push(`l.to_date <= $${values.length + 1}`);
      values.push(to_date);
    }

    const offset = (Number(page) - 1) * Number(limit);

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const result = await pool.query(
      `
      SELECT
        l.*,
        e.employee_code,
        e.full_name,
        lt.leave_type_name
      FROM tbl_leaves l
      JOIN tbl_employees e
        ON e.employee_id = l.employee_id
      JOIN tbl_leave_types lt
        ON lt.leave_type_id = l.leave_type_id
      ${whereClause}
      ORDER BY l.created_at DESC
      LIMIT $${values.length + 1}
      OFFSET $${values.length + 2}
      `,
      [...values, Number(limit), offset],
    );

    return sendSuccessResponse(
      res,
      200,
      "Leaves fetched successfully",
      result.rows,
    );
  } catch (error) {
    console.error("Get Leaves Error:", error);

    return sendErrorResponse(
      res,
      500,
      process.env.NODE_ENV === "development"
        ? error.message
        : "Internal server error",
    );
  }
};

export const getLeaveById = async (req, res) => {
  try {
    const { leave_id } = req.params;

    const result = await pool.query(
      `
      SELECT
        l.*,
        e.employee_code,
        e.full_name,
        lt.leave_type_name
      FROM tbl_leaves l
      JOIN tbl_employees e
        ON e.employee_id = l.employee_id
      JOIN tbl_leave_types lt
        ON lt.leave_type_id = l.leave_type_id
      WHERE l.leave_id = $1
      `,
      [Number(leave_id)],
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Leave with ID ${leave_id} not found`,
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Leave fetched successfully",
      result.rows[0],
    );
  } catch (error) {
    console.error("Get Leave Error:", error);

    return sendErrorResponse(
      res,
      500,
      process.env.NODE_ENV === "development"
        ? error.message
        : "Internal server error",
    );
  }
};

export const updateLeave = async (req, res) => {
  try {
    const { leave_id } = req.params;

    const {
      leave_type_id,
      from_date,
      to_date,
      reason,
    } = req.body || {};

    const updates = {
      leave_type_id,
      from_date,
      to_date,
      reason,
    };

    const fields = [];
    const values = [];

    Object.entries(updates).forEach(([field, value]) => {
      if (value !== undefined) {
        fields.push(`${field} = $${values.length + 1}`);
        values.push(
          typeof value === "string" ? value.trim() : value,
        );
      }
    });

    if (fields.length === 0) {
      return sendErrorResponse(
        res,
        400,
        "At least one field is required for update",
      );
    }

    fields.push("updated_at = CURRENT_TIMESTAMP");

    values.push(Number(leave_id));

    const result = await pool.query(
      `
      UPDATE tbl_leaves
      SET ${fields.join(", ")}
      WHERE leave_id = $${values.length}
      RETURNING *
      `,
      values,
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Leave with ID ${leave_id} not found`,
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Leave updated successfully",
      result.rows[0],
    );
  } catch (error) {
    console.error("Update Leave Error:", error);

    return sendErrorResponse(
      res,
      500,
      process.env.NODE_ENV === "development"
        ? error.message
        : "Internal server error",
    );
  }
};

export const updateLeaveStatus = async (req, res) => {
  try {
    const { leave_id } = req.params;
    const { status } = req.body || {};

    const newStatus = status.trim().toUpperCase();

    if (!LEAVE_STATUSES.includes(newStatus)) {
      return sendErrorResponse(res, 400, "Invalid leave status");
    }

    const result = await pool.query(
      `
      UPDATE tbl_leaves
      SET
        status = $1,
        approved_by = $2,
        approved_at = CASE
          WHEN $1 = 'APPROVED' THEN CURRENT_TIMESTAMP
          ELSE approved_at
        END,
        updated_at = CURRENT_TIMESTAMP
      WHERE leave_id = $3
      RETURNING *
      `,
      [
        newStatus,
        req.user?.user_id || null,
        Number(leave_id),
      ],
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Leave with ID ${leave_id} not found`,
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Leave status updated successfully",
      result.rows[0],
    );
  } catch (error) {
    console.error("Update Leave Status Error:", error);

    return sendErrorResponse(
      res,
      500,
      process.env.NODE_ENV === "development"
        ? error.message
        : "Internal server error",
    );
  }
};

export const cancelLeave = async (req, res) => {
  try {
    const { leave_id } = req.params;

    const result = await pool.query(
      `
      UPDATE tbl_leaves
      SET
        status = 'CANCELLED',
        updated_at = CURRENT_TIMESTAMP
      WHERE leave_id = $1
        AND status = 'PENDING'
      RETURNING *
      `,
      [Number(leave_id)],
    );

    if (result.rows.length === 0) {
      const existingLeave = await pool.query(
        `
        SELECT leave_id, status
        FROM tbl_leaves
        WHERE leave_id = $1
        `,
        [Number(leave_id)],
      );

      if (existingLeave.rows.length === 0) {
        return sendErrorResponse(
          res,
          404,
          `Leave with ID ${leave_id} not found`,
        );
      }

      return sendErrorResponse(
        res,
        409,
        `Leave with ID ${leave_id} cannot be cancelled`,
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Leave cancelled successfully",
      result.rows[0],
    );
  } catch (error) {
    console.error("Cancel Leave Error:", error);

    return sendErrorResponse(
      res,
      500,
      process.env.NODE_ENV === "development"
        ? error.message
        : "Internal server error",
    );
  }
};

export const deleteLeave = async (req, res) => {
  try {
    const { leave_id } = req.params;

    const result = await pool.query(
      `
      DELETE FROM tbl_leaves
      WHERE leave_id = $1
      RETURNING leave_id
      `,
      [Number(leave_id)],
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Leave with ID ${leave_id} not found`,
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Leave deleted successfully",
      result.rows[0],
    );
  } catch (error) {
    console.error("Delete Leave Error:", error);

    return sendErrorResponse(
      res,
      500,
      process.env.NODE_ENV === "development"
        ? error.message
        : "Internal server error",
    );
  }
};