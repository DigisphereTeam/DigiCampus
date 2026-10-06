import pool from "../config/db.js";

export const createTeacherSubjectAllocation = async (req, res) => {
  try {
    const {
      teacher_id,
      academic_year_id,
      class_section_id,
      subject_id,
    } = req.body;

    if (!teacher_id || !Number.isInteger(Number(teacher_id))) {
      return sendErrorResponse(res, 422, "Valid teacher ID is required");
    }

    if (
      !academic_year_id ||
      !Number.isInteger(Number(academic_year_id))
    ) {
      return sendErrorResponse(
        res,
        422,
        "Valid academic year ID is required"
      );
    }

    if (
      !class_section_id ||
      !Number.isInteger(Number(class_section_id))
    ) {
      return sendErrorResponse(
        res,
        422,
        "Valid class section ID is required"
      );
    }

    if (!subject_id || !Number.isInteger(Number(subject_id))) {
      return sendErrorResponse(res, 422, "Valid subject ID is required");
    }

    const teacherResult = await pool.query(
      `
      SELECT employee_id
      FROM tbl_employees
      WHERE employee_id = $1
        AND employee_type = 'TEACHER'
      `,
      [teacher_id]
    );

    if (teacherResult.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Teacher with ID ${teacher_id} not found`
      );
    }

    const academicYearResult = await pool.query(
      `
      SELECT academic_year_id
      FROM tbl_academic_years
      WHERE academic_year_id = $1
      `,
      [academic_year_id]
    );

    if (academicYearResult.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Academic year with ID ${academic_year_id} not found`
      );
    }

    const classSectionResult = await pool.query(
      `
      SELECT class_section_id
      FROM tbl_class_sections
      WHERE class_section_id = $1
        AND academic_year_id = $2
      `,
      [class_section_id, academic_year_id]
    );

    if (classSectionResult.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Class section with ID ${class_section_id} not found`
      );
    }

    const subjectResult = await pool.query(
      `
      SELECT subject_id
      FROM tbl_subjects
      WHERE subject_id = $1
      `,
      [subject_id]
    );

    if (subjectResult.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Subject with ID ${subject_id} not found`
      );
    }

    const existingAllocation = await pool.query(
      `
      SELECT allocation_id
      FROM tbl_teacher_subject_allocations
      WHERE teacher_id = $1
        AND academic_year_id = $2
        AND class_section_id = $3
        AND subject_id = $4
      `,
      [
        teacher_id,
        academic_year_id,
        class_section_id,
        subject_id,
      ]
    );

    if (existingAllocation.rows.length > 0) {
      return sendErrorResponse(
        res,
        409,
        "Teacher subject allocation already exists"
      );
    }

    const result = await pool.query(
      `
      INSERT INTO tbl_teacher_subject_allocations (
        teacher_id,
        academic_year_id,
        class_section_id,
        subject_id
      )
      VALUES ($1, $2, $3, $4)
      RETURNING *
      `,
      [
        teacher_id,
        academic_year_id,
        class_section_id,
        subject_id,
      ]
    );

    return sendSuccessResponse(
      res,
      201,
      "Teacher subject allocated successfully",
      result.rows[0]
    );
  } catch (error) {
    console.error("Create teacher subject allocation error:", error);

    return sendErrorResponse(res, 500, "Internal server error");
  }
};

