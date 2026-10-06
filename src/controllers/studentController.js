import pool from "../config/database.js";
import { getCurrentDate, isValidDate } from "../utils/date.js";
import {
  sendErrorResponse,
  sendSuccessResponse
} from "../utils/response.js";
import { isValidId } from "../utils/validation.js";

import bcrypt from "bcryptjs";

export const createStudent = async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      full_name,
      date_of_birth,
      gender,
      blood_group,
      phone_number,
      email,
      address,
      admission_date,
      status,
      profile_image,

      father_name,
      father_phone,
      father_email,
      father_occupation,

      mother_name,
      mother_phone,
      mother_email,
      mother_occupation,

      guardian_name,
      guardian_phone,
      guardian_email,
      guardian_relationship,

      student_password,
      parent_password,

      class_id,
      section_id,
      roll_number
    } = req.body || {};

    await client.query("BEGIN");

    const currentYear = new Date().getFullYear();

    const admissionNumberResult = await client.query(
      `
      SELECT COALESCE(
        MAX(
          CAST(
            SUBSTRING(admission_number FROM 7)
            AS INTEGER
          )
        ),
        0
      ) + 1 AS next_number
      FROM tbl_students
      WHERE admission_number LIKE $1
      `,
      [`DC${currentYear}%`]
    );

    const nextNumber =
      admissionNumberResult.rows[0].next_number;

    const admissionNumber =
      `DC${currentYear}${String(nextNumber).padStart(4, "0")}`;

    let studentUserId = null;

    if (student_password) {
      const studentPasswordHash = await bcrypt.hash(
        student_password,
        10
      );

      const studentUserResult = await client.query(
        `
        INSERT INTO tbl_users (
          email,
          password,
          role
        )
        VALUES ($1, $2, $3)
        RETURNING user_id
        `,
        [
          email || admissionNumber,
          studentPasswordHash,
          "STUDENT"
        ]
      );

      studentUserId =
        studentUserResult.rows[0].user_id;
    }

    const studentResult = await client.query(
      `
      INSERT INTO tbl_students (
        user_id,
        admission_number,
        full_name,
        date_of_birth,
        gender,
        blood_group,
        phone_number,
        email,
        address,
        admission_date,
        status,
        profile_image
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        COALESCE($10, CURRENT_DATE),
        $11,
        $12
      )
      RETURNING student_id, admission_number
      `,
      [
        studentUserId,
        admissionNumber,
        full_name.trim(),
        date_of_birth,
        gender,
        blood_group || null,
        phone_number || null,
        email || null,
        address || null,
        admission_date || null,
        status || "ACTIVE",
        profile_image || null
      ]
    );

    const student = studentResult.rows[0];

    let parentUserId = null;

    const parentEmail =
      father_email ||
      mother_email ||
      guardian_email ||
      null;

    if (parent_password && parentEmail) {
      const existingParentResult = await client.query(
        `
        SELECT user_id
        FROM tbl_users
        WHERE email = $1
          AND role = 'PARENT'
        `,
        [parentEmail]
      );

      if (existingParentResult.rows.length > 0) {
        parentUserId =
          existingParentResult.rows[0].user_id;
      } else {
        const parentPasswordHash = await bcrypt.hash(
          parent_password,
          10
        );

        const parentUserResult = await client.query(
          `
          INSERT INTO tbl_users (
            email,
            password,
            role
          )
          VALUES ($1, $2, $3)
          RETURNING user_id
          `,
          [
            parentEmail,
            parentPasswordHash,
            "PARENT"
          ]
        );

        parentUserId =
          parentUserResult.rows[0].user_id;
      }
    }

    await client.query(
      `
      INSERT INTO tbl_student_parents (
        user_id,
        student_id,
        father_name,
        father_phone,
        father_email,
        father_occupation,
        mother_name,
        mother_phone,
        mother_email,
        mother_occupation,
        guardian_name,
        guardian_phone,
        guardian_email,
        guardian_relationship
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13,
        $14
      )
      `,
      [
        parentUserId,
        student.student_id,
        father_name || null,
        father_phone || null,
        father_email || null,
        father_occupation || null,
        mother_name || null,
        mother_phone || null,
        mother_email || null,
        mother_occupation || null,
        guardian_name || null,
        guardian_phone || null,
        guardian_email || null,
        guardian_relationship || null
      ]
    );

    let classSectionId = null;
    let assignedRollNumber = null;
    let academicYearId = null;

    if (class_id && section_id) {
      const academicYearResult = await client.query(
        `
        SELECT academic_year_id
        FROM tbl_academic_years
        WHERE is_active = true
        LIMIT 1
        `
      );

      if (academicYearResult.rows.length === 0) {
        await client.query("ROLLBACK");

        return sendErrorResponse(
          res,
          400,
          "Active academic year not found"
        );
      }

      academicYearId =
        academicYearResult.rows[0].academic_year_id;

      const classSectionResult = await client.query(
        `
        SELECT class_section_id
        FROM tbl_class_sections
        WHERE class_id = $1
          AND section_id = $2
          AND is_active = true
        `,
        [
          class_id,
          section_id
        ]
      );

      if (classSectionResult.rows.length === 0) {
        await client.query("ROLLBACK");

        return sendErrorResponse(
          res,
          404,
          `Class with ID ${class_id} and section with ID ${section_id} not found`
        );
      }

      classSectionId =
        classSectionResult.rows[0].class_section_id;

      assignedRollNumber = roll_number;

      if (
        assignedRollNumber === undefined ||
        assignedRollNumber === null
      ) {
        const rollNumberResult = await client.query(
          `
          SELECT COALESCE(MAX(roll_number), 0) + 1 AS next_roll_number
          FROM tbl_student_class_sections
          WHERE academic_year_id = $1
            AND class_section_id = $2
          `,
          [
            academicYearId,
            classSectionId
          ]
        );

        assignedRollNumber =
          rollNumberResult.rows[0].next_roll_number;
      }

      await client.query(
        `
        INSERT INTO tbl_student_class_sections (
          student_id,
          academic_year_id,
          class_section_id,
          roll_number,
          start_date
        )
        VALUES ($1, $2, $3, $4, CURRENT_DATE)
        `,
        [
          student.student_id,
          academicYearId,
          classSectionId,
          assignedRollNumber
        ]
      );
    }

    await client.query("COMMIT");

    return sendSuccessResponse(
      res,
      201,
      "Student created successfully",
      {
        student_id: student.student_id,
        admission_number: student.admission_number,
        student_user_id: studentUserId,
        parent_user_id: parentUserId,
        class_id: class_id || null,
        section_id: section_id || null,
        class_section_id: classSectionId,
        roll_number: assignedRollNumber
      }
    );
  } catch (error) {
    await client.query("ROLLBACK");

    console.error(
      "Create student error:",
      error
    );

    if (error.code === "23505") {
      return sendErrorResponse(
        res,
        409,
        "Student, parent, or user account already exists"
      );
    }

    if (error.code === "23503") {
      return sendErrorResponse(
        res,
        400,
        "Invalid reference ID"
      );
    }

    return sendErrorResponse(
      res,
      500,
      "Failed to create student"
    );
  } finally {
    client.release();
  }
};

