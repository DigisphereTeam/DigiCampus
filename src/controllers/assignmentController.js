import pool from "../config/database.js";
import { sendErrorResponse, sendSuccessResponse } from "../utils/response.js";
import { isValidId } from "../utils/validation.js";

export const createAssignment = async (req, res) => {
  try {
    const userId = req.user.user_id;

    const {
      title,
      description,
      class_section_id,
      subject_id,
      due_date,
      max_marks,
    } = req.body;

    const teacherQuery = `
      SELECT teacher_id
      FROM tbl_teachers
      WHERE user_id = $1
        AND is_active = TRUE
      LIMIT 1
    `;

    const academicYearQuery = `
      SELECT academic_year_id
      FROM tbl_academic_years
      WHERE is_current = TRUE
      LIMIT 1
    `;

    const sectionQuery = `
      SELECT class_section_id
      FROM tbl_class_sections
      WHERE class_section_id = $1
        AND is_active = TRUE
      LIMIT 1
    `;

    const subjectQuery = `
      SELECT subject_id
      FROM tbl_subjects
      WHERE subject_id = $1
      LIMIT 1
    `;

    const [
      teacherResult,
      academicYearResult,
      sectionResult,
      subjectResult,
    ] = await Promise.all([
      pool.query(teacherQuery, [userId]),
      pool.query(academicYearQuery),
      pool.query(sectionQuery, [Number(class_section_id)]),
      pool.query(subjectQuery, [Number(subject_id)]),
    ]);

    if (teacherResult.rows.length === 0) {
      return sendErrorResponse(
        res,
        403,
        "Only active teachers can create assignments"
      );
    }

    if (academicYearResult.rows.length === 0) {
      return sendErrorResponse(
        res,
        400,
        "Current academic year not found"
      );
    }

    if (sectionResult.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        "Class section not found"
      );
    }

    if (subjectResult.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        "Subject not found"
      );
    }

    const teacherId = teacherResult.rows[0].teacher_id;
    const academicYearId =
      academicYearResult.rows[0].academic_year_id;

    const result = await pool.query(
      `
      INSERT INTO tbl_assignments (
        title,
        description,
        class_section_id,
        subject_id,
        teacher_id,
        academic_year_id,
        assigned_date,
        due_date,
        max_marks,
        status
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        (
          CURRENT_TIMESTAMP
          AT TIME ZONE 'Asia/Kolkata'
        )::DATE,
        $7::DATE,
        $8,
        'DRAFT'
      )
      RETURNING
        assignment_id,
        title,
        description,
        class_section_id,
        subject_id,
        teacher_id,
        academic_year_id,
        assigned_date,
        due_date,
        max_marks,
        status,
        created_at,
        updated_at
      `,
      [
        title,
        description || null,
        Number(class_section_id),
        Number(subject_id),
        teacherId,
        academicYearId,
        due_date,
        max_marks !== undefined &&
          max_marks !== null &&
          max_marks !== ""
          ? Number(max_marks)
          : null,
      ]
    );

    return sendSuccessResponse(
      res,
      201,
      "Assignment created successfully",
      result.rows[0]
    );
  } catch (error) {
    console.error("createAssignment error:", {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });

    if (error.code === "23503") {
      return sendErrorResponse(
        res,
        400,
        "Invalid assignment reference"
      );
    }

    if (error.code === "23505") {
      return sendErrorResponse(
        res,
        409,
        "Assignment already exists"
      );
    }

    if (error.code === "23514") {
      return sendErrorResponse(
        res,
        400,
        "Invalid assignment data"
      );
    }

    const message =
      process.env.NODE_ENV === "development"
        ? error.message
        : "Failed to create Assignment";

    return sendErrorResponse(res, 500, message);
  }
};

