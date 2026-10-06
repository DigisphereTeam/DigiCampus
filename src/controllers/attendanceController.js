import pool from "../config/database.js";
import { getCurrentDate, isValidDate } from "../utils/date.js";
import {
  sendErrorResponse,
  sendSuccessResponse,
} from "../utils/response.js";
import { isValidId } from "../utils/validation.js";

export const createAttendance = async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      class_id,
      section_id,
      attendance_date,
      attendance,
    } = req.body;

    if (!isValidId(class_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid class ID is required"
      );
    }

    if (!isValidId(section_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid section ID is required"
      );
    }

    const studentIds = attendance.map(
      (item) => Number(item.student_id)
    );

    for (const studentId of studentIds) {
      if (!isValidId(studentId)) {
        return sendErrorResponse(
          res,
          400,
          "Valid student ID is required"
        );
      }
    }

    await client.query("BEGIN");

    const classSectionResult = await client.query(
      `
      SELECT class_section_id
      FROM tbl_class_sections
      WHERE class_id = $1
        AND section_id = $2
        AND is_active = true
      LIMIT 1
      `,
      [
        Number(class_id),
        Number(section_id),
      ]
    );

    if (classSectionResult.rowCount === 0) {
      await client.query("ROLLBACK");

      return sendErrorResponse(
        res,
        404,
        "Class section not found"
      );
    }

    const { class_section_id } =
      classSectionResult.rows[0];

    const studentsResult = await client.query(
      `
      SELECT student_id
      FROM tbl_student_class_sections
      WHERE student_id = ANY($1::INTEGER[])
        AND class_section_id = $2
        AND is_active = true
      `,
      [
        studentIds,
        class_section_id,
      ]
    );

    if (
      studentsResult.rowCount !==
      studentIds.length
    ) {
      await client.query("ROLLBACK");

      return sendErrorResponse(
        res,
        400,
        "One or more students do not belong to the selected class section"
      );
    }

    const values = [];
    const placeholders = [];

    attendance.forEach((item, index) => {
      const offset = index * 4;

      values.push(
        Number(item.student_id),
        class_section_id,
        attendance_date,
        item.status
      );

      placeholders.push(
        `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`
      );
    });

    const result = await client.query(
      `
      INSERT INTO tbl_attendance (
        student_id,
        class_section_id,
        attendance_date,
        status
      )
      VALUES ${placeholders.join(", ")}
      ON CONFLICT (
        student_id,
        attendance_date
      )
      DO NOTHING
      RETURNING
        attendance_id,
        student_id,
        class_section_id,
        attendance_date,
        status
      `,
      values
    );

    await client.query("COMMIT");

    return sendSuccessResponse(
      res,
      201,
      "Attendance processed successfully",
      {
        inserted_count: result.rows.length,
        skipped_count:
          attendance.length - result.rows.length,
        records: result.rows,
      }
    );
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23503") {
      return sendErrorResponse(
        res,
        400,
        "Invalid attendance reference"
      );
    }

    console.error(
      "Create attendance error:",
      error
    );

    return sendErrorResponse(
      res,
      500,
      "Failed to mark attendance"
    );
  } finally {
    client.release();
  }
};

