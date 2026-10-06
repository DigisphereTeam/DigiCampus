import pool from "../config/database.js";

import {
  sendErrorResponse,
  sendSuccessResponse,
} from "../utils/response.js";

import { isValidId } from "../utils/validation.js";

export const createExam = async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      exam_name,
      exam_type,
      start_date,
      end_date,
      description,
      class_ids,
    } = req.body;

    await client.query("BEGIN");

    const academicYearResult = await client.query(
      `
      SELECT academic_year_id
      FROM tbl_academic_years
      WHERE is_current = true
      LIMIT 1
      `
    );

    if (academicYearResult.rowCount === 0) {
      await client.query("ROLLBACK");

      return sendErrorResponse(
        res,
        400,
        "Current academic year is not configured"
      );
    }

    const academicYearId =
      academicYearResult.rows[0].academic_year_id;

    const existingExam = await client.query(
      `
      SELECT exam_id
      FROM tbl_exams
      WHERE LOWER(TRIM(exam_name)) = LOWER(TRIM($1))
        AND academic_year_id = $2
        AND is_active = true
      `,
      [exam_name, academicYearId]
    );

    if (existingExam.rowCount > 0) {
      await client.query("ROLLBACK");

      return sendErrorResponse(
        res,
        409,
        "Exam with the same name already exists for this academic year"
      );
    }

    const classResult = await client.query(
      `
      SELECT class_id
      FROM tbl_classes
      WHERE class_id = ANY($1::INTEGER[])
        AND is_active = true
      `,
      [class_ids]
    );

    if (classResult.rowCount !== class_ids.length) {
      await client.query("ROLLBACK");

      return sendErrorResponse(
        res,
        400,
        "One or more selected classes are invalid or inactive"
      );
    }

    const examResult = await client.query(
      `
      INSERT INTO tbl_exams (
        exam_name,
        exam_type,
        academic_year_id,
        start_date,
        end_date,
        description,
        status,
        is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'UPCOMING', true)
      RETURNING
        exam_id,
        exam_name,
        exam_type,
        academic_year_id,
        start_date,
        end_date,
        description,
        status,
        is_active,
        created_at,
        updated_at
      `,
      [
        exam_name.trim(),
        exam_type,
        academicYearId,
        start_date,
        end_date,
        description?.trim() || null,
      ]
    );

    const examId = examResult.rows[0].exam_id;

    await client.query(
      `
      INSERT INTO tbl_exam_classes (
        exam_id,
        class_id
      )
      SELECT $1, UNNEST($2::INTEGER[])
      `,
      [examId, class_ids]
    );

    await client.query("COMMIT");

    return sendSuccessResponse(
      res,
      201,
      "Exam created successfully",
      {
        ...examResult.rows[0],
        class_ids,
      }
    );
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Create exam error:", error);

    return sendErrorResponse(
      res,
      500,
      "Failed to create exam"
    );
  } finally {
    client.release();
  }
};

