import pool from "../config/database.js";
import { getCurrentDate } from "../utils/date.js";
import {
  sendErrorResponse,
  sendSuccessResponse
} from "../utils/response.js";
import { isValidId } from "../utils/validation.js";

export const addRevenue = async (req, res) => {
  try {
    const {
      revenue_category_id,
      amount,
      revenue_date,
      receipt_number,
      payment_mode,
      description
    } = req.body;

    const academicYearResult = await pool.query(
      `SELECT academic_year_id
       FROM tbl_academic_years
       WHERE is_current = true
       LIMIT 1`
    );

    if (academicYearResult.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        "Current academic year not found"
      );
    }

    const academic_year_id =
      academicYearResult.rows[0].academic_year_id;

    const categoryResult = await pool.query(
      `SELECT revenue_category_id
       FROM tbl_revenue_categories
       WHERE revenue_category_id = $1
         AND is_active = true`,
      [revenue_category_id]
    );

    if (categoryResult.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Revenue category with ID ${revenue_category_id} not found`
      );
    }

    const result = await pool.query(
      `INSERT INTO tbl_revenues (
        academic_year_id,
        revenue_category_id,
        amount,
        revenue_date,
        receipt_number,
        payment_mode,
        description,
        added_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *`,
      [
        academic_year_id,
        revenue_category_id,
        amount,
        revenue_date || getCurrentDate(),
        receipt_number || null,
        payment_mode,
        description || null,
        req.user.user_id
      ]
    );

    return sendSuccessResponse(
      res,
      201,
      "Revenue added successfully",
      result.rows[0]
    );
  } catch (error) {
    console.log("Add revenue error:", error);

    return sendErrorResponse(
      res,
      500,
      "Failed to add revenue"
    );
  }
};

export const getRevenues = async (req, res) => {
  try {
    const {
      category_id,
      payment_mode,
      from_date,
      to_date,
      search,
      page = 1,
      limit = 10
    } = req.query;

    const academicYearResult = await pool.query(
      `SELECT academic_year_id
       FROM tbl_academic_years
       WHERE is_current = true
       LIMIT 1`
    );

    if (academicYearResult.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        "Current academic year not found"
      );
    }

    const academic_year_id =
      academicYearResult.rows[0].academic_year_id;

    const conditions = [
      "r.academic_year_id = $1",
      "r.is_active = true"
    ];

    const values = [academic_year_id];
    let parameterIndex = 2;

    if (category_id) {
      conditions.push(
        `r.revenue_category_id = $${parameterIndex}`
      );
      values.push(category_id);
      parameterIndex++;
    }

    if (payment_mode) {
      conditions.push(
        `r.payment_mode = $${parameterIndex}`
      );
      values.push(payment_mode);
      parameterIndex++;
    }

    if (from_date) {
      conditions.push(
        `r.revenue_date >= $${parameterIndex}`
      );
      values.push(from_date);
      parameterIndex++;
    }

    if (to_date) {
      conditions.push(
        `r.revenue_date <= $${parameterIndex}`
      );
      values.push(to_date);
      parameterIndex++;
    }

    if (search) {
      conditions.push(
        `(rc.category_name ILIKE $${parameterIndex}
         OR r.receipt_number ILIKE $${parameterIndex}
         OR r.description ILIKE $${parameterIndex})`
      );
      values.push(`%${search}%`);
      parameterIndex++;
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total
       FROM tbl_revenues r
       JOIN tbl_revenue_categories rc
         ON rc.revenue_category_id = r.revenue_category_id
       WHERE ${conditions.join(" AND ")}`,
      values
    );

    const offset = (Number(page) - 1) * Number(limit);

    values.push(Number(limit));
    values.push(offset);

    const result = await pool.query(
      `SELECT
        r.revenue_id,
        r.academic_year_id,
        r.revenue_category_id,
        rc.category_name,
        r.amount,
        r.revenue_date,
        r.receipt_number,
        r.payment_mode,
        r.description,
        r.added_by,
        u.full_name AS added_by_name,
        r.created_at
       FROM tbl_revenues r
       JOIN tbl_revenue_categories rc
         ON rc.revenue_category_id = r.revenue_category_id
       LEFT JOIN tbl_users u
         ON u.user_id = r.added_by
       WHERE ${conditions.join(" AND ")}
       ORDER BY r.revenue_date DESC, r.revenue_id DESC
       LIMIT $${parameterIndex}
       OFFSET $${parameterIndex + 1}`,
      values
    );

    return sendSuccessResponse(
      res,
      200,
      "Revenues fetched successfully",
      {
        data: result.rows,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: Number(countResult.rows[0].total),
          total_pages: Math.ceil(
            Number(countResult.rows[0].total) / Number(limit)
          )
        },
        filters: {
          category_id: category_id || null,
          payment_mode: payment_mode || null,
          from_date: from_date || null,
          to_date: to_date || null,
          search: search || "",
          page: Number(page),
          limit: Number(limit)
        }
      }
    );
  } catch (error) {
    console.log("Get revenues error:", error);

    return sendErrorResponse(
      res,
      500,
      "Failed to fetch revenues"
    );
  }
};