export const getAllAssignments = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      class_section_id,
      subject_id,
      teacher_id,
      academic_year_id,
      status,
    } = req.query;

    const values = [];
    const conditions = [];

    if (class_section_id) {
      values.push(Number(class_section_id));
      conditions.push(`a.class_section_id = $${values.length}`);
    }

    if (subject_id) {
      values.push(Number(subject_id));
      conditions.push(`a.subject_id = $${values.length}`);
    }

    if (teacher_id) {
      values.push(Number(teacher_id));
      conditions.push(`a.teacher_id = $${values.length}`);
    }

    if (academic_year_id) {
      values.push(Number(academic_year_id));
      conditions.push(`a.academic_year_id = $${values.length}`);
    }

    if (status) {
      values.push(status);
      conditions.push(`a.status = $${values.length}`);
    }

    const whereClause =
      conditions.length > 0
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

    const countResult = await pool.query(
      `
      SELECT COUNT(*)::INTEGER AS total
      FROM tbl_assignments a
      ${whereClause}
      `,
      values
    );

    const total = countResult.rows[0].total;

    const offset = (Number(page) - 1) * Number(limit);

    values.push(Number(limit));
    const limitIndex = values.length;

    values.push(offset);
    const offsetIndex = values.length;

    const result = await pool.query(
      `
      SELECT
        a.assignment_id,
        a.title,
        a.description,
        a.class_section_id,
        c.class_name,
        s.section_name,
        a.subject_id,
        sub.subject_name,
        a.teacher_id,
        t.full_name AS teacher_name,
        a.academic_year_id,
        ay.academic_year AS academic_year,
        a.assigned_date,
        a.due_date,
        a.max_marks,
        a.status,
        a.created_at,
        a.updated_at
      FROM tbl_assignments a
      LEFT JOIN tbl_class_sections cs
        ON cs.class_section_id = a.class_section_id
      LEFT JOIN tbl_classes c
        ON c.class_id = cs.class_id
      LEFT JOIN tbl_sections s
        ON s.section_id = cs.section_id
      LEFT JOIN tbl_subjects sub
        ON sub.subject_id = a.subject_id
      LEFT JOIN tbl_teachers t
        ON t.teacher_id = a.teacher_id
      LEFT JOIN tbl_academic_years ay
        ON ay.academic_year_id = a.academic_year_id
      ${whereClause}
      ORDER BY a.created_at DESC
      LIMIT $${limitIndex}
      OFFSET $${offsetIndex}
      `,
      values
    );

    return sendSuccessResponse(
      res,
      200,
      "Assignments fetched successfully",
      {
        pagination_info: {
          page: Number(page),
          limit: Number(limit),
          next_page:
            Number(page) < Math.ceil(total / Number(limit))
              ? Number(page) + 1
              : null,
          prev_page:
            Number(page) > 1
              ? Number(page) - 1
              : null,
          total,
          total_pages: Math.ceil(total / Number(limit)),
        },
        assignments: result.rows,
      }
    );
  } catch (error) {
    console.error("getAllAssignments error:", {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });

    const message =
      process.env.NODE_ENV === "development"
        ? error.message
        : "Failed to fetch assignments";

    return sendErrorResponse(res, 500, message);
  }
};

