import bcrypt from "bcryptjs";
import pool from "../config/database.js";
import { getCurrentDate, isValidDate } from "../utils/date.js";
import {
  sendErrorResponse,
  sendSuccessResponse,
} from "../utils/response.js";
import { isValidId } from "../utils/validation.js";

export const getStaffProfile = async (req, res) => {
  try {
    const { staff_id } = req.params;

    if (!isValidId(staff_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid staff ID is required"
      );
    }

    const result = await pool.query(
      `
      SELECT
        s.staff_id,
        s.user_id,
        s.staff_code,
        s.full_name,
        s.email,
        s.phone,
        s.gender,
        s.date_of_birth,
        s.department_id,
        d.department_name,
        s.designation,
        s.joining_date,
        s.address,
        s.is_active,
        s.created_at,
        s.updated_at
      FROM tbl_staff s
      LEFT JOIN tbl_departments d
        ON d.department_id = s.department_id
      WHERE s.staff_id = $1
      `,
      [staff_id]
    );

    if (result.rowCount === 0) {
      return sendErrorResponse(
        res,
        404,
        `Staff with ID ${staff_id} not found`
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Staff profile fetched successfully",
      result.rows[0]
    );
  } catch (error) {
    console.error(error);

    return sendErrorResponse(
      res,
      500,
      "Failed to fetch staff profile"
    );
  }
};

export const createStaff = async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      full_name,
      email,
      password,
      phone,
      gender,
      date_of_birth,
      department_id,
      designation,
      joining_date,
      address,
    } = req.body;

    await client.query("BEGIN");

    const existingUser = await client.query(
      `
      SELECT user_id
      FROM tbl_users
      WHERE email = $1
      `,
      [email]
    );

    if (existingUser.rowCount > 0) {
      await client.query("ROLLBACK");

      return sendErrorResponse(
        res,
        409,
        "Staff with this email already exists"
      );
    }

    const departmentResult = await client.query(
      `
      SELECT department_id
      FROM tbl_departments
      WHERE department_id = $1
      `,
      [department_id]
    );

    if (departmentResult.rowCount === 0) {
      await client.query("ROLLBACK");

      return sendErrorResponse(
        res,
        404,
        `Department with ID ${department_id} not found`
      );
    }

    const currentYear = new Date().getFullYear();
    const prefix = `S${currentYear}`;

    const codeResult = await client.query(
      `
      SELECT COALESCE(
        MAX(SUBSTRING(staff_code FROM ${prefix.length + 1})::INTEGER),
        0
      ) + 1 AS sequence
      FROM tbl_staff
      WHERE staff_code LIKE $1
      `,
      [`${prefix}%`]
    );

    const sequence = codeResult.rows[0].sequence;
    const staff_code = `${prefix}${String(sequence).padStart(4, "0")}`;

    const hashedPassword = await bcrypt.hash(password, 10);

    const userResult = await client.query(
      `
      INSERT INTO tbl_users (
        full_name,
        email,
        password_hash,
        role
      )
      VALUES ($1, $2, $3, $4)
      RETURNING user_id
      `,
      [
        full_name,
        email,
        hashedPassword,
        "STAFF",
      ]
    );

    const user_id = userResult.rows[0].user_id;

    const result = await client.query(
      `
      INSERT INTO tbl_staff (
        user_id,
        staff_code,
        full_name,
        email,
        phone,
        gender,
        date_of_birth,
        department_id,
        designation,
        joining_date,
        address
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
      )
      RETURNING *
      `,
      [
        user_id,
        staff_code,
        full_name,
        email,
        phone,
        gender,
        date_of_birth || null,
        department_id,
        designation || null,
        joining_date,
        address || null,
      ]
    );

    await client.query("COMMIT");

    const staff = result.rows[0];

    delete staff.user_id;

    return sendSuccessResponse(
      res,
      201,
      "Staff created successfully",
      staff
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);

    return sendErrorResponse(
      res,
      500,
      "Failed to create staff"
    );
  } finally {
    client.release();
  }
};

