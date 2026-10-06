import pool from "../config/database.js";

import {
  sendErrorResponse,
  sendSuccessResponse,
} from "../utils/response.js";

import { isValidId } from "../utils/validation.js";

const getGrade = (percentage) => {
  if (percentage >= 90) {
    return "A+";
  }

  if (percentage >= 80) {
    return "A";
  }

  if (percentage >= 70) {
    return "B+";
  }

  if (percentage >= 60) {
    return "B";
  }

  if (percentage >= 50) {
    return "C";
  }

  if (percentage >= 40) {
    return "D";
  }

  return "F";
};

export const getExamResults = async (req, res) => {
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
        exam_id,
        exam_name,
        exam_type,
        status
      FROM tbl_exams
      WHERE exam_id = $1
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

    const result = await pool.query(
      `
      SELECT
        em.student_id,
        s.admission_number,
        u.name AS student_name,
        cs.class_section_id,
        c.class_name,
        sec.section_name,
        SUM(em.marks)::numeric AS obtained_marks,
        SUM(es.max_marks)::numeric AS total_marks,
        ROUND(
          (
            SUM(em.marks) * 100.0
          ) / NULLIF(SUM(es.max_marks), 0),
          2
        ) AS percentage,
        COUNT(*) FILTER (
          WHERE em.marks < es.passing_marks
        ) AS failed_subjects
      FROM tbl_exam_marks em
      INNER JOIN tbl_exam_schedules es
        ON es.exam_schedule_id = em.exam_schedule_id
      INNER JOIN tbl_students s
        ON s.student_id = em.student_id
      INNER JOIN tbl_users u
        ON u.user_id = s.user_id
      INNER JOIN tbl_class_sections cs
        ON cs.class_section_id = es.class_section_id
      INNER JOIN tbl_classes c
        ON c.class_id = cs.class_id
      INNER JOIN tbl_sections sec
        ON sec.section_id = cs.section_id
      WHERE es.exam_id = $1
      GROUP BY
        em.student_id,
        s.admission_number,
        u.name,
        cs.class_section_id,
        c.class_name,
        sec.section_name
      ORDER BY
        c.class_name,
        sec.section_name,
        u.name
      `,
      [exam_id]
    );

    const rows = [];

    for (const item of result.rows) {
      const percentage = Number(item.percentage);

      rows.push({
        student_id: item.student_id,
        admission_number: item.admission_number,
        student_name: item.student_name,
        class_section_id: item.class_section_id,
        class_name: item.class_name,
        section_name: item.section_name,
        obtained_marks: Number(item.obtained_marks),
        total_marks: Number(item.total_marks),
        percentage,
        grade: getGrade(percentage),
        result_status:
          Number(item.failed_subjects) > 0
            ? "FAIL"
            : "PASS",
      });
    }

    return sendSuccessResponse(
      res,
      200,
      "Exam results fetched successfully",
      {
        exam: examResult.rows[0],
        results: rows,
      }
    );
  } catch (error) {
    console.error("Get exam results error:", error);

    return sendErrorResponse(
      res,
      500,
      "Failed to fetch exam results"
    );
  }
};