export const getRevenueById = async (req, res) => {
  try {
    const { revenue_id } = req.params;

    if (!isValidId(revenue_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid revenue ID is required"
      );
    }

    const result = await pool.query(
      `SELECT
        r.revenue_id,
        r.academic_year_id,
        r.revenue_category_id,
        rc.category_name,
        r.amount,
        r.revenue_date,
        r.receipt_number,
        r.payment_mode,
        r.description,
        r.added_by,
        u.full_name AS added_by_name,
        r.created_at,
        r.updated_at
       FROM tbl_revenues r
       JOIN tbl_revenue_categories rc
         ON rc.revenue_category_id = r.revenue_category_id
       LEFT JOIN tbl_users u
         ON u.user_id = r.added_by
       WHERE r.revenue_id = $1
         AND r.is_active = true`,
      [revenue_id]
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Revenue with ID ${revenue_id} not found`
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Revenue fetched successfully",
      result.rows[0]
    );
  } catch (error) {
    console.log("Get revenue by ID error:", error);

    return sendErrorResponse(
      res,
      500,
      "Failed to fetch revenue"
    );
  }
};

export const updateRevenue = async (req, res) => {
  try {
    const { revenue_id } = req.params;

    if (!isValidId(revenue_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid revenue ID is required"
      );
    }

    const {
      revenue_category_id,
      amount,
      revenue_date,
      receipt_number,
      payment_mode,
      description
    } = req.body;

    const fields = [];
    const values = [];

    if (revenue_category_id !== undefined) {
      const categoryResult = await pool.query(
        `SELECT revenue_category_id
         FROM tbl_revenue_categories
         WHERE revenue_category_id = $1
           AND is_active = true`,
        [revenue_category_id]
      );

      if (categoryResult.rows.length === 0) {
        return sendErrorResponse(
          res,
          404,
          `Revenue category with ID ${revenue_category_id} not found`
        );
      }

      values.push(revenue_category_id);
      fields.push(`revenue_category_id = $${values.length}`);
    }

    if (amount !== undefined) {
      values.push(amount);
      fields.push(`amount = $${values.length}`);
    }

    if (revenue_date !== undefined) {
      values.push(revenue_date);
      fields.push(`revenue_date = $${values.length}`);
    }

    if (receipt_number !== undefined) {
      values.push(receipt_number);
      fields.push(`receipt_number = $${values.length}`);
    }

    if (payment_mode !== undefined) {
      values.push(payment_mode);
      fields.push(`payment_mode = $${values.length}`);
    }

    if (description !== undefined) {
      values.push(description);
      fields.push(`description = $${values.length}`);
    }

    if (!fields.length) {
      return sendErrorResponse(
        res,
        400,
        "No fields provided for update"
      );
    }

    values.push(revenue_id);

    const result = await pool.query(
      `UPDATE tbl_revenues
       SET ${fields.join(", ")},
           updated_at = CURRENT_TIMESTAMP
       WHERE revenue_id = $${values.length}
         AND is_active = true
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Revenue with ID ${revenue_id} not found`
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Revenue updated successfully",
      result.rows[0]
    );
  } catch (error) {
    console.log("Update revenue error:", error);

    return sendErrorResponse(
      res,
      500,
      "Failed to update revenue"
    );
  }
};

export const deleteRevenue = async (req, res) => {
  try {
    const { revenue_id } = req.params;

    if (!isValidId(revenue_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid revenue ID is required"
      );
    }

    const result = await pool.query(
      `UPDATE tbl_revenues
       SET is_active = false,
           updated_at = CURRENT_TIMESTAMP
       WHERE revenue_id = $1
         AND is_active = true
       RETURNING revenue_id`,
      [revenue_id]
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Revenue with ID ${revenue_id} not found`
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Revenue deleted successfully"
    );
  } catch (error) {
    console.log("Delete revenue error:", error);

    return sendErrorResponse(
      res,
      500,
      "Failed to delete revenue"
    );
  }
};