export const getAllStudents = async (req, res) => {
  try {
    const {
      page,
      limit,
      search,
      status,
    } = req.query;

    const pageNumber = Number(page || 1);
    const limitNumber = Number(limit || 10);

    const conditions = [];
    const values = [];

    if (search) {
      values.push(`%${search}%`);

      conditions.push(`
        (
          s.full_name ILIKE $${values.length}
          OR s.admission_number ILIKE $${values.length}
          OR s.phone_number ILIKE $${values.length}
          OR s.email ILIKE $${values.length}
        )
      `);
    }

    if (status) {
      values.push(status);

      conditions.push(
        `s.status = $${values.length}`
      );
    }

    const whereClause =
      conditions.length > 0
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

    const countResult = await pool.query(
      `
        SELECT COUNT(*) AS total
        FROM tbl_students s
        ${whereClause}
      `,
      values
    );

    const total = Number(
      countResult.rows[0].total
    );

    const statisticsResult = await pool.query(`
      SELECT
        COUNT(*) AS total_students,
        COUNT(*) FILTER (
          WHERE status = 'ACTIVE'
        ) AS active_students,
        COUNT(*) FILTER (
          WHERE status = 'INACTIVE'
        ) AS inactive_students,
        COUNT(*) FILTER (
          WHERE gender = 'MALE'
        ) AS male_students,
        COUNT(*) FILTER (
          WHERE gender = 'FEMALE'
        ) AS female_students
      FROM tbl_students
    `);

    const statisticsRow =
      statisticsResult.rows[0];

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
          s.student_id,
          s.admission_number,
          s.full_name,
          s.date_of_birth,
          s.gender,
          s.blood_group,
          s.phone_number,
          s.email,
          s.address,
          s.admission_date,
          s.status,
          s.profile_image,

          c.class_id,
          c.class_name,

          sec.section_id,
          sec.section_name,

          sp.student_parent_id,
          sp.father_name,
          sp.father_phone,
          sp.father_email,
          sp.father_occupation,
          sp.mother_name,
          sp.mother_phone,
          sp.mother_email,
          sp.mother_occupation,
          sp.guardian_name,
          sp.guardian_phone,
          sp.guardian_email,
          sp.guardian_relationship,

          s.created_at,
          s.updated_at

        FROM tbl_students s

        LEFT JOIN tbl_student_class_sections scs
          ON scs.student_id = s.student_id

        LEFT JOIN tbl_class_sections cs
          ON cs.class_section_id = scs.class_section_id
          AND cs.is_active = TRUE

        LEFT JOIN tbl_classes c
          ON c.class_id = cs.class_id

        LEFT JOIN tbl_sections sec
          ON sec.section_id = cs.section_id

        LEFT JOIN tbl_student_parents sp
          ON sp.student_id = s.student_id

        ${whereClause}

        ORDER BY s.student_id DESC
        LIMIT $${limitIndex}
        OFFSET $${offsetIndex}
      `,
      dataValues
    );

    const totalPages = Math.ceil(
      total / limitNumber
    );

    return sendSuccessResponse(
      res,
      200,
      "Students fetched successfully",
      {
        pagination_info: {
          page: pageNumber,
          limit: limitNumber,
          prev_page:
            pageNumber > 1
              ? pageNumber - 1
              : null,
          next_page:
            pageNumber < totalPages
              ? pageNumber + 1
              : null,
          total,
          total_pages: totalPages,
        },
        statistics: {
          total_students: Number(
            statisticsRow.total_students
          ),
          active_students: Number(
            statisticsRow.active_students
          ),
          inactive_students: Number(
            statisticsRow.inactive_students
          ),
          male_students: Number(
            statisticsRow.male_students
          ),
          female_students: Number(
            statisticsRow.female_students
          ),
        },
        students: result.rows,
      }
    );
  } catch (error) {
    console.error(
      "Get all students error:",
      error
    );

    return sendErrorResponse(
      res,
      500,
      "Failed to fetch students"
    );
  }
};

export const getStudentsByClassSection = async (req, res) => {
  try {
    const { class_id, section_id } = req.params;

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

    const result = await pool.query(
      `
      SELECT
        s.student_id,
        s.admission_number,
        s.full_name,
        s.date_of_birth,
        s.gender,
        s.blood_group,
        s.phone_number,
        s.email,
        s.address,
        s.admission_date,
        s.status,
        s.profile_image,
        c.class_id,
        c.class_name,
        sec.section_id,
        sec.section_name,
        scs.roll_number,
        scs.start_date,
        s.created_at,
        s.updated_at
      FROM tbl_student_class_sections scs

      INNER JOIN tbl_students s
        ON s.student_id = scs.student_id

      INNER JOIN tbl_class_sections cs
        ON cs.class_section_id = scs.class_section_id

      INNER JOIN tbl_classes c
        ON c.class_id = cs.class_id

      INNER JOIN tbl_sections sec
        ON sec.section_id = cs.section_id

      WHERE cs.class_id = $1
        AND cs.section_id = $2
        AND cs.is_active = true
        AND s.is_active = true

      ORDER BY
        scs.roll_number ASC NULLS LAST,
        s.student_id DESC
      `,
      [class_id, section_id]
    );

    return sendSuccessResponse(
      res,
      200,
      "Students fetched successfully",
      {
        filters: {
          class_id,
          section_id,
        },
        records: result.rows,
      }
    );
  } catch (error) {
    console.error(
      "Get students by class section error:",
      error
    );

    return sendErrorResponse(
      res,
      500,
      "Failed to fetch students"
    );
  }
};

export const getStudentById = async (req, res) => {
  try {
    const { student_id } = req.params;

    if (!isValidId(student_id)) {
      return sendErrorResponse(res, 400, "Valid student ID is required");
    }

    const result = await pool.query(
      `
      SELECT
        s.student_id,
        s.admission_number,
        s.full_name,
        s.date_of_birth,
        s.gender,
        s.blood_group,
        s.phone_number,
        s.email,
        s.address,
        s.admission_date,
        s.status,
        s.profile_image,
        s.created_at,
        s.updated_at,

        sp.student_parent_id,

        sp.father_name,
        sp.father_phone,
        sp.father_email,
        sp.father_occupation,

        sp.mother_name,
        sp.mother_phone,
        sp.mother_email,
        sp.mother_occupation,

        sp.guardian_name,
        sp.guardian_phone,
        sp.guardian_email,
        sp.guardian_relationship

      FROM tbl_students s

      LEFT JOIN tbl_student_parents sp
        ON sp.student_id = s.student_id

      WHERE s.student_id = $1

      LIMIT 1
      `,
      [Number(student_id)]
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Student with ID ${student_id} not found`
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Student fetched successfully",
      result.rows[0]
    );
  } catch (error) {
    console.error(
      "Get student by ID error:",
      error
    );

    return sendErrorResponse(
      res,
      500,
      "Failed to fetch student"
    );
  }
};

