import pool from "../config/database.js";
import { getCurrentDate, isValidDate } from "../utils/date.js";
import {
  sendErrorResponse,
  sendSuccessResponse,
} from "../utils/response.js";
import { isValidId } from "../utils/validation.js";

import bcrypt from "bcryptjs";

export const getTeacherProfile = async (req, res) => {
  try {
    const { teacher_id } = req.params;

    if (!isValidId(teacher_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid teacher ID is required"
      );
    }

    const result = await pool.query(
      `
      SELECT
        t.teacher_id,
        t.user_id,
        t.teacher_code,
        t.full_name,
        t.email,
        t.phone,
        t.gender,
        t.date_of_birth,
        t.qualification,
        t.specialization,
        t.department_id,
        d.department_name,
        t.designation,
        t.joining_date,
        t.address,
        t.is_active,
        t.created_at,
        t.updated_at
      FROM tbl_teachers t
      LEFT JOIN tbl_departments d
        ON d.department_id = t.department_id
      WHERE t.teacher_id = $1
      `,
      [teacher_id]
    );

    if (result.rowCount === 0) {
      return sendErrorResponse(
        res,
        404,
        `Teacher with ID ${teacher_id} not found`
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Teacher profile fetched successfully",
      result.rows[0]
    );
  } catch (error) {
    console.error(error);

    return sendErrorResponse(
      res,
      500,
      "Failed to fetch teacher profile"
    );
  }
};

export const createTeacher = async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      full_name,
      email,
      password,
      phone,
      gender,
      date_of_birth,
      qualification,
      specialization,
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
        "Teacher with this email already exists"
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
    const prefix = `T${currentYear}`;

    const codeResult = await client.query(
      `
      SELECT COALESCE(
        MAX(SUBSTRING(teacher_code FROM ${prefix.length + 1})::INTEGER),
        0
      ) + 1 AS sequence
      FROM tbl_teachers
      WHERE teacher_code LIKE $1
      `,
      [`${prefix}%`]
    );

    const sequence = codeResult.rows[0].sequence;
    const teacher_code = `${prefix}${String(sequence).padStart(4, "0")}`;

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
        "TEACHER",
      ]
    );

    const user_id = userResult.rows[0].user_id;

    const result = await client.query(
      `
      INSERT INTO tbl_teachers (
        user_id,
        teacher_code,
        full_name,
        email,
        phone,
        gender,
        date_of_birth,
        qualification,
        specialization,
        department_id,
        designation,
        joining_date,
        address
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
      )
      RETURNING *
      `,
      [
        user_id,
        teacher_code,
        full_name,
        email,
        phone,
        gender,
        date_of_birth || null,
        qualification || null,
        specialization || null,
        department_id,
        designation || null,
        joining_date,
        address || null,
      ]
    );

    await client.query("COMMIT");

    const teacher = result.rows[0];
    delete teacher.user_id;

    return sendSuccessResponse(
      res,
      201,
      "Teacher created successfully",
      teacher
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);

    return sendErrorResponse(
      res,
      500,
      "Failed to create teacher"
    );
  } finally {
    client.release();
  }
};

export const getTeachers = async (req, res) => {
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
            t.full_name ILIKE $${values.length}
            OR t.teacher_code ILIKE $${values.length}
            OR t.email ILIKE $${values.length}
            OR t.phone ILIKE $${values.length}
          )
        `);
      }
    }

    if (status !== undefined && status !== null) {
      if (typeof status !== "string") {
        return sendErrorResponse(
          res,
          400,
          "Invalid teacher status"
        );
      }

      const normalizedStatus = status
        .trim()
        .toUpperCase();

      if (!["ACTIVE", "INACTIVE"].includes(normalizedStatus)) {
        return sendErrorResponse(
          res,
          400,
          "Invalid teacher status"
        );
      }

      values.push(normalizedStatus === "ACTIVE");

      conditions.push(
        `t.is_active = $${values.length}`
      );
    }

    const whereClause =
      conditions.length > 0
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

    const countResult = await pool.query(
      `
      SELECT COUNT(*) AS total
      FROM tbl_teachers t
      LEFT JOIN tbl_departments d
        ON d.department_id = t.department_id
      ${whereClause}
      `,
      values
    );

    const total = Number(
      countResult.rows[0].total
    );

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
        t.teacher_id,
        t.teacher_code,
        t.full_name,
        t.email,
        t.phone,
        t.gender,
        t.date_of_birth,
        t.qualification,
        t.specialization,
        t.department_id,
        d.department_name,
        t.designation,
        t.joining_date,
        t.address,
        t.is_active,
        t.created_at,
        t.updated_at
      FROM tbl_teachers t
      LEFT JOIN tbl_departments d
        ON d.department_id = t.department_id
      ${whereClause}
      ORDER BY t.teacher_id DESC
      LIMIT $${limitIndex}
      OFFSET $${offsetIndex}
      `,
      dataValues
    );

    return sendSuccessResponse(
      res,
      200,
      "Teachers fetched successfully",
      {
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
        teachers: result.rows,
      }
    );
  } catch (error) {
    console.error(
      "Get teachers error:",
      error
    );

    return sendErrorResponse(
      res,
      500,
      "Failed to fetch teachers"
    );
  }
};