export const getStaff = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      status,
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
        "Invalid page"
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
        "Invalid limit. Maximum limit is 100"
      );
    }

    const conditions = [];
    const values = [];

    if (search !== undefined && search !== null) {
      if (typeof search !== "string") {
        return sendErrorResponse(
          res,
          400,
          "Invalid search"
        );
      }

      const cleanSearch = search.trim();

      if (cleanSearch) {
        values.push(`%${cleanSearch}%`);

        conditions.push(`
          (
            s.full_name ILIKE $${values.length}
            OR s.staff_code ILIKE $${values.length}
            OR s.email ILIKE $${values.length}
            OR s.phone ILIKE $${values.length}
          )
        `);
      }
    }

    if (status !== undefined && status !== null) {
      if (typeof status !== "string") {
        return sendErrorResponse(
          res,
          400,
          "Invalid staff status"
        );
      }

      const normalizedStatus = status
        .trim()
        .toUpperCase();

      if (!["ACTIVE", "INACTIVE"].includes(normalizedStatus)) {
        return sendErrorResponse(
          res,
          400,
          "Invalid staff status"
        );
      }

      values.push(normalizedStatus === "ACTIVE");

      conditions.push(
        `s.is_active = $${values.length}`
      );
    }

    const whereClause =
      conditions.length > 0
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

    const countResult = await pool.query(
      `
        SELECT COUNT(*) AS total
        FROM tbl_staff s
        LEFT JOIN tbl_departments d
          ON d.department_id = s.department_id
        ${whereClause}
      `,
      values
    );

    const total = Number(countResult.rows[0].total);

    const statisticsResult = await pool.query(
      `
        SELECT
          COUNT(*) AS total_staff,
          COUNT(*) FILTER (
            WHERE is_active = TRUE
          ) AS active_staff,
          COUNT(*) FILTER (
            WHERE is_active = FALSE
          ) AS inactive_staff
        FROM tbl_staff
      `
    );

    const statistics = {
      total_staff: Number(
        statisticsResult.rows[0].total_staff
      ),
      active_staff: Number(
        statisticsResult.rows[0].active_staff
      ),
      inactive_staff: Number(
        statisticsResult.rows[0].inactive_staff
      ),
    };

    const dataValues = [...values];

    dataValues.push(limitNumber);
    const limitIndex = dataValues.length;

    dataValues.push(
      (pageNumber - 1) * limitNumber
    );
    const offsetIndex = dataValues.length;

    const result = await pool.query(
      `
        SELECT
          s.staff_id,
          s.staff_code,
          s.full_name,
          s.email,
          s.phone,
          s.gender,
          s.date_of_birth,
          s.department_id,
          d.department_name,
          s.designation,
          s.joining_date,
          s.address,
          s.is_active,
          s.created_at,
          s.updated_at
        FROM tbl_staff s
        LEFT JOIN tbl_departments d
          ON d.department_id = s.department_id
        ${whereClause}
        ORDER BY s.staff_id DESC
        LIMIT $${limitIndex}
        OFFSET $${offsetIndex}
      `,
      dataValues
    );

    return sendSuccessResponse(
      res,
      200,
      "Staff fetched successfully",
      {
        statistics,
        pagination_info: {
          page: pageNumber,
          limit: limitNumber,
          prev_page:
            pageNumber > 1
              ? pageNumber - 1
              : null,
          next_page:
            pageNumber < Math.ceil(total / limitNumber)
              ? pageNumber + 1
              : null,
          total,
          total_pages: Math.ceil(
            total / limitNumber
          ),
        },
        staff: result.rows,
      }
    );
  } catch (error) {
    next(error);
  }
};