export const getAllExams = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      exam_type,
      status,
      academic_year_id,
      class_id,
      is_active,
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
        "Invalid limit. Maximum limit is 100"
      );
    }

    const conditions = [];
    const values = [];

    if (search) {
      values.push(`%${search.trim()}%`);

      conditions.push(
        `(
          e.exam_name ILIKE $${values.length}
          OR e.exam_type ILIKE $${values.length}
          OR c.class_name ILIKE $${values.length}
        )`
      );
    }

    if (exam_type) {
      values.push(exam_type.trim().toUpperCase());

      conditions.push(
        `e.exam_type = $${values.length}`
      );
    }

    if (status) {
      values.push(status.trim().toUpperCase());

      conditions.push(
        `e.status = $${values.length}`
      );
    }

    if (academic_year_id) {
      values.push(Number(academic_year_id));

      conditions.push(
        `e.academic_year_id = $${values.length}`
      );
    }

    if (class_id) {
      values.push(Number(class_id));

      conditions.push(
        `ec.class_id = $${values.length}`
      );
    }

    if (is_active !== undefined) {
      values.push(is_active === "true");

      conditions.push(
        `e.is_active = $${values.length}`
      );
    }

    const whereClause =
      conditions.length > 0
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

    const countResult = await pool.query(
      `
      SELECT COUNT(DISTINCT e.exam_id)::INTEGER AS total
      FROM tbl_exams e
      LEFT JOIN tbl_exam_classes ec
        ON ec.exam_id = e.exam_id
      LEFT JOIN tbl_classes c
        ON c.class_id = ec.class_id
      ${whereClause}
      `,
      values
    );

    const total = Number(countResult.rows[0].total);

    const statisticsResult = await pool.query(
      `
      SELECT
        COUNT(DISTINCT e.exam_id)::INTEGER AS total_exams,

        COUNT(DISTINCT e.exam_id) FILTER (
          WHERE e.is_active = true
        )::INTEGER AS active_exams,

        COUNT(DISTINCT e.exam_id) FILTER (
          WHERE e.is_active = false
        )::INTEGER AS inactive_exams,

        COUNT(DISTINCT e.exam_id) FILTER (
          WHERE e.status = 'UPCOMING'
        )::INTEGER AS upcoming_exams,

        COUNT(DISTINCT e.exam_id) FILTER (
          WHERE e.status = 'ONGOING'
        )::INTEGER AS ongoing_exams,

        COUNT(DISTINCT e.exam_id) FILTER (
          WHERE e.status = 'COMPLETED'
        )::INTEGER AS completed_exams,

        COUNT(DISTINCT e.exam_id) FILTER (
          WHERE e.status = 'CANCELLED'
        )::INTEGER AS cancelled_exams

      FROM tbl_exams e
      LEFT JOIN tbl_exam_classes ec
        ON ec.exam_id = e.exam_id
      LEFT JOIN tbl_classes c
        ON c.class_id = ec.class_id
      ${whereClause}
      `,
      values
    );

    const typeResult = await pool.query(
      `
      SELECT
        e.exam_type,
        COUNT(DISTINCT e.exam_id)::INTEGER AS total
      FROM tbl_exams e
      LEFT JOIN tbl_exam_classes ec
        ON ec.exam_id = e.exam_id
      LEFT JOIN tbl_classes c
        ON c.class_id = ec.class_id
      ${whereClause}
      GROUP BY e.exam_type
      ORDER BY e.exam_type
      `,
      values
    );

    const statusResult = await pool.query(
      `
      SELECT
        e.status,
        COUNT(DISTINCT e.exam_id)::INTEGER AS total
      FROM tbl_exams e
      LEFT JOIN tbl_exam_classes ec
        ON ec.exam_id = e.exam_id
      LEFT JOIN tbl_classes c
        ON c.class_id = ec.class_id
      ${whereClause}
      GROUP BY e.status
      ORDER BY e.status
      `,
      values
    );

    const offset =
      (pageNumber - 1) * limitNumber;

    const dataValues = [...values];

    dataValues.push(limitNumber);
    const limitIndex = dataValues.length;

    dataValues.push(offset);
    const offsetIndex = dataValues.length;

    const examResult = await pool.query(
      `
      SELECT
        e.exam_id,
        e.exam_name,
        e.exam_type,
        e.academic_year_id,
        e.start_date,
        e.end_date,
        e.description,
        e.status,
        e.is_active,
        e.created_at,
        e.updated_at,

        COALESCE(
          JSON_AGG(
            DISTINCT JSONB_BUILD_OBJECT(
              'class_id', c.class_id,
              'class_name', c.class_name
            )
          ) FILTER (
            WHERE c.class_id IS NOT NULL
          ),
          '[]'::JSON
        ) AS classes

      FROM tbl_exams e

      LEFT JOIN tbl_exam_classes ec
        ON ec.exam_id = e.exam_id

      LEFT JOIN tbl_classes c
        ON c.class_id = ec.class_id

      ${whereClause}

      GROUP BY
        e.exam_id,
        e.exam_name,
        e.exam_type,
        e.academic_year_id,
        e.start_date,
        e.end_date,
        e.description,
        e.status,
        e.is_active,
        e.created_at,
        e.updated_at

      ORDER BY
        e.start_date DESC,
        e.exam_id DESC

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
      "Exams fetched successfully",
      {

        statistics: {
          ...statisticsResult.rows[0],
          exam_type_summary: typeResult.rows,
          status_summary: statusResult.rows,
        },

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

        exams: examResult.rows,
      }
    );
  } catch (error) {
    console.error(
      "Get All Exams Error:",
      error
    );

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

export const getExamById = async (req, res) => {
  try {
    const { exam_id } = req.params;

    if (!isValidId(exam_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid exam ID is required"
      );
    }

    const examResult = await pool.query(
      `
      SELECT
        e.exam_id,
        e.exam_name,
        e.exam_type,
        e.academic_year_id,
        e.start_date,
        e.end_date,
        e.description,
        e.status,
        e.is_active,
        e.created_at,
        e.updated_at,

        COALESCE(
          JSON_AGG(
            DISTINCT JSONB_BUILD_OBJECT(
              'class_id', c.class_id,
              'class_name', c.class_name
            )
          ) FILTER (
            WHERE c.class_id IS NOT NULL
          ),
          '[]'::JSON
        ) AS classes

      FROM tbl_exams e

      LEFT JOIN tbl_exam_classes ec
        ON ec.exam_id = e.exam_id

      LEFT JOIN tbl_classes c
        ON c.class_id = ec.class_id

      WHERE e.exam_id = $1

      GROUP BY
        e.exam_id,
        e.exam_name,
        e.exam_type,
        e.academic_year_id,
        e.start_date,
        e.end_date,
        e.description,
        e.status,
        e.is_active,
        e.created_at,
        e.updated_at
      `,
      [exam_id]
    );

    if (examResult.rowCount === 0) {
      return sendErrorResponse(
        res,
        404,
        `Exam with ID ${exam_id} not found`
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Exam fetched successfully",
      examResult.rows[0]
    );
  } catch (error) {
    console.error("Get exam error:", error);

    return sendErrorResponse(
      res,
      500,
      "Failed to fetch exam"
    );
  }
};

export const uploadSubjectResults = async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      exam_id,
      class_id,
      section_id,
      subject_id,
      results,
    } = req.body;

    await client.query("BEGIN");

    const examResult = await client.query(
      `
      SELECT exam_id
      FROM tbl_exams
      WHERE exam_id = $1
        AND is_active = true
      `,
      [exam_id]
    );

    if (examResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return sendErrorResponse(
        res,
        404,
        `Exam with ID ${exam_id} not found`
      );
    }

    const classSectionResult = await client.query(
      `
      SELECT class_section_id
      FROM tbl_class_sections
      WHERE class_id = $1
        AND section_id = $2
        AND is_active = true
      `,
      [class_id, section_id]
    );

    if (classSectionResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return sendErrorResponse(
        res,
        404,
        `Class with ID ${class_id} and section with ID ${section_id} not found`
      );
    }

    const classSectionId =
      classSectionResult.rows[0].class_section_id;

    const subjectResult = await client.query(
      `
      SELECT subject_id
      FROM tbl_subjects
      WHERE subject_id = $1
        AND is_active = true
      `,
      [subject_id]
    );

    if (subjectResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return sendErrorResponse(
        res,
        404,
        `Subject with ID ${subject_id} not found`
      );
    }

    const studentIds = results.map(
      (result) => result.student_id
    );

    const studentResult = await client.query(
      `
      SELECT student_id
      FROM tbl_student_class_sections
      WHERE class_section_id = $1
        AND student_id = ANY($2::INTEGER[])
        AND is_active = true
      `,
      [classSectionId, studentIds]
    );

    if (
      studentResult.rows.length !== studentIds.length
    ) {
      await client.query("ROLLBACK");

      return sendErrorResponse(
        res,
        400,
        "One or more students do not belong to the selected class section"
      );
    }

    const marksObtained = results.map(
      (result) => result.marks_obtained
    );

    await client.query(
      `
      INSERT INTO tbl_exam_results (
        exam_id,
        student_id,
        class_section_id,
        subject_id,
        marks_obtained
      )
      SELECT
        $1,
        student_id,
        $2,
        $3,
        marks_obtained
      FROM UNNEST(
        $4::INTEGER[],
        $5::NUMERIC[]
      ) AS data(
        student_id,
        marks_obtained
      )
      ON CONFLICT (
        exam_id,
        student_id,
        subject_id
      )
      DO UPDATE SET
        class_section_id = EXCLUDED.class_section_id,
        marks_obtained = EXCLUDED.marks_obtained,
        updated_at = CURRENT_TIMESTAMP
      `,
      [
        exam_id,
        classSectionId,
        subject_id,
        studentIds,
        marksObtained,
      ]
    );

    await client.query("COMMIT");

    return sendSuccessResponse(
      res,
      200,
      "Subject results uploaded successfully",
      {
        exam_id,
        class_id,
        section_id,
        class_section_id: classSectionId,
        subject_id,
        total_students: results.length,
      }
    );
  } catch (error) {
    await client.query("ROLLBACK");

    console.error(
      "Upload Subject Results Error:",
      error
    );

    const message =
      process.env.NODE_ENV === "development"
        ? error.message
        : "Internal server error";

    return sendErrorResponse(
      res,
      500,
      message
    );
  } finally {
    client.release();
  }
};

export const getStudentResults = async (req, res) => {
  try {
    const { student_id } = req.params;

    if (!isValidId(student_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid student ID is required"
      );
    }

    const studentResult = await pool.query(
      `
      SELECT
        student_id,
        CONCAT(first_name, ' ', last_name) AS student_name
      FROM tbl_students
      WHERE student_id = $1
        AND is_active = true
      `,
      [student_id]
    );

    if (studentResult.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Student with ID ${student_id} not found`
      );
    }

    const result = await pool.query(
      `
      SELECT
        er.exam_id,
        e.exam_name,
        er.subject_id,
        s.subject_name,
        er.marks_obtained
      FROM tbl_exam_results er
      INNER JOIN tbl_exams e
        ON e.exam_id = er.exam_id
      INNER JOIN tbl_subjects s
        ON s.subject_id = er.subject_id
      WHERE er.student_id = $1
      ORDER BY e.start_date DESC, s.subject_name ASC
      `,
      [student_id]
    );

    return sendSuccessResponse(
      res,
      200,
      "Student results fetched successfully",
      {
        student: studentResult.rows[0],
        results: result.rows,
      }
    );
  } catch (error) {
    console.error(
      "Get Student Results Error:",
      error
    );

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

export const getStudentExamResult = async (req, res) => {
  try {
    const {
      student_id,
      exam_id,
    } = req.params;

    if (!isValidId(student_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid student ID is required"
      );
    }

    if (!isValidId(exam_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid exam ID is required"
      );
    }

    const studentResult = await pool.query(
      `
      SELECT
        student_id,
        CONCAT(first_name, ' ', last_name) AS student_name
      FROM tbl_students
      WHERE student_id = $1
        AND is_active = true
      `,
      [student_id]
    );

    if (studentResult.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Student with ID ${student_id} not found`
      );
    }

    const examResult = await pool.query(
      `
      SELECT
        exam_id,
        exam_name
      FROM tbl_exams
      WHERE exam_id = $1
        AND is_active = true
      `,
      [exam_id]
    );

    if (examResult.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Exam with ID ${exam_id} not found`
      );
    }

    const result = await pool.query(
      `
      SELECT
        er.subject_id,
        s.subject_name,
        er.marks_obtained
      FROM tbl_exam_results er
      INNER JOIN tbl_subjects s
        ON s.subject_id = er.subject_id
      WHERE er.student_id = $1
        AND er.exam_id = $2
      ORDER BY s.subject_name ASC
      `,
      [student_id, exam_id]
    );

    return sendSuccessResponse(
      res,
      200,
      "Student exam result fetched successfully",
      {
        student: studentResult.rows[0],
        exam: examResult.rows[0],
        results: result.rows,
      }
    );
  } catch (error) {
    console.error(
      "Get Student Exam Result Error:",
      error
    );

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

export const updateExam = async (req, res) => {
  const client = await pool.connect();

  try {
    const { exam_id } = req.params;

    if (!isValidId(exam_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid exam ID is required"
      );
    }

    const existingExam = await client.query(
      `
      SELECT exam_id
      FROM tbl_exams
      WHERE exam_id = $1
      `,
      [exam_id]
    );

    if (existingExam.rowCount === 0) {
      return sendErrorResponse(
        res,
        404,
        `Exam with ID ${exam_id} not found`
      );
    }

    const {
      exam_name,
      exam_type,
      start_date,
      end_date,
      description,
      status,
      is_active,
      class_ids,
    } = req.body;

    if (
      class_ids !== undefined &&
      (!Array.isArray(class_ids) || class_ids.length === 0)
    ) {
      return sendErrorResponse(
        res,
        400,
        "At least one class is required"
      );
    }

    await client.query("BEGIN");

    const fields = [];
    const values = [];

    if (exam_name !== undefined) {
      fields.push(
        `exam_name = $${values.length + 1}`
      );
      values.push(exam_name.trim());
    }

    if (exam_type !== undefined) {
      fields.push(
        `exam_type = $${values.length + 1}`
      );
      values.push(exam_type);
    }

    if (start_date !== undefined) {
      fields.push(
        `start_date = $${values.length + 1}`
      );
      values.push(start_date);
    }

    if (end_date !== undefined) {
      fields.push(
        `end_date = $${values.length + 1}`
      );
      values.push(end_date);
    }

    if (description !== undefined) {
      fields.push(
        `description = $${values.length + 1}`
      );
      values.push(description?.trim() || null);
    }

    if (status !== undefined) {
      fields.push(
        `status = $${values.length + 1}`
      );
      values.push(status);
    }

    if (is_active !== undefined) {
      fields.push(
        `is_active = $${values.length + 1}`
      );
      values.push(is_active);
    }

    if (fields.length === 0 && class_ids === undefined) {
      await client.query("ROLLBACK");

      return sendErrorResponse(
        res,
        400,
        "No fields provided for update"
      );
    }

    if (class_ids !== undefined) {
      const classResult = await client.query(
        `
        SELECT class_id
        FROM tbl_classes
        WHERE class_id = ANY($1::INTEGER[])
          AND is_active = true
        `,
        [class_ids]
      );

      if (classResult.rowCount !== class_ids.length) {
        await client.query("ROLLBACK");

        return sendErrorResponse(
          res,
          400,
          "One or more selected classes are invalid or inactive"
        );
      }
    }

    let updatedExam = null;

    if (fields.length > 0) {
      values.push(exam_id);

      const examResult = await client.query(
        `
        UPDATE tbl_exams
        SET
          ${fields.join(", ")},
          updated_at = CURRENT_TIMESTAMP
        WHERE exam_id = $${values.length}
        RETURNING
          exam_id,
          exam_name,
          exam_type,
          academic_year_id,
          start_date,
          end_date,
          description,
          status,
          is_active,
          created_at,
          updated_at
        `,
        values
      );

      updatedExam = examResult.rows[0];
    } else {
      const examResult = await client.query(
        `
        SELECT
          exam_id,
          exam_name,
          exam_type,
          academic_year_id,
          start_date,
          end_date,
          description,
          status,
          is_active,
          created_at,
          updated_at
        FROM tbl_exams
        WHERE exam_id = $1
        `,
        [exam_id]
      );

      updatedExam = examResult.rows[0];
    }

    if (class_ids !== undefined) {
      await client.query(
        `
        DELETE FROM tbl_exam_classes
        WHERE exam_id = $1
        `,
        [exam_id]
      );

      await client.query(
        `
        INSERT INTO tbl_exam_classes (
          exam_id,
          class_id
        )
        SELECT
          $1,
          UNNEST($2::INTEGER[])
        `,
        [exam_id, class_ids]
      );
    }

    const classResult = await client.query(
      `
      SELECT
        c.class_id,
        c.class_name
      FROM tbl_exam_classes ec
      INNER JOIN tbl_classes c
        ON c.class_id = ec.class_id
      WHERE ec.exam_id = $1
      ORDER BY c.class_id
      `,
      [exam_id]
    );

    await client.query("COMMIT");

    return sendSuccessResponse(
      res,
      200,
      "Exam updated successfully",
      {
        ...updatedExam,
        classes: classResult.rows,
      }
    );
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Update exam error:", error);

    return sendErrorResponse(
      res,
      500,
      "Failed to update exam"
    );
  } finally {
    client.release();
  }
};

export const deleteExam = async (req, res) => {
  try {
    const { exam_id } = req.params;

    if (!isValidId(exam_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid exam ID is required"
      );
    }

    const result = await pool.query(
      `
      UPDATE tbl_exams
      SET
        is_active = false,
        updated_at = CURRENT_TIMESTAMP
      WHERE exam_id = $1
        AND is_active = true
      RETURNING exam_id
      `,
      [exam_id]
    );

    if (result.rowCount === 0) {
      return sendErrorResponse(
        res,
        404,
        `Exam with ID ${exam_id} not found`
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Exam deleted successfully"
    );
  } catch (error) {
    console.error("Delete exam error:", error);

    return sendErrorResponse(
      res,
      500,
      "Failed to delete exam"
    );
  }
};