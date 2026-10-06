import pool from "../config/database.js";
import {
  sendErrorResponse,
  sendSuccessResponse,
} from "../utils/response.js";
import { isValidId } from "../utils/validation.js";

export const createAssignmentSubmission = async (req, res) => {
  try {
    const { assignment_id } = req.params;
    const {
      student_id,
      submission_text,
      file_url,
    } = req.body;

    if (!isValidId(assignment_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid assignment ID is required"
      );
    }

    const assignmentResult = await pool.query(
      `
      SELECT
        assignment_id,
        due_date,
        status
      FROM tbl_assignments
      WHERE assignment_id = $1
      LIMIT 1
      `,
      [Number(assignment_id)]
    );

    if (assignmentResult.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Assignment with ID ${assignment_id} not found`
      );
    }

    const assignment = assignmentResult.rows[0];

    if (assignment.status === "CANCELLED") {
      return sendErrorResponse(
        res,
        400,
        "Cannot submit a cancelled assignment"
      );
    }

    const studentResult = await pool.query(
      `
      SELECT student_id
      FROM tbl_students
      WHERE student_id = $1
      LIMIT 1
      `,
      [Number(student_id)]
    );

    if (studentResult.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Student with ID ${student_id} not found`
      );
    }

    const existingSubmission = await pool.query(
      `
      SELECT submission_id
      FROM tbl_assignment_submissions
      WHERE assignment_id = $1
        AND student_id = $2
      LIMIT 1
      `,
      [
        Number(assignment_id),
        Number(student_id),
      ]
    );

    if (existingSubmission.rows.length > 0) {
      return sendErrorResponse(
        res,
        409,
        "Student has already submitted this assignment"
      );
    }

    const submissionStatus = `
      (
        CURRENT_TIMESTAMP
        AT TIME ZONE 'Asia/Kolkata'
      )::DATE > $3::DATE
        ?
      `;

    const result = await pool.query(
      `
      INSERT INTO tbl_assignment_submissions (
        assignment_id,
        student_id,
        submitted_at,
        submission_text,
        file_url,
        status
      )
      VALUES (
        $1,
        $2,
        CURRENT_TIMESTAMP,
        $3,
        $4,
        CASE
          WHEN (
            CURRENT_TIMESTAMP
            AT TIME ZONE 'Asia/Kolkata'
          )::DATE > (
            SELECT due_date
            FROM tbl_assignments
            WHERE assignment_id = $1
          )
          THEN 'LATE'
          ELSE 'SUBMITTED'
        END
      )
      RETURNING
        submission_id,
        assignment_id,
        student_id,
        submitted_at,
        submission_text,
        file_url,
        marks_obtained,
        teacher_feedback,
        status,
        evaluated_at,
        evaluated_by,
        created_at,
        updated_at
      `,
      [
        Number(assignment_id),
        Number(student_id),
        submission_text || null,
        file_url || null,
      ]
    );

    return sendSuccessResponse(
      res,
      201,
      "Assignment submitted successfully",
      result.rows[0]
    );
  } catch (error) {
    console.error("createAssignmentSubmission error:", {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });

    if (error.code === "23505") {
      return sendErrorResponse(
        res,
        409,
        "Student has already submitted this assignment"
      );
    }

    if (error.code === "23503") {
      return sendErrorResponse(
        res,
        400,
        "Invalid assignment or student reference"
      );
    }

    const message =
      process.env.NODE_ENV === "development"
        ? error.message
        : "Failed to submit assignment";

    return sendErrorResponse(res, 500, message);
  }
};

export const getAssignmentSubmissions = async (req, res) => {
  try {
    const { assignment_id } = req.params;

    if (!isValidId(assignment_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid assignment ID is required"
      );
    }

    const assignmentResult = await pool.query(
      `
      SELECT assignment_id
      FROM tbl_assignments
      WHERE assignment_id = $1
      LIMIT 1
      `,
      [Number(assignment_id)]
    );

    if (assignmentResult.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Assignment with ID ${assignment_id} not found`
      );
    }

    const result = await pool.query(
      `
      SELECT
        s.submission_id,
        s.assignment_id,
        s.student_id,
        st.full_name AS student_name,
        s.submitted_at,
        s.submission_text,
        s.file_url,
        s.marks_obtained,
        s.teacher_feedback,
        s.status,
        s.evaluated_at,
        s.evaluated_by,
        t.full_name AS evaluator_name,
        s.created_at,
        s.updated_at
      FROM tbl_assignment_submissions s
      LEFT JOIN tbl_students st
        ON st.student_id = s.student_id
      LEFT JOIN tbl_teachers t
        ON t.teacher_id = s.evaluated_by
      WHERE s.assignment_id = $1
      ORDER BY s.submitted_at DESC NULLS LAST
      `,
      [Number(assignment_id)]
    );

    return sendSuccessResponse(
      res,
      200,
      "Assignment submissions fetched successfully",
      {
        assignment_id: Number(assignment_id),
        submissions: result.rows,
      }
    );
  } catch (error) {
    console.error("getAssignmentSubmissions error:", {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });

    const message =
      process.env.NODE_ENV === "development"
        ? error.message
        : "Failed to fetch assignment submissions";

    return sendErrorResponse(res, 500, message);
  }
};

export const getAssignmentSubmissionById = async (req, res) => {
  try {
    const { submission_id } = req.params;

    if (!isValidId(submission_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid submission ID is required"
      );
    }

    const result = await pool.query(
      `
      SELECT
        s.submission_id,
        s.assignment_id,
        a.title AS assignment_title,
        s.student_id,
        st.full_name AS student_name,
        s.submitted_at,
        s.submission_text,
        s.file_url,
        s.marks_obtained,
        s.teacher_feedback,
        s.status,
        s.evaluated_at,
        s.evaluated_by,
        t.full_name AS evaluator_name,
        s.created_at,
        s.updated_at
      FROM tbl_assignment_submissions s
      LEFT JOIN tbl_assignments a
        ON a.assignment_id = s.assignment_id
      LEFT JOIN tbl_students st
        ON st.student_id = s.student_id
      LEFT JOIN tbl_teachers t
        ON t.teacher_id = s.evaluated_by
      WHERE s.submission_id = $1
      LIMIT 1
      `,
      [Number(submission_id)]
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Submission with ID ${submission_id} not found`
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Assignment submission fetched successfully",
      result.rows[0]
    );
  } catch (error) {
    console.error("getAssignmentSubmissionById error:", {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });

    const message =
      process.env.NODE_ENV === "development"
        ? error.message
        : "Failed to fetch assignment submission";

    return sendErrorResponse(res, 500, message);
  }
};