export const updateStudent = async (req, res) => {
  const client = await pool.connect();

  try {
    const { student_id } = req.params;

    const {
      full_name,
      date_of_birth,
      gender,
      blood_group,
      phone_number,
      email,
      address,
      admission_date,
      status,
      profile_image,

      father_name,
      father_phone,
      father_email,
      father_occupation,

      mother_name,
      mother_phone,
      mother_email,
      mother_occupation,

      guardian_name,
      guardian_phone,
      guardian_email,
      guardian_relationship
    } = req.body;

    if (!isValidId(student_id)) {
      return sendErrorResponse(res, 400, "Valid student ID is required");
    }

    const studentId = Number(student_id);

    const existingStudent = await client.query(
      `
      SELECT student_id
      FROM tbl_students
      WHERE student_id = $1
      `,
      [studentId]
    );

    if (existingStudent.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Student with ID ${student_id} not found`
      );
    }

    const studentFields = [];
    const studentValues = [];

    const studentUpdates = {
      full_name,
      date_of_birth,
      gender,
      blood_group,
      phone_number,
      email,
      address,
      admission_date,
      status,
      profile_image
    };

    Object.entries(studentUpdates).forEach(([field, value]) => {
      if (value !== undefined) {
        studentFields.push(
          `${field} = $${studentValues.length + 1}`
        );
        studentValues.push(value);
      }
    });

    const parentFields = [];
    const parentValues = [];

    const parentUpdates = {
      father_name,
      father_phone,
      father_email,
      father_occupation,
      mother_name,
      mother_phone,
      mother_email,
      mother_occupation,
      guardian_name,
      guardian_phone,
      guardian_email,
      guardian_relationship
    };

    Object.entries(parentUpdates).forEach(([field, value]) => {
      if (value !== undefined) {
        parentFields.push(
          `${field} = $${parentValues.length + 1}`
        );
        parentValues.push(value);
      }
    });

    await client.query("BEGIN");

    let updatedStudent = null;

    if (studentFields.length > 0) {
      studentFields.push("updated_at = CURRENT_TIMESTAMP");
      studentValues.push(studentId);

      const studentResult = await client.query(
        `
        UPDATE tbl_students
        SET ${studentFields.join(", ")}
        WHERE student_id = $${studentValues.length}
        RETURNING *
        `,
        studentValues
      );

      updatedStudent = studentResult.rows[0];
    }

    if (parentFields.length > 0) {
      parentFields.push("updated_at = CURRENT_TIMESTAMP");
      parentValues.push(studentId);

      await client.query(
        `
        UPDATE tbl_student_parents
        SET ${parentFields.join(", ")}
        WHERE student_id = $${parentValues.length}
        `,
        parentValues
      );
    }

    if (
      studentFields.length === 1 &&
      parentFields.length === 1
    ) {
      await client.query("ROLLBACK");

      return sendErrorResponse(
        res,
        400,
        "No valid fields provided for update"
      );
    }

    await client.query("COMMIT");

    if (!updatedStudent) {
      const studentResult = await pool.query(
        `
        SELECT *
        FROM tbl_students
        WHERE student_id = $1
        `,
        [studentId]
      );

      updatedStudent = studentResult.rows[0];
    }

    return sendSuccessResponse(
      res,
      200,
      "Student updated successfully",
      updatedStudent
    );
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Update Student Error:", error);

    if (error.code === "23505") {
      return sendErrorResponse(
        res,
        409,
        "A student with the provided details already exists"
      );
    }

    return sendErrorResponse(
      res,
      500,
      process.env.NODE_ENV === "development"
        ? error.message
        : "Internal server error"
    );
  } finally {
    client.release();
  }
};

export const updateStudentStatus = async (req, res) => {
  try {
    const { student_id } = req.params;
    const { status } = req.body;

    if (!isValidId(student_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid student ID is required"
      );
    }

    const studentId = Number(student_id);

    const result = await pool.query(
      `
      UPDATE tbl_students
      SET
        status = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE student_id = $2
      RETURNING
        student_id,
        admission_number,
        full_name,
        status,
        updated_at
      `,
      [status, studentId]
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Student with ID ${studentId} not found`
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Student status updated successfully",
      result.rows[0]
    );
  } catch (error) {
    console.error("Update student status error:", error);

    return sendErrorResponse(
      res,
      500,
      "Failed to update student status"
    );
  }
};