export const getTeacherSubjectAllocations = async (req, res) => {
  try {
    const {
      academic_year_id,
      class_section_id,
      teacher_id,
      subject_id,
    } = req.query;

    if (
      academic_year_id !== undefined &&
      (!Number.isInteger(Number(academic_year_id)) ||
        Number(academic_year_id) <= 0)
    ) {
      return sendErrorResponse(
        res,
        422,
        "Valid academic year ID is required"
      );
    }

    if (
      class_section_id !== undefined &&
      (!Number.isInteger(Number(class_section_id)) ||
        Number(class_section_id) <= 0)
    ) {
      return sendErrorResponse(
        res,
        422,
        "Valid class section ID is required"
      );
    }

    if (
      teacher_id !== undefined &&
      (!Number.isInteger(Number(teacher_id)) ||
        Number(teacher_id) <= 0)
    ) {
      return sendErrorResponse(res, 422, "Valid teacher ID is required");
    }

    if (
      subject_id !== undefined &&
      (!Number.isInteger(Number(subject_id)) ||
        Number(subject_id) <= 0)
    ) {
      return sendErrorResponse(res, 422, "Valid subject ID is required");
    }

    const conditions = [];
    const values = [];

    if (academic_year_id !== undefined) {
      values.push(Number(academic_year_id));
      conditions.push(`tsa.academic_year_id = $${values.length}`);
    }

    if (class_section_id !== undefined) {
      values.push(Number(class_section_id));
      conditions.push(`tsa.class_section_id = $${values.length}`);
    }

    if (teacher_id !== undefined) {
      values.push(Number(teacher_id));
      conditions.push(`tsa.teacher_id = $${values.length}`);
    }

    if (subject_id !== undefined) {
      values.push(Number(subject_id));
      conditions.push(`tsa.subject_id = $${values.length}`);
    }

    const whereClause =
      conditions.length > 0
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

    const result = await pool.query(
      `
      SELECT
        tsa.allocation_id,
        tsa.teacher_id,
        e.employee_code,
        tsa.academic_year_id,
        tsa.class_section_id,
        cs.class_id,
        cs.section_id,
        tsa.subject_id,
        s.subject_name,
        tsa.created_at,
        tsa.updated_at
      FROM tbl_teacher_subject_allocations tsa
      INNER JOIN tbl_employees e
        ON e.employee_id = tsa.teacher_id
      INNER JOIN tbl_class_sections cs
        ON cs.class_section_id = tsa.class_section_id
      INNER JOIN tbl_subjects s
        ON s.subject_id = tsa.subject_id
      ${whereClause}
      ORDER BY tsa.allocation_id DESC
      `,
      values
    );

    return sendSuccessResponse(
      res,
      200,
      "Teacher subject allocations fetched successfully",
      result.rows
    );
  } catch (error) {
    console.error("Get teacher subject allocations error:", error);

    return sendErrorResponse(res, 500, "Internal server error");
  }
};