export const getTeacherById = async (req, res) => {
  try {
    const { teacher_id } = req.params;

    if (!isValidId(teacher_id)) {
      return sendErrorResponse(res, 400, "Valid teacher ID is required")
    }

    const result = await pool.query(
      `
      SELECT
        t.teacher_id,
        t.teacher_code,
        t.full_name,
        t.email,
        t.phone,
        t.gender,
        t.date_of_birth,
        t.qualification,
        t.specialization,
        t.department_id,
        d.department_name,
        t.designation,
        t.joining_date,
        t.address,
        t.is_active,
        t.created_at,
        t.updated_at
      FROM tbl_teachers t
      LEFT JOIN tbl_departments d
        ON d.department_id = t.department_id
      WHERE t.teacher_id = $1
      `,
      [teacher_id]
    );

    if (result.rowCount === 0) {
      return sendErrorResponse(
        res,
        404,
        `Teacher with ID ${teacher_id} not found`
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Teacher fetched successfully",
      result.rows[0]
    );
  } catch (error) {
    console.error(error);

    return sendErrorResponse(
      res,
      500,
      "Failed to fetch teacher"
    );
  }
};

export const updateTeacher = async (req, res) => {
  try {
    const { teacher_id } = req.params;

    if (!isValidId(teacher_id)) {
      return sendErrorResponse(res, 400, "Valid teacher ID is required")
    }

    const existingTeacher = await pool.query(
      `
      SELECT teacher_id
      FROM tbl_teachers
      WHERE teacher_id = $1
      `,
      [teacher_id]
    );

    if (existingTeacher.rowCount === 0) {
      return sendErrorResponse(
        res,
        404,
        `Teacher with ID ${teacher_id} not found`
      );
    }

    const {
      full_name,
      email,
      phone,
      gender,
      date_of_birth,
      qualification,
      specialization,
      department_id,
      designation,
      joining_date,
      address,
      is_active,
    } = req.body;

    if (email !== undefined) {
      const emailResult = await pool.query(
        `
        SELECT teacher_id
        FROM tbl_teachers
        WHERE email = $1
          AND teacher_id <> $2
        `,
        [email, teacher_id]
      );

      if (emailResult.rowCount > 0) {
        return sendErrorResponse(
          res,
          409,
          "Teacher with this email already exists"
        );
      }
    }

    if (department_id !== undefined && department_id !== null) {
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
      qualification,
      specialization,
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

    values.push(teacher_id);

    const result = await pool.query(
      `
      UPDATE tbl_teachers
      SET ${fields.join(", ")}
      WHERE teacher_id = $${index}
      RETURNING *
      `,
      values
    );

    return sendSuccessResponse(
      res,
      200,
      "Teacher updated successfully",
      result.rows[0]
    );
  } catch (error) {
    console.error(error);

    return sendErrorResponse(
      res,
      500,
      "Failed to update teacher"
    );
  }
};

export const updateTeacherStatus = async (req, res) => {
  try {
    const { teacher_id } = req.params;
    if (!isValidId(teacher_id)) {
      return sendErrorResponse(res, 400, "Valid teacher Id is required");
    }
    const { is_active } = req.body;

    if (typeof is_active !== "boolean") {
      return sendErrorResponse(res, 400, "Valid is_active value is required")
    }

    const result = await pool.query(
      `
      UPDATE tbl_teachers
      SET
        is_active = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE teacher_id = $2
      RETURNING teacher_id, teacher_code, full_name, is_active
      `,
      [is_active, teacher_id]
    );

    if (result.rowCount === 0) {
      return sendErrorResponse(
        res,
        404,
        `Teacher with ID ${teacher_id} not found`
      );
    }

    return sendSuccessResponse(
      res,
      200,
      `Teacher ${is_active ? "activated" : "deactivated"} successfully`,
      result.rows[0]
    );
  } catch (error) {
    console.error(error);

    return sendErrorResponse(
      res,
      500,
      "Failed to update teacher status"
    );
  }
};

export const deleteTeacher = async (req, res) => {
  try {
    const { teacher_id } = req.params;

    const result = await pool.query(
      `
      DELETE FROM tbl_teachers
      WHERE teacher_id = $1
      RETURNING teacher_id
      `,
      [teacher_id]
    );

    if (result.rowCount === 0) {
      return sendErrorResponse(
        res,
        404,
        `Teacher with ID ${teacher_id} not found`
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Teacher deleted successfully"
    );
  } catch (error) {
    console.error(error);

    return sendErrorResponse(
      res,
      500,
      "Failed to delete teacher"
    );
  }
};

export const getTeacherAttendance = async (req, res) => {
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
      `ea.employee_type = 'TEACHER'`,
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
      INNER JOIN tbl_teachers t
        ON t.teacher_id = ea.employee_id
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
        ea.employee_id AS teacher_id,
        t.teacher_code,
        t.full_name,
        t.department_id,
        d.department_name,
        ea.attendance_date,
        ea.status,
        ea.punch_in,
        ea.punch_out,
        ea.created_at,
        ea.updated_at
      FROM tbl_employee_attendance ea
      INNER JOIN tbl_teachers t
        ON t.teacher_id = ea.employee_id
      LEFT JOIN tbl_departments d
        ON d.department_id = t.department_id
      WHERE ${whereClause}
      ORDER BY
        ea.attendance_date DESC,
        t.teacher_id DESC
      LIMIT $${limitIndex}
      OFFSET $${offsetIndex}
      `,
      dataValues
    );

    return sendSuccessResponse(
      res,
      200,
      "Teacher attendance fetched successfully",
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
      "Get teacher attendance error:",
      error
    );

    const message =
      process.env.NODE_ENV === "development"
        ? error.message
        : "Failed to fetch teacher attendance";

    return sendErrorResponse(
      res,
      500,
      message
    );
  }
};

export const getTeacherAttendanceSummary = async (req, res) => {
  try {
    const { teacher_id } = req.params;
    const { from_date, to_date } = req.query;

    if (!isValidId(teacher_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid teacher ID is required"
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

    const values = [teacher_id];

    const conditions = [
      `ea.employee_id = $1`,
      `ea.employee_type = 'TEACHER'`,
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
      const currentDate = getCurrentDate();
      const [year, month] = currentDate.split("-").map(Number);

      appliedFromDate = `${year}-${String(month).padStart(2, "0")}-01`;

      const lastDay = new Date(year, month, 0).getDate();

      appliedToDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

      conditions.push(`
        ea.attendance_date >= $2
        AND ea.attendance_date <= $3
      `);

      values.push(appliedFromDate, appliedToDate);
    }

    const summaryResult = await pool.query(
      `
      SELECT
        t.teacher_id,
        t.teacher_code,
        t.full_name,
        t.email,
        t.phone,
        t.gender,
        t.date_of_birth,
        t.qualification,
        t.specialization,
        t.department_id,
        d.department_name,
        t.designation,
        t.joining_date,

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

      FROM tbl_teachers t

      LEFT JOIN tbl_departments d
        ON d.department_id = t.department_id

      LEFT JOIN tbl_employee_attendance ea
        ON ea.employee_id = t.teacher_id
        AND ea.employee_type = 'TEACHER'
        AND ${conditions
        .filter(
          (condition) => !condition.includes("ea.employee_id")
        )
        .join(" AND ")
      }

      WHERE t.teacher_id = $1

      GROUP BY
        t.teacher_id,
        t.teacher_code,
        t.full_name,
        t.email,
        t.phone,
        t.gender,
        t.date_of_birth,
        t.qualification,
        t.specialization,
        t.department_id,
        d.department_name,
        t.designation,
        t.joining_date
      `,
      values
    );

    if (summaryResult.rowCount === 0) {
      return sendErrorResponse(
        res,
        404,
        `Teacher with ID ${teacher_id} not found`
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

    const teacher = summaryResult.rows[0];

    return sendSuccessResponse(
      res,
      200,
      "Teacher attendance summary fetched successfully",
      {
        filters: {
          teacher_id,
          from_date: appliedFromDate,
          to_date: appliedToDate,
        },

        teacher: {
          teacher_id: teacher.teacher_id,
          teacher_code: teacher.teacher_code,
          full_name: teacher.full_name,
          email: teacher.email,
          phone: teacher.phone,
          gender: teacher.gender,
          date_of_birth: teacher.date_of_birth,
          qualification: teacher.qualification,
          specialization: teacher.specialization,
          department: {
            department_id: teacher.department_id,
            department_name: teacher.department_name,
          },
          designation: teacher.designation,
          joining_date: teacher.joining_date,
        },

        statistics: {
          total_days: teacher.total_days,
          present_days: teacher.present_days,
          absent_days: teacher.absent_days,
          leave_days: teacher.leave_days,
          late_days: teacher.late_days,
          attendance_percentage:
            teacher.attendance_percentage,
        },

        records: recordsResult.rows,
      }
    );
  } catch (error) {
    console.error(error);

    return sendErrorResponse(
      res,
      500,
      "Failed to fetch teacher attendance summary"
    );
  }
};