export const getStudentResult = async (req, res) => {
  try {
    const { exam_id, student_id } = req.params;

    if (!isValidId(exam_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid exam ID is required"
      );
    }

    if (!isValidId(student_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid student ID is required"
      );
    }

    const result = await pool.query(
      `
      SELECT
        em.student_id,
        s.admission_number,
        u.name AS student_name,
        c.class_name,
        sec.section_name,
        sub.subject_name,
        es.max_marks,
        es.passing_marks,
        em.marks,
        CASE
          WHEN em.marks >= es.passing_marks THEN 'PASS'
          ELSE 'FAIL'
        END AS subject_status
      FROM tbl_exam_marks em
      INNER JOIN tbl_exam_schedules es
        ON es.exam_schedule_id = em.exam_schedule_id
      INNER JOIN tbl_students s
        ON s.student_id = em.student_id
      INNER JOIN tbl_users u
        ON u.user_id = s.user_id
      INNER JOIN tbl_subjects sub
        ON sub.subject_id = es.subject_id
      INNER JOIN tbl_class_sections cs
        ON cs.class_section_id = es.class_section_id
      INNER JOIN tbl_classes c
        ON c.class_id = cs.class_id
      INNER JOIN tbl_sections sec
        ON sec.section_id = cs.section_id
      WHERE es.exam_id = $1
        AND em.student_id = $2
      ORDER BY sub.subject_name
      `,
      [exam_id, student_id]
    );

    if (result.rowCount === 0) {
      return sendErrorResponse(
        res,
        404,
        "Student result not found"
      );
    }

    let obtainedMarks = 0;
    let totalMarks = 0;
    let failedSubjects = 0;

    for (const item of result.rows) {
      obtainedMarks += Number(item.marks);
      totalMarks += Number(item.max_marks);

      if (item.subject_status === "FAIL") {
        failedSubjects++;
      }
    }

    const percentage =
      totalMarks > 0
        ? Number(
          ((obtainedMarks * 100) / totalMarks).toFixed(2)
        )
        : 0;

    const overallStatus =
      failedSubjects > 0 ? "FAIL" : "PASS";

    return sendSuccessResponse(
      res,
      200,
      "Student result fetched successfully",
      {
        student: {
          student_id: result.rows[0].student_id,
          admission_number: result.rows[0].admission_number,
          student_name: result.rows[0].student_name,
          class_name: result.rows[0].class_name,
          section_name: result.rows[0].section_name,
        },
        subjects: result.rows,
        summary: {
          obtained_marks: obtainedMarks,
          total_marks: totalMarks,
          percentage,
          grade: getGrade(percentage),
          result_status: overallStatus,
          failed_subjects: failedSubjects,
        },
      }
    );
  } catch (error) {
    console.error("Get student result error:", error);

    return sendErrorResponse(
      res,
      500,
      "Failed to fetch student result"
    );
  }
};