export const getTeacherSubjectAllocationById = async (req, res) => {
  try {
    const { allocation_id } = req.params;

    if (
      !allocation_id ||
      !Number.isInteger(Number(allocation_id)) ||
      Number(allocation_id) <= 0
    ) {
      return sendErrorResponse(
        res,
        422,
        "Valid allocation ID is required"
      );
    }

    const result = await pool.query(
      `
      SELECT
        tsa.allocation_id,
        tsa.teacher_id,
        e.employee_code,
        tsa.academic_year_id,
        tsa.class_section_id,
        cs.class_id,
        cs.section_id,
        tsa.subject_id,
        s.subject_name,
        tsa.created_at,
        tsa.updated_at
      FROM tbl_teacher_subject_allocations tsa
      INNER JOIN tbl_employees e
        ON e.employee_id = tsa.teacher_id
      INNER JOIN tbl_class_sections cs
        ON cs.class_section_id = tsa.class_section_id
      INNER JOIN tbl_subjects s
        ON s.subject_id = tsa.subject_id
      WHERE tsa.allocation_id = $1
      `,
      [allocation_id]
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Teacher subject allocation with ID ${allocation_id} not found`
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Teacher subject allocation fetched successfully",
      result.rows[0]
    );
  } catch (error) {
    console.error(
      "Get teacher subject allocation by ID error:",
      error
    );

    return sendErrorResponse(res, 500, "Internal server error");
  }
};

export const updateTeacherSubjectAllocation = async (req, res) => {
  try {
    const { allocation_id } = req.params;

    const {
      teacher_id,
      academic_year_id,
      class_section_id,
      subject_id,
    } = req.body;

    if (
      !allocation_id ||
      !Number.isInteger(Number(allocation_id)) ||
      Number(allocation_id) <= 0
    ) {
      return sendErrorResponse(
        res,
        422,
        "Valid allocation ID is required"
      );
    }

    if (
      teacher_id === undefined &&
      academic_year_id === undefined &&
      class_section_id === undefined &&
      subject_id === undefined
    ) {
      return sendErrorResponse(
        res,
        422,
        "At least one field is required for update"
      );
    }

    const existingAllocation = await pool.query(
      `
      SELECT *
      FROM tbl_teacher_subject_allocations
      WHERE allocation_id = $1
      `,
      [allocation_id]
    );

    if (existingAllocation.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Teacher subject allocation with ID ${allocation_id} not found`
      );
    }

    const current = existingAllocation.rows[0];

    const updatedTeacherId =
      teacher_id !== undefined ? teacher_id : current.teacher_id;

    const updatedAcademicYearId =
      academic_year_id !== undefined
        ? academic_year_id
        : current.academic_year_id;

    const updatedClassSectionId =
      class_section_id !== undefined
        ? class_section_id
        : current.class_section_id;

    const updatedSubjectId =
      subject_id !== undefined
        ? subject_id
        : current.subject_id;

    if (
      !Number.isInteger(Number(updatedTeacherId)) ||
      Number(updatedTeacherId) <= 0
    ) {
      return sendErrorResponse(
        res,
        422,
        "Valid teacher ID is required"
      );
    }

    if (
      !Number.isInteger(Number(updatedAcademicYearId)) ||
      Number(updatedAcademicYearId) <= 0
    ) {
      return sendErrorResponse(
        res,
        422,
        "Valid academic year ID is required"
      );
    }

    if (
      !Number.isInteger(Number(updatedClassSectionId)) ||
      Number(updatedClassSectionId) <= 0
    ) {
      return sendErrorResponse(
        res,
        422,
        "Valid class section ID is required"
      );
    }

    if (
      !Number.isInteger(Number(updatedSubjectId)) ||
      Number(updatedSubjectId) <= 0
    ) {
      return sendErrorResponse(
        res,
        422,
        "Valid subject ID is required"
      );
    }

    const teacherResult = await pool.query(
      `
      SELECT employee_id
      FROM tbl_employees
      WHERE employee_id = $1
        AND employee_type = 'TEACHER'
      `,
      [updatedTeacherId]
    );

    if (teacherResult.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Teacher with ID ${updatedTeacherId} not found`
      );
    }

    const academicYearResult = await pool.query(
      `
      SELECT academic_year_id
      FROM tbl_academic_years
      WHERE academic_year_id = $1
      `,
      [updatedAcademicYearId]
    );

    if (academicYearResult.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Academic year with ID ${updatedAcademicYearId} not found`
      );
    }

    const classSectionResult = await pool.query(
      `
      SELECT class_section_id
      FROM tbl_class_sections
      WHERE class_section_id = $1
        AND academic_year_id = $2
      `,
      [updatedClassSectionId, updatedAcademicYearId]
    );

    if (classSectionResult.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Class section with ID ${updatedClassSectionId} not found`
      );
    }

    const subjectResult = await pool.query(
      `
      SELECT subject_id
      FROM tbl_subjects
      WHERE subject_id = $1
      `,
      [updatedSubjectId]
    );

    if (subjectResult.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Subject with ID ${updatedSubjectId} not found`
      );
    }

    const duplicateAllocation = await pool.query(
      `
      SELECT allocation_id
      FROM tbl_teacher_subject_allocations
      WHERE teacher_id = $1
        AND academic_year_id = $2
        AND class_section_id = $3
        AND subject_id = $4
        AND allocation_id <> $5
      `,
      [
        updatedTeacherId,
        updatedAcademicYearId,
        updatedClassSectionId,
        updatedSubjectId,
        allocation_id,
      ]
    );

    if (duplicateAllocation.rows.length > 0) {
      return sendErrorResponse(
        res,
        409,
        "Teacher subject allocation already exists"
      );
    }

    const result = await pool.query(
      `
      UPDATE tbl_teacher_subject_allocations
      SET
        teacher_id = $1,
        academic_year_id = $2,
        class_section_id = $3,
        subject_id = $4,
        updated_at = CURRENT_TIMESTAMP
      WHERE allocation_id = $5
      RETURNING *
      `,
      [
        updatedTeacherId,
        updatedAcademicYearId,
        updatedClassSectionId,
        updatedSubjectId,
        allocation_id,
      ]
    );

    return sendSuccessResponse(
      res,
      200,
      "Teacher subject allocation updated successfully",
      result.rows[0]
    );
  } catch (error) {
    console.error(
      "Update teacher subject allocation error:",
      error
    );

    return sendErrorResponse(res, 500, "Internal server error");
  }
};

export const deleteTeacherSubjectAllocation = async (req, res) => {
  try {
    const { allocation_id } = req.params;

    if (
      !allocation_id ||
      !Number.isInteger(Number(allocation_id)) ||
      Number(allocation_id) <= 0
    ) {
      return sendErrorResponse(
        res,
        422,
        "Valid allocation ID is required"
      );
    }

    const result = await pool.query(
      `
      DELETE FROM tbl_teacher_subject_allocations
      WHERE allocation_id = $1
      RETURNING allocation_id
      `,
      [allocation_id]
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Teacher subject allocation with ID ${allocation_id} not found`
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Teacher subject allocation deleted successfully",
      result.rows[0]
    );
  } catch (error) {
    console.error(
      "Delete teacher subject allocation error:",
      error
    );

    return sendErrorResponse(res, 500, "Internal server error");
  }
};