export const getAssignmentById = async (req, res) => {
  try {
    const { assignment_id } = req.params;

    if (!isValidId(assignment_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid assignment ID is required"
      );
    }

    const result = await pool.query(
      `
      SELECT
        a.assignment_id,
        a.title,
        a.description,
        a.class_section_id,
        c.class_name,
        s.section_name,
        a.subject_id,
        sub.subject_name,
        a.teacher_id,
        t.full_name AS teacher_name,
        a.academic_year_id,
        ay.academic_year,
        a.assigned_date,
        a.due_date,
        a.max_marks,
        a.status,
        a.created_at,
        a.updated_at
      FROM tbl_assignments a
      LEFT JOIN tbl_class_sections cs
        ON cs.class_section_id = a.class_section_id
      LEFT JOIN tbl_classes c
        ON c.class_id = cs.class_id
      LEFT JOIN tbl_sections s
        ON s.section_id = cs.section_id
      LEFT JOIN tbl_subjects sub
        ON sub.subject_id = a.subject_id
      LEFT JOIN tbl_teachers t
        ON t.teacher_id = a.teacher_id
      LEFT JOIN tbl_academic_years ay
        ON ay.academic_year_id = a.academic_year_id
      WHERE a.assignment_id = $1
      LIMIT 1
      `,
      [Number(assignment_id)]
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Assignment with ID ${assignment_id} not found`
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Assignment fetched successfully",
      result.rows[0]
    );
  } catch (error) {
    console.error("getAssignmentById error:", {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });

    const message =
      process.env.NODE_ENV === "development"
        ? error.message
        : "Failed to fetch assignment";

    return sendErrorResponse(res, 500, message);
  }
};

export const updateAssignment = async (req, res) => {
  try {
    const { assignment_id } = req.params;

    if (!isValidId(assignment_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid assignment ID is required"
      );
    }

    const {
      title,
      description,
      class_section_id,
      subject_id,
      due_date,
      max_marks,
      status,
    } = req.body;

    const existingResult = await pool.query(
      `
      SELECT assignment_id
      FROM tbl_assignments
      WHERE assignment_id = $1
      LIMIT 1
      `,
      [Number(assignment_id)]
    );

    if (existingResult.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Assignment with ID ${assignment_id} not found`
      );
    }

    const fields = [];
    const values = [];

    if (title !== undefined) {
      values.push(title);
      fields.push(`title = $${values.length}`);
    }

    if (description !== undefined) {
      values.push(description || null);
      fields.push(`description = $${values.length}`);
    }

    if (class_section_id !== undefined) {
      values.push(Number(class_section_id));
      fields.push(`class_section_id = $${values.length}`);
    }

    if (subject_id !== undefined) {
      values.push(Number(subject_id));
      fields.push(`subject_id = $${values.length}`);
    }

    if (due_date !== undefined) {
      values.push(due_date);
      fields.push(`due_date = $${values.length}::DATE`);
    }

    if (
      max_marks !== undefined &&
      max_marks !== null &&
      max_marks !== ""
    ) {
      values.push(Number(max_marks));
      fields.push(`max_marks = $${values.length}`);
    }

    if (status !== undefined) {
      values.push(status);
      fields.push(`status = $${values.length}`);
    }

    if (fields.length === 0) {
      return sendErrorResponse(
        res,
        400,
        "No fields provided for update"
      );
    }

    values.push(Number(assignment_id));

    const result = await pool.query(
      `
      UPDATE tbl_assignments
      SET
        ${fields.join(", ")},
        updated_at = CURRENT_TIMESTAMP
      WHERE assignment_id = $${values.length}
      RETURNING
        assignment_id,
        title,
        description,
        class_section_id,
        subject_id,
        teacher_id,
        academic_year_id,
        assigned_date,
        due_date,
        max_marks,
        status,
        created_at,
        updated_at
      `,
      values
    );

    return sendSuccessResponse(
      res,
      200,
      "Assignment updated successfully",
      result.rows[0]
    );
  } catch (error) {
    console.error("updateAssignment error:", {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });

    if (error.code === "23503") {
      return sendErrorResponse(
        res,
        400,
        "Invalid assignment reference"
      );
    }

    if (error.code === "23505") {
      return sendErrorResponse(
        res,
        409,
        "Assignment already exists"
      );
    }

    if (error.code === "23514") {
      return sendErrorResponse(
        res,
        400,
        "Invalid assignment data"
      );
    }

    const message =
      process.env.NODE_ENV === "development"
        ? error.message
        : "Failed to update assignment";

    return sendErrorResponse(res, 500, message);
  }
};

export const deleteAssignment = async (req, res) => {
  try {
    const { assignment_id } = req.params;

    if (!isValidId(assignment_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid assignment ID is required"
      );
    }

    const result = await pool.query(
      `
      DELETE FROM tbl_assignments
      WHERE assignment_id = $1
      RETURNING assignment_id
      `,
      [Number(assignment_id)]
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Assignment with ID ${assignment_id} not found`
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Assignment deleted successfully",
      {
        assignment_id: result.rows[0].assignment_id,
      }
    );
  } catch (error) {
    console.error("deleteAssignment error:", {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });

    if (error.code === "23503") {
      return sendErrorResponse(
        res,
        400,
        "Assignment cannot be deleted because it is referenced by other records"
      );
    }

    const message =
      process.env.NODE_ENV === "development"
        ? error.message
        : "Failed to delete assignment";

    return sendErrorResponse(res, 500, message);
  }
};