export const getTodayAttendance = async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        c.class_id,
        c.class_name,
        s.section_id,
        s.section_name,
        cs.class_section_id,
        COUNT(scs.student_id)::INTEGER AS total_students,
        COUNT(a.attendance_id)::INTEGER AS marked_students,
        COUNT(a.attendance_id) FILTER (
          WHERE a.status = 'PRESENT'
        )::INTEGER AS present_count,
        COUNT(a.attendance_id) FILTER (
          WHERE a.status = 'ABSENT'
        )::INTEGER AS absent_count,
        COUNT(a.attendance_id) FILTER (
          WHERE a.status = 'LATE'
        )::INTEGER AS late_count,
        COUNT(a.attendance_id) FILTER (
          WHERE a.status = 'HALF_DAY'
        )::INTEGER AS half_day_count
      FROM tbl_class_sections cs
      INNER JOIN tbl_classes c
        ON c.class_id = cs.class_id
      INNER JOIN tbl_sections s
        ON s.section_id = cs.section_id
      INNER JOIN tbl_student_class_sections scs
        ON scs.class_section_id = cs.class_section_id
      LEFT JOIN tbl_attendance a
        ON a.student_id = scs.student_id
        AND a.class_section_id = cs.class_section_id
        AND a.attendance_date = CURRENT_DATE
      WHERE cs.is_active = true
        AND scs.is_active = true
      GROUP BY
        c.class_id,
        c.class_name,
        s.section_id,
        s.section_name,
        cs.class_section_id
      ORDER BY
        c.display_order,
        s.section_name
      `
    );

    return sendSuccessResponse(
      res,
      200,
      "Today's attendance fetched successfully",
      result.rows
    );
  } catch (error) {
    console.error("Get today attendance error:", error);

    return sendErrorResponse(
      res,
      500,
      "Failed to fetch today's attendance"
    );
  }
};

export const getStudentAttendanceByDate = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      attendance_date,
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

    const countResult = await pool.query(
      `
      SELECT COUNT(*) AS total
      FROM tbl_attendance a
      WHERE a.attendance_date = $1
      `,
      [appliedAttendanceDate]
    );

    const total = Number(
      countResult.rows[0].total
    );

    const offset =
      (pageNumber - 1) * limitNumber;

    const result = await pool.query(
      `
      SELECT
        a.attendance_id,
        a.student_id,
        st.admission_number,
        st.full_name,
        cs.class_section_id,
        c.class_id,
        c.class_name,
        s.section_id,
        s.section_name,
        a.attendance_date,
        a.status,
        a.created_at,
        a.updated_at
      FROM tbl_attendance a
      INNER JOIN tbl_students st
        ON st.student_id = a.student_id
      INNER JOIN tbl_class_sections cs
        ON cs.class_section_id = a.class_section_id
      INNER JOIN tbl_classes c
        ON c.class_id = cs.class_id
      INNER JOIN tbl_sections s
        ON s.section_id = cs.section_id
      WHERE a.attendance_date = $1
      ORDER BY
        s.section_name,
        st.full_name
      LIMIT $2
      OFFSET $3
      `,
      [
        appliedAttendanceDate,
        limitNumber,
        offset,
      ]
    );

    return sendSuccessResponse(
      res,
      200,
      "Student attendance fetched successfully",
      {
        filters: {
          attendance_date: appliedAttendanceDate,
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
      "Get student attendance by date error:",
      error
    );

    return sendErrorResponse(
      res,
      500,
      "Failed to fetch student attendance"
    );
  }
};

export const getStudentAttendance = async (req, res) => {
  try {
    const { student_id } = req.params;

    const result = await pool.query(
      `
      SELECT
        a.attendance_id,
        a.attendance_date,
        a.status,
        c.class_id,
        c.class_name,
        s.section_id,
        s.section_name
      FROM tbl_attendance a
      INNER JOIN tbl_class_sections cs
        ON cs.class_section_id = a.class_section_id
      INNER JOIN tbl_classes c
        ON c.class_id = cs.class_id
      INNER JOIN tbl_sections s
        ON s.section_id = cs.section_id
      WHERE a.student_id = $1
      ORDER BY a.attendance_date DESC
      `,
      [student_id]
    );

    return sendSuccessResponse(
      res,
      200,
      "Student attendance fetched successfully",
      result.rows
    );
  } catch (error) {
    console.error("Get student attendance error:", error);

    return sendErrorResponse(
      res,
      500,
      "Failed to fetch student attendance"
    );
  }
};

export const getAttendanceStatistics = async (req, res) => {
  try {
    const { attendance_date } = req.query;

    const result = await pool.query(
      `
      SELECT
        COUNT(s.student_id)::INTEGER AS total_students,
        COUNT(a.attendance_id)::INTEGER AS marked_students,
        COUNT(a.attendance_id) FILTER (
          WHERE a.status = 'PRESENT'
        )::INTEGER AS present_count,
        COUNT(a.attendance_id) FILTER (
          WHERE a.status = 'ABSENT'
        )::INTEGER AS absent_count,
        COUNT(a.attendance_id) FILTER (
          WHERE a.status = 'LATE'
        )::INTEGER AS late_count,
        COUNT(a.attendance_id) FILTER (
          WHERE a.status = 'HALF_DAY'
        )::INTEGER AS half_day_count,
        (
          COUNT(s.student_id) -
          COUNT(a.attendance_id)
        )::INTEGER AS unmarked_count
      FROM tbl_students s
      LEFT JOIN tbl_attendance a
        ON a.student_id = s.student_id
        AND a.attendance_date = $1
      `,
      [attendance_date]
    );

    return sendSuccessResponse(
      res,
      200,
      "Attendance statistics fetched successfully",
      result.rows[0]
    );
  } catch (error) {
    console.error("Get attendance statistics error:", error);

    return sendErrorResponse(
      res,
      500,
      "Failed to fetch attendance statistics"
    );
  }
};

export const getAttendanceSummary = async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        a.attendance_date,
        COUNT(a.attendance_id)::INTEGER AS total_marked,
        COUNT(a.attendance_id) FILTER (
          WHERE a.status = 'PRESENT'
        )::INTEGER AS present_count,
        COUNT(a.attendance_id) FILTER (
          WHERE a.status = 'ABSENT'
        )::INTEGER AS absent_count,
        COUNT(a.attendance_id) FILTER (
          WHERE a.status = 'LATE'
        )::INTEGER AS late_count,
        COUNT(a.attendance_id) FILTER (
          WHERE a.status = 'HALF_DAY'
        )::INTEGER AS half_day_count
      FROM tbl_attendance a
      GROUP BY a.attendance_date
      ORDER BY a.attendance_date DESC
      `
    );

    return sendSuccessResponse(
      res,
      200,
      "Attendance summary fetched successfully",
      result.rows
    );
  } catch (error) {
    console.error("Get attendance summary error:", error);

    return sendErrorResponse(
      res,
      500,
      "Failed to fetch attendance summary"
    );
  }
};