export const getStaffById = async (req, res) => {
  try {
    const { staff_id } = req.params;

    if (!isValidId(staff_id)) {
      return sendErrorResponse(res, 400, "Valid staff Id is required");
    }

    const result = await pool.query(
      `
      SELECT
        s.staff_id,
        s.staff_code,
        s.full_name,
        s.email,
        s.phone,
        s.gender,
        s.date_of_birth,
        s.department_id,
        d.department_name,
        s.designation,
        s.joining_date,
        s.address,
        s.is_active,
        s.created_at,
        s.updated_at
      FROM tbl_staff s
      LEFT JOIN tbl_departments d
        ON d.department_id = s.department_id
      WHERE s.staff_id = $1
      `,
      [staff_id]
    );

    if (result.rowCount === 0) {
      return sendErrorResponse(
        res,
        404,
        `Staff with ID ${staff_id} not found`
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Staff fetched successfully",
      result.rows[0]
    );
  } catch (error) {
    console.error(error);

    return sendErrorResponse(
      res,
      500,
      "Failed to fetch staff"
    );
  }
};

export const updateStaff = async (req, res) => {
  try {
    const { staff_id } = req.params;

    if (!isValidId(staff_id)) {
      return sendErrorResponse(res, 400, "Valid staff Id is required");
    }


    const existingStaff = await pool.query(
      `
      SELECT staff_id, user_id
      FROM tbl_staff
      WHERE staff_id = $1
      `,
      [staff_id]
    );

    if (existingStaff.rowCount === 0) {
      return sendErrorResponse(
        res,
        404,
        `Staff with ID ${staff_id} not found`
      );
    }

    const {
      full_name,
      email,
      phone,
      gender,
      date_of_birth,
      department_id,
      designation,
      joining_date,
      address,
      is_active,
    } = req.body;

    if (email !== undefined) {
      const emailResult = await pool.query(
        `
        SELECT staff_id
        FROM tbl_staff
        WHERE email = $1
          AND staff_id <> $2
        `,
        [email, staff_id]
      );

      if (emailResult.rowCount > 0) {
        return sendErrorResponse(
          res,
          409,
          "Staff with this email already exists"
        );
      }

      const userEmailResult = await pool.query(
        `
        SELECT user_id
        FROM tbl_users
        WHERE email = $1
          AND user_id <> $2
        `,
        [
          email,
          existingStaff.rows[0].user_id,
        ]
      );

      if (userEmailResult.rowCount > 0) {
        return sendErrorResponse(
          res,
          409,
          "Staff with this email already exists"
        );
      }
    }

    if (
      department_id !== undefined &&
      department_id !== null
    ) {
      const departmentResult = await pool.query(
        `
        SELECT department_id
        FROM tbl_departments
        WHERE department_id = $1
        `,
        [department_id]
      );

      if (departmentResult.rowCount === 0) {
        return sendErrorResponse(
          res,
          404,
          `Department with ID ${department_id} not found`
        );
      }
    }

    const fields = [];
    const values = [];
    let index = 1;

    const updateFields = {
      full_name,
      email,
      phone,
      gender,
      date_of_birth,
      department_id,
      designation,
      joining_date,
      address,
      is_active,
    };

    for (const [field, value] of Object.entries(updateFields)) {
      if (value !== undefined) {
        fields.push(`${field} = $${index}`);
        values.push(value);
        index++;
      }
    }

    if (fields.length === 0) {
      return sendErrorResponse(
        res,
        400,
        "At least one field is required to update"
      );
    }

    fields.push("updated_at = CURRENT_TIMESTAMP");

    values.push(staff_id);

    const result = await pool.query(
      `
      UPDATE tbl_staff
      SET ${fields.join(", ")}
      WHERE staff_id = $${index}
      RETURNING *
      `,
      values
    );

    if (email !== undefined && existingStaff.rows[0].user_id) {
      await pool.query(
        `
        UPDATE tbl_users
        SET
          full_name = COALESCE($1, full_name),
          email = COALESCE($2, email),
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $3
        `,
        [
          full_name,
          email,
          existingStaff.rows[0].user_id,
        ]
      );
    } else if (
      full_name !== undefined &&
      existingStaff.rows[0].user_id
    ) {
      await pool.query(
        `
        UPDATE tbl_users
        SET
          full_name = $1,
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $2
        `,
        [
          full_name,
          existingStaff.rows[0].user_id,
        ]
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Staff updated successfully",
      result.rows[0]
    );
  } catch (error) {
    console.error(error);

    return sendErrorResponse(
      res,
      500,
      "Failed to update staff"
    );
  }
};

export const updateStaffStatus = async (req, res) => {
  try {
    const { staff_id } = req.params;
    if (!isValidId(staff_id)) {
      return sendErrorResponse(res, 400, "Valid staff ID is required")
    }
    const { is_active } = req.body;

    if (typeof is_active !== "boolean") {
      return sendErrorResponse(res, 400, "Valid is_active value is required")
    }

    const result = await pool.query(
      `
      UPDATE tbl_staff
      SET
        is_active = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE staff_id = $2
      RETURNING staff_id, staff_code, full_name, is_active
      `,
      [is_active, staff_id]
    );

    if (result.rowCount === 0) {
      return sendErrorResponse(
        res,
        404,
        `Staff with ID ${staff_id} not found`
      );
    }

    return sendSuccessResponse(
      res,
      200,
      `Staff ${is_active ? "activated" : "deactivated"} successfully`,
      result.rows[0]
    );
  } catch (error) {
    console.error(error);

    return sendErrorResponse(
      res,
      500,
      "Failed to update staff status"
    );
  }
};

export const deleteStaff = async (req, res) => {
  const client = await pool.connect();

  try {
    const { staff_id } = req.params;

    if (!isValidId(staff_id)) {
      return sendErrorResponse(res, 400, "Valid staff Id is required");
    }


    await client.query("BEGIN");

    const staffResult = await client.query(
      `
      SELECT staff_id, user_id
      FROM tbl_staff
      WHERE staff_id = $1
      `,
      [staff_id]
    );

    if (staffResult.rowCount === 0) {
      await client.query("ROLLBACK");

      return sendErrorResponse(
        res,
        404,
        `Staff with ID ${staff_id} not found`
      );
    }

    const user_id = staffResult.rows[0].user_id;

    await client.query(
      `
      DELETE FROM tbl_staff
      WHERE staff_id = $1
      `,
      [staff_id]
    );

    if (user_id) {
      await client.query(
        `
        DELETE FROM tbl_users
        WHERE user_id = $1
        `,
        [user_id]
      );
    }

    await client.query("COMMIT");

    return sendSuccessResponse(
      res,
      200,
      "Staff deleted successfully"
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);

    return sendErrorResponse(
      res,
      500,
      "Failed to delete staff"
    );
  } finally {
    client.release();
  }
};

export const getStaffAttendance = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      attendance_date,
      status,
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
        "Invalid page"
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
        "Invalid limit. Maximum limit is 100"
      );
    }

    const currentDate = getCurrentDate();

    const appliedAttendanceDate =
      attendance_date?.trim() || currentDate;

    if (!isValidDate(appliedAttendanceDate)) {
      return sendErrorResponse(
        res,
        400,
        "Valid attendance date is required"
      );
    }

    const conditions = [
      `ea.employee_type = 'STAFF'`,
      `ea.attendance_date = $1`,
    ];

    const values = [appliedAttendanceDate];

    let appliedStatus = null;

    if (status !== undefined && status !== null) {
      if (typeof status !== "string") {
        return sendErrorResponse(
          res,
          400,
          "Invalid attendance status"
        );
      }

      appliedStatus = status.trim().toUpperCase();

      if (
        !["PRESENT", "ABSENT", "LEAVE", "LATE"].includes(
          appliedStatus
        )
      ) {
        return sendErrorResponse(
          res,
          400,
          "Invalid attendance status"
        );
      }

      values.push(appliedStatus);

      conditions.push(
        `ea.status = $${values.length}`
      );
    }

    const whereClause = conditions.join(" AND ");

    const countResult = await pool.query(
      `
      SELECT COUNT(*) AS total
      FROM tbl_employee_attendance ea
      WHERE ${whereClause}
      `,
      values
    );

    const total = Number(
      countResult.rows[0].total
    );

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
        ea.attendance_id,
        ea.employee_id AS staff_id,
        s.staff_code,
        s.full_name,
        s.department_id,
        d.department_name,
        ea.attendance_date,
        ea.status,
        ea.punch_in,
        ea.punch_out,
        ea.created_at,
        ea.updated_at
      FROM tbl_employee_attendance ea
      INNER JOIN tbl_staff s
        ON s.staff_id = ea.employee_id
      LEFT JOIN tbl_departments d
        ON d.department_id = s.department_id
      WHERE ${whereClause}
      ORDER BY
        ea.attendance_date DESC,
        s.staff_id DESC
      LIMIT $${limitIndex}
      OFFSET $${offsetIndex}
      `,
      dataValues
    );

    return sendSuccessResponse(
      res,
      200,
      "Staff attendance fetched successfully",
      {
        filters: {
          attendance_date: appliedAttendanceDate,
          status: appliedStatus,
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
            total / limitNumber
          ),
        },
        records: result.rows,
      }
    );
  } catch (error) {
    console.error(
      "Get staff attendance error:",
      error
    );

    return sendErrorResponse(
      res,
      500,
      "Failed to fetch staff attendance"
    );
  }
};

export const getStaffAttendanceSummary = async (req, res) => {
  try {
    const { staff_id } = req.params;
    const { from_date, to_date } = req.query;

    if (!isValidId(staff_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid staff Id is required"
      );
    }

    if (from_date && !isValidDate(from_date)) {
      return sendErrorResponse(res, 400, "Valid from date is required");
    }

    if (to_date && !isValidDate(to_date)) {
      return sendErrorResponse(res, 400, "Valid to date is required");
    }

    if (from_date && to_date && from_date > to_date) {
      return sendErrorResponse(
        res,
        400,
        "From date cannot be greater than to date"
      );
    }

    const values = [staff_id];

    const conditions = [
      `ea.employee_id = $1`,
      `ea.employee_type = 'STAFF'`,
    ];

    let appliedFromDate = from_date || null;
    let appliedToDate = to_date || null;

    if (from_date && to_date) {
      values.push(from_date, to_date);

      conditions.push(
        `ea.attendance_date BETWEEN $2 AND $3`
      );
    } else if (from_date) {
      values.push(from_date);

      conditions.push(
        `ea.attendance_date >= $2`
      );
    } else if (to_date) {
      values.push(to_date);

      conditions.push(
        `ea.attendance_date <= $2`
      );
    } else {
      conditions.push(`
        ea.attendance_date >= DATE_TRUNC('month', CURRENT_DATE)
        AND ea.attendance_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
      `);

      const currentDate = getCurrentDate();
      const [year, month] = currentDate.split("-").map(Number);

      appliedFromDate = `${year}-${String(month).padStart(2, "0")}-01`;

      const lastDay = new Date(year, month, 0).getDate();

      appliedToDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    }

    const summaryResult = await pool.query(
      `
      SELECT
        s.staff_id,
        s.staff_code,
        s.full_name,
        s.email,
        s.phone,
        s.gender,
        s.date_of_birth,
        s.department_id,
        d.department_name,
        s.designation,
        s.joining_date,

        COUNT(ea.attendance_id)::INTEGER AS total_days,

        COUNT(ea.attendance_id) FILTER (
          WHERE ea.status = 'PRESENT'
        )::INTEGER AS present_days,

        COUNT(ea.attendance_id) FILTER (
          WHERE ea.status = 'ABSENT'
        )::INTEGER AS absent_days,

        COUNT(ea.attendance_id) FILTER (
          WHERE ea.status = 'LEAVE'
        )::INTEGER AS leave_days,

        COUNT(ea.attendance_id) FILTER (
          WHERE ea.status = 'LATE'
        )::INTEGER AS late_days,

        ROUND(
          (
            COUNT(ea.attendance_id) FILTER (
              WHERE ea.status = 'PRESENT'
            ) * 100.0
          ) / NULLIF(COUNT(ea.attendance_id), 0),
          2
        ) AS attendance_percentage

      FROM tbl_staff s

      LEFT JOIN tbl_departments d
        ON d.department_id = s.department_id

      LEFT JOIN tbl_employee_attendance ea
        ON ea.employee_id = s.staff_id
        AND ea.employee_type = 'STAFF'
        AND ${conditions
        .filter(
          (condition) => !condition.includes("ea.employee_id")
        )
        .join(" AND ")}

      WHERE s.staff_id = $1

      GROUP BY
        s.staff_id,
        s.staff_code,
        s.full_name,
        s.email,
        s.phone,
        s.gender,
        s.date_of_birth,
        s.department_id,
        d.department_name,
        s.designation,
        s.joining_date
      `,
      values
    );

    if (summaryResult.rowCount === 0) {
      return sendErrorResponse(
        res,
        404,
        `Staff with ID ${staff_id} not found`
      );
    }

    const recordsResult = await pool.query(
      `
      SELECT
        ea.attendance_id,
        ea.attendance_date,
        ea.status,
        ea.punch_in,
        ea.punch_out,
        ea.created_at,
        ea.updated_at
      FROM tbl_employee_attendance ea
      WHERE ${conditions.join(" AND ")}
      ORDER BY ea.attendance_date DESC
      `,
      values
    );

    const staff = summaryResult.rows[0];

    return sendSuccessResponse(
      res,
      200,
      "Staff attendance summary fetched successfully",
      {
        filters: {
          staff_id,
          from_date: appliedFromDate,
          to_date: appliedToDate,
        },

        staff: {
          staff_id: staff.staff_id,
          staff_code: staff.staff_code,
          full_name: staff.full_name,
          email: staff.email,
          phone: staff.phone,
          gender: staff.gender,
          date_of_birth: staff.date_of_birth,
          department: {
            department_id: staff.department_id,
            department_name: staff.department_name,
          },
          designation: staff.designation,
          joining_date: staff.joining_date,
        },

        statistics: {
          total_days: staff.total_days,
          present_days: staff.present_days,
          absent_days: staff.absent_days,
          leave_days: staff.leave_days,
          late_days: staff.late_days,
          attendance_percentage:
            staff.attendance_percentage,
        },

        records: recordsResult.rows,
      }
    );
  } catch (error) {
    console.error(error);

    return sendErrorResponse(
      res,
      500,
      "Failed to fetch staff attendance summary"
    );
  }
};