export const getMyResults = async (req, res) => {
  try {
    const { user_id } = req.user;

    const studentResult = await pool.query(
      `
      SELECT
        student_id,
        full_name AS student_name,
      FROM tbl_students
      WHERE user_id = $1
        AND is_active = true
      `,
      [user_id]
    );

    if (studentResult.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        "Student profile not found"
      );
    }

    const student = studentResult.rows[0];

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
      [student.student_id]
    );

    return sendSuccessResponse(
      res,
      200,
      "My results fetched successfully",
      {
        student,
        results: result.rows,
      }
    );
  } catch (error) {
    console.error(
      "Get My Results Error:",
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

export const getClassSectionExamMarks = async (req, res) => {
  try {
    const { exam_id, class_id, section_id } = req.params;

    if (!isValidId(exam_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid exam ID is required"
      );
    }

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

    const examResult = await pool.query(
      `
      SELECT
        e.exam_id,
        e.exam_name,
        e.exam_type,
        e.status AS exam_status,
        e.academic_year_id,
        ay.academic_year,
        cs.class_section_id,
        c.class_name,
        s.section_name
      FROM tbl_exams e
      INNER JOIN tbl_academic_years ay
        ON ay.academic_year_id = e.academic_year_id
      INNER JOIN tbl_class_sections cs
        ON cs.class_id = $2
        AND cs.section_id = $3
      INNER JOIN tbl_classes c
        ON c.class_id = cs.class_id
      INNER JOIN tbl_sections s
        ON s.section_id = cs.section_id
      WHERE e.exam_id = $1
        AND EXISTS (
          SELECT 1
          FROM tbl_exam_results er
          WHERE er.exam_id = e.exam_id
            AND er.class_section_id = cs.class_section_id
        )
      LIMIT 1
      `,
      [
        Number(exam_id),
        Number(class_id),
        Number(section_id),
      ]
    );

    if (examResult.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        "Exam or class section not found"
      );
    }

    const exam = examResult.rows[0];
    const classSectionId = exam.class_section_id;

    const studentsResult = await pool.query(
      `
      SELECT
        st.student_id,
        st.admission_number,
        u.full_name AS student_name
      FROM tbl_students st
      INNER JOIN tbl_users u
        ON u.user_id = st.user_id
      INNER JOIN tbl_student_class_sections scs
        ON scs.student_id = st.student_id
      WHERE scs.class_section_id = $1
        AND scs.academic_year_id = $2
        AND scs.is_active = TRUE
        AND st.is_active = TRUE
      ORDER BY u.full_name ASC
      `,
      [
        classSectionId,
        exam.academic_year_id,
      ]
    );

    const marksResult = await pool.query(
      `
      SELECT
        er.student_id,
        er.subject_id,
        sub.subject_name,
        er.marks_obtained
      FROM tbl_exam_results er
      INNER JOIN tbl_subjects sub
        ON sub.subject_id = er.subject_id
      WHERE er.exam_id = $1
        AND er.class_section_id = $2
      ORDER BY sub.subject_name ASC
      `,
      [
        Number(exam_id),
        classSectionId,
      ]
    );

    const studentMarks = [];


    for (const student of studentsResult.rows) {
      const subjects = [];
      let totalMarks = 0;
      let hasMarks = false;

      for (const mark of marksResult.rows) {
        if (Number(mark.student_id) !== Number(student.student_id)) {
          continue;
        }

        const marksObtained =
          mark.marks_obtained !== null
            ? Number(mark.marks_obtained)
            : null;

        if (marksObtained !== null) {
          hasMarks = true;
          totalMarks += marksObtained;
        }

        subjects.push({
          subject_id: mark.subject_id,
          subject_name: mark.subject_name,
          marks_obtained: marksObtained,
        });
      }

      studentMarks.push({
        student_id: student.student_id,
        student_name: student.student_name,
        admission_number: student.admission_number,
        subjects,
        total_marks: hasMarks ? totalMarks : 0,
        result: hasMarks ? "MARKS_ENTERED" : "NO_MARKS",
      });
    }

    return sendSuccessResponse(
      res,
      200,
      "Class section exam marks fetched successfully",
      {
        exam: {
          exam_id: exam.exam_id,
          exam_name: exam.exam_name,
          exam_type: exam.exam_type,
          exam_status: exam.exam_status,
          academic_year_id: exam.academic_year_id,
          academic_year: exam.academic_year,
          class_section_id: exam.class_section_id,
          class_id: Number(class_id),
          section_id: Number(section_id),
          class_name: exam.class_name,
          section_name: exam.section_name,
        },
        students: studentMarks,
      }
    );
  } catch (error) {
    console.error("getClassSectionExamMarks error:", {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });

    const message =
      process.env.NODE_ENV === "development"
        ? error.message
        : "Failed to fetch class section exam marks";

    return sendErrorResponse(res, 500, message);
  }
};

export const getMyExamResult = async (req, res) => {
  try {
    const { exam_id } = req.params;
    const { user_id } = req.user;

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
        full_name AS student_name,
      FROM tbl_students
      WHERE user_id = $1
        AND is_active = true
      `,
      [user_id]
    );

    if (studentResult.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        "Student profile not found"
      );
    }

    const student = studentResult.rows[0];

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
      [
        student.student_id,
        exam_id,
      ]
    );

    return sendSuccessResponse(
      res,
      200,
      "Exam result fetched successfully",
      {
        student,
        exam: examResult.rows[0],
        results: result.rows,
      }
    );
  } catch (error) {
    console.error(
      "Get My Exam Result Error:",
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
        full_name AS student_name,
        admission_number
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
      ORDER BY
        e.start_date DESC,
        s.subject_name ASC
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