export const updateAssignmentSubmission = async (req, res) => {
  try {
    const { submission_id } = req.params;

    if (!isValidId(submission_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid submission ID is required"
      );
    }

    const {
      submission_text,
      file_url,
      marks_obtained,
      teacher_feedback,
      status,
      evaluated_by,
    } = req.body;

    const existingResult = await pool.query(
      `
      SELECT submission_id
      FROM tbl_assignment_submissions
      WHERE submission_id = $1
      LIMIT 1
      `,
      [Number(submission_id)]
    );

    if (existingResult.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Submission with ID ${submission_id} not found`
      );
    }

    const fields = [];
    const values = [];

    if (submission_text !== undefined) {
      values.push(submission_text || null);
      fields.push(`submission_text = $${values.length}`);
    }

    if (file_url !== undefined) {
      values.push(file_url || null);
      fields.push(`file_url = $${values.length}`);
    }

    if (marks_obtained !== undefined) {
      values.push(
        marks_obtained === null || marks_obtained === ""
          ? null
          : Number(marks_obtained)
      );
      fields.push(`marks_obtained = $${values.length}`);
    }

    if (teacher_feedback !== undefined) {
      values.push(teacher_feedback || null);
      fields.push(`teacher_feedback = $${values.length}`);
    }

    if (status !== undefined) {
      values.push(status);
      fields.push(`status = $${values.length}`);
    }

    if (evaluated_by !== undefined) {
      values.push(
        evaluated_by === null || evaluated_by === ""
          ? null
          : Number(evaluated_by)
      );
      fields.push(`evaluated_by = $${values.length}`);
      fields.push(`evaluated_at = CURRENT_TIMESTAMP`);
    }

    if (fields.length === 0) {
      return sendErrorResponse(
        res,
        400,
        "No fields provided for update"
      );
    }

    values.push(Number(submission_id));

    const result = await pool.query(
      `
      UPDATE tbl_assignment_submissions
      SET
        ${fields.join(", ")},
        updated_at = CURRENT_TIMESTAMP
      WHERE submission_id = $${values.length}
      RETURNING
        submission_id,
        assignment_id,
        student_id,
        submitted_at,
        submission_text,
        file_url,
        marks_obtained,
        teacher_feedback,
        status,
        evaluated_at,
        evaluated_by,
        created_at,
        updated_at
      `,
      values
    );

    return sendSuccessResponse(
      res,
      200,
      "Assignment submission updated successfully",
      result.rows[0]
    );
  } catch (error) {
    console.error("updateAssignmentSubmission error:", {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });

    if (error.code === "23503") {
      return sendErrorResponse(
        res,
        400,
        "Invalid submission reference"
      );
    }

    if (error.code === "23514") {
      return sendErrorResponse(
        res,
        400,
        "Invalid submission data"
      );
    }

    const message =
      process.env.NODE_ENV === "development"
        ? error.message
        : "Failed to update assignment submission";

    return sendErrorResponse(res, 500, message);
  }
};

export const deleteAssignmentSubmission = async (req, res) => {
  try {
    const { submission_id } = req.params;

    if (!isValidId(submission_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid submission ID is required"
      );
    }

    const result = await pool.query(
      `
      DELETE FROM tbl_assignment_submissions
      WHERE submission_id = $1
      RETURNING submission_id
      `,
      [Number(submission_id)]
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Submission with ID ${submission_id} not found`
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Assignment submission deleted successfully"
    );
  } catch (error) {
    console.error("deleteAssignmentSubmission error:", {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });

    const message =
      process.env.NODE_ENV === "development"
        ? error.message
        : "Failed to delete assignment submission";

    return sendErrorResponse(res, 500, message);
  }
};