export const deleteStudent = async (req, res) => {
  try {
    const { student_id } = req.params;

    if (!isValidId(student_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid student ID is required"
      );
    }

    const result = await pool.query(
      `
      DELETE FROM tbl_students
      WHERE student_id = $1
      RETURNING student_id
      `,
      [Number(student_id)]
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Student with ID ${student_id} not found`
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Student deleted successfully",
      {
        student_id:
          result.rows[0].student_id
      }
    );
  } catch (error) {
    console.error(
      "Delete student error:",
      error
    );

    return sendErrorResponse(
      res,
      500,
      "Failed to delete student"
    );
  }
};

export const getStudentAttendanceStatistics = async (req, res) => {
  try {
    const {
      from_date,
      to_date,
      class_id,
      section_id,
    } = req.query;

    const currentDate = getCurrentDate();

    const appliedFromDate =
      from_date?.trim() ||
      to_date?.trim() ||
      currentDate;

    const appliedToDate =
      to_date?.trim() ||
      from_date?.trim() ||
      currentDate;

    if (!isValidDate(appliedFromDate)) {
      return sendErrorResponse(
        res,
        400,
        "Valid from date is required"
      );
    }

    if (!isValidDate(appliedToDate)) {
      return sendErrorResponse(
        res,
        400,
        "Valid to date is required"
      );
    }

    if (appliedFromDate > appliedToDate) {
      return sendErrorResponse(
        res,
        400,
        "From date cannot be greater than to date"
      );
    }

    if (class_id !== undefined && !isValidId(class_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid class ID is required"
      );
    }

    if (
      section_id !== undefined &&
      !isValidId(section_id)
    ) {
      return sendErrorResponse(
        res,
        400,
        "Valid section ID is required"
      );
    }

    const conditions = [
      "s.is_active = TRUE",
    ];

    const values = [
      appliedFromDate,
      appliedToDate,
    ];

    if (class_id !== undefined) {
      values.push(class_id);

      conditions.push(
        `cs.class_id = $${values.length}`
      );
    }

    if (section_id !== undefined) {
      values.push(section_id);

      conditions.push(
        `cs.section_id = $${values.length}`
      );
    }

    const result = await pool.query(
      `
      WITH eligible_students AS (
        SELECT DISTINCT
          s.student_id
        FROM tbl_students s
        INNER JOIN tbl_student_class_sections scs
          ON scs.student_id = s.student_id
        INNER JOIN tbl_class_sections cs
          ON cs.class_section_id = scs.class_section_id
        WHERE ${conditions.join(" AND ")}
      ),
      attendance_summary AS (
        SELECT
          COUNT(a.attendance_id)::INTEGER AS marked_count,

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
        INNER JOIN eligible_students es
          ON es.student_id = a.student_id
        WHERE a.attendance_date BETWEEN $1 AND $2
      )
      SELECT
        (
          SELECT COUNT(*)::INTEGER
          FROM eligible_students
        ) AS total_students,

        attendance_summary.marked_count,

        (
          SELECT COUNT(DISTINCT a.student_id)::INTEGER
          FROM tbl_attendance a
          INNER JOIN eligible_students es
            ON es.student_id = a.student_id
          WHERE a.attendance_date BETWEEN $1 AND $2
        ) AS marked_students,

        attendance_summary.present_count,
        attendance_summary.absent_count,
        attendance_summary.late_count,
        attendance_summary.half_day_count

      FROM attendance_summary
      `,
      values
    );

    const statistics = result.rows[0];

    return sendSuccessResponse(
      res,
      200,
      "Student attendance statistics fetched successfully",
      {
        filters: {
          from_date: appliedFromDate,
          to_date: appliedToDate,
          class_id: class_id ?? null,
          section_id: section_id ?? null,
        },
        statistics,
      }
    );
  } catch (error) {
    console.error(
      "Get student attendance statistics error:",
      error
    );

    return sendErrorResponse(
      res,
      500,
      "Failed to fetch student attendance statistics"
    );
  }
};