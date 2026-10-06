import pool from "../config/database";

const QUESTION_TYPES = ["MCQ"];

export const createQuestion = async (req, res) => {
  try {
    const userId = req.user?.user_id;

    if (!userId) {
      return sendErrorResponse(res, 401, "Unauthorized");
    }

    const { assignment_id } = req.params;

    const {
      question_text,
      question_type = "MCQ",
      marks,
      options,
      correct_option_index
    } = req.body || {};

    const errors = {};

    if (
      !assignment_id ||
      !/^\d+$/.test(assignment_id.toString())
    ) {
      errors.assignment_id = "Invalid assignment_id";
    }

    if (
      !question_text ||
      !question_text.toString().trim()
    ) {
      errors.question_text = "Question is required";
    }

    if (!QUESTION_TYPES.includes(question_type)) {
      errors.question_type = "Invalid question type";
    }

    if (
      marks === undefined ||
      marks === null ||
      isNaN(Number(marks)) ||
      Number(marks) <= 0
    ) {
      errors.marks = "Marks must be greater than 0";
    }

    if (!Array.isArray(options) || options.length < 2) {
      errors.options = "At least two options are required";
    }


    if (
      correct_option_index === undefined ||
      correct_option_index === null ||
      !Number.isInteger(Number(correct_option_index))
    ) {
      errors.correct_option_index =
        "Correct option index is required";
    }

    if (
      Array.isArray(options) &&
      Number.isInteger(Number(correct_option_index)) &&
      (
        Number(correct_option_index) < 0 ||
        Number(correct_option_index) >= options.length
      )
    ) {
      errors.correct_option_index =
        "Invalid correct option index";
    }

    if (Array.isArray(options)) {
      const invalidOption = options.some(
        option =>
          !option ||
          !option.toString().trim()
      );

      if (invalidOption) {
        errors.options =
          "All options must contain valid text";
      }
    }

    if (Object.keys(errors).length > 0) {
      return sendErrorResponse(
        res,
        400,
        "Validation failed",
        errors
      );
    }

    const teacherResult = await pool.query(
      `
      SELECT employee_id
      FROM tbl_employees
      WHERE user_id = $1
        AND employee_type = 'TEACHER'
      LIMIT 1
      `,
      [userId]
    );

    if (teacherResult.rows.length === 0) {
      return sendErrorResponse(
        res,
        403,
        "Only teachers can create questions"
      );
    }

    const teacherId = teacherResult.rows[0].employee_id;

    const assignmentResult = await pool.query(
      `
      SELECT
        assignment_id,
        teacher_id,
        status
      FROM tbl_assignments
      WHERE assignment_id = $1
      LIMIT 1
      `,
      [assignment_id]
    );

    if (assignmentResult.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        "Assignment not found"
      );
    }

    const assignment = assignmentResult.rows[0];

    if (
      Number(assignment.teacher_id) !==
      Number(teacherId)
    ) {
      return sendErrorResponse(
        res,
        403,
        "You can add questions only to your own assignments"
      );
    }

    if (
      ["CLOSED", "CANCELLED"].includes(
        assignment.status
      )
    ) {
      return sendErrorResponse(
        res,
        400,
        "Questions cannot be added to closed or cancelled assignments"
      );
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const questionResult = await client.query(
        `
        INSERT INTO tbl_assignment_questions (
          assignment_id,
          question_text,
          question_type,
          marks
        )
        VALUES ($1, $2, $3, $4)
        RETURNING
          question_id,
          assignment_id,
          question_text,
          question_type,
          marks,
          created_at,
          updated_at
        `,
        [
          assignment_id,
          question_text.toString().trim(),
          question_type,
          Number(marks)
        ]
      );

      const question = questionResult.rows[0];

      const createdOptions = [];

      for (let index = 0; index < options.length; index++) {
        const optionResult = await client.query(
          `
          INSERT INTO tbl_assignment_question_options (
            question_id,
            option_text,
            is_correct
          )
          VALUES ($1, $2, $3)
          RETURNING
            option_id,
            question_id,
            option_text
          `,
          [
            question.question_id,
            options[index].toString().trim(),
            index === Number(correct_option_index)
          ]
        );

        createdOptions.push(optionResult.rows[0]);
      }

      await client.query("COMMIT");

      return sendSuccessResponse(
        res,
        201,
        "MCQ question created successfully",
        {
          ...question,
          options: createdOptions
        }
      );
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("createQuestion error:", error);

    return sendErrorResponse(
      res,
      500,
      "Internal server error"
    );
  }
};

export const getAssignmentQuestions = async (req, res) => {
  try {
    const { assignment_id } = req.params;

    if (
      !assignment_id ||
      !/^\d+$/.test(assignment_id.toString())
    ) {
      return sendErrorResponse(
        res,
        400,
        "Invalid assignment_id"
      );
    }

    const assignmentResult = await pool.query(
      `
      SELECT assignment_id
      FROM tbl_assignments
      WHERE assignment_id = $1
      LIMIT 1
      `,
      [assignment_id]
    );

    if (assignmentResult.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        "Assignment not found"
      );
    }

    const result = await pool.query(
      `
      SELECT
        q.question_id,
        q.assignment_id,
        q.question_text,
        q.question_type,
        q.marks,
        q.created_at,
        q.updated_at,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'option_id',
              o.option_id,
              'option_text',
              o.option_text
            )
            ORDER BY o.option_id
          )
          FILTER (WHERE o.option_id IS NOT NULL),
          '[]'
        ) AS options
      FROM tbl_assignment_questions q
      LEFT JOIN tbl_assignment_question_options o
        ON o.question_id = q.question_id
      WHERE q.assignment_id = $1
      GROUP BY q.question_id
      ORDER BY q.question_id ASC
      `,
      [assignment_id]
    );

    return sendSuccessResponse(
      res,
      200,
      "Assignment questions fetched successfully",
      result.rows
    );
  } catch (error) {
    console.error(
      "getAssignmentQuestions error:",
      error
    );

    return sendErrorResponse(
      res,
      500,
      "Internal server error"
    );
  }
};

export const getQuestionById = async (req, res) => {
  try {
    const { question_id } = req.params;

    if (
      !question_id ||
      !/^\d+$/.test(question_id.toString())
    ) {
      return sendErrorResponse(
        res,
        400,
        "Invalid question_id"
      );
    }

    const result = await pool.query(
      `
      SELECT
        q.question_id,
        q.assignment_id,
        q.question_text,
        q.question_type,
        q.marks,
        q.created_at,
        q.updated_at,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'option_id',
              o.option_id,
              'option_text',
              o.option_text
            )
            ORDER BY o.option_id
          )
          FILTER (WHERE o.option_id IS NOT NULL),
          '[]'
        ) AS options
      FROM tbl_assignment_questions q
      LEFT JOIN tbl_assignment_question_options o
        ON o.question_id = q.question_id
      WHERE q.question_id = $1
      GROUP BY q.question_id
      `,
      [question_id]
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        "Question not found"
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Question fetched successfully",
      result.rows[0]
    );
  } catch (error) {
    console.error(
      "getQuestionById error:",
      error
    );

    return sendErrorResponse(
      res,
      500,
      "Internal server error"
    );
  }
};

export const updateQuestion = async (req, res) => {
  try {
    const userId = req.user?.user_id;

    if (!userId) {
      return sendErrorResponse(
        res,
        401,
        "Unauthorized"
      );
    }

    const { question_id } = req.params;

    if (
      !question_id ||
      !/^\d+$/.test(question_id.toString())
    ) {
      return sendErrorResponse(
        res,
        400,
        "Invalid question_id"
      );
    }

    const {
      question_text,
      marks,
      options,
      correct_option_index
    } = req.body || {};

    const teacherResult = await pool.query(
      `
      SELECT employee_id
      FROM tbl_employees
      WHERE user_id = $1
        AND employee_type = 'TEACHER'
      LIMIT 1
      `,
      [userId]
    );

    if (teacherResult.rows.length === 0) {
      return sendErrorResponse(
        res,
        403,
        "Only teachers can update questions"
      );
    }

    const teacherId = teacherResult.rows[0].employee_id;

    const questionResult = await pool.query(
      `
      SELECT
        q.*,
        a.teacher_id,
        a.status
      FROM tbl_assignment_questions q
      INNER JOIN tbl_assignments a
        ON a.assignment_id = q.assignment_id
      WHERE q.question_id = $1
      LIMIT 1
      `,
      [question_id]
    );

    if (questionResult.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        "Question not found"
      );
    }

    const question = questionResult.rows[0];

    if (
      Number(question.teacher_id) !==
      Number(teacherId)
    ) {
      return sendErrorResponse(
        res,
        403,
        "You can update only your own questions"
      );
    }

    if (
      ["CLOSED", "CANCELLED"].includes(
        question.status
      )
    ) {
      return sendErrorResponse(
        res,
        400,
        "Questions cannot be updated after assignment is closed or cancelled"
      );
    }

    if (
      question_text !== undefined &&
      !question_text.toString().trim()
    ) {
      return sendErrorResponse(
        res,
        400,
        "Question is required"
      );
    }

    if (
      marks !== undefined &&
      (
        isNaN(Number(marks)) ||
        Number(marks) <= 0
      )
    ) {
      return sendErrorResponse(
        res,
        400,
        "Marks must be greater than 0"
      );
    }

    if (options !== undefined) {
      if (
        !Array.isArray(options) ||
        options.length < 2
      ) {
        return sendErrorResponse(
          res,
          400,
          "At least two options are required"
        );
      }

      if (
        options.some(
          option =>
            !option ||
            !option.toString().trim()
        )
      ) {
        return sendErrorResponse(
          res,
          400,
          "All options must contain valid text"
        );
      }

      if (
        correct_option_index === undefined ||
        correct_option_index === null ||
        !Number.isInteger(
          Number(correct_option_index)
        )
      ) {
        return sendErrorResponse(
          res,
          400,
          "Correct option index is required"
        );
      }

      if (
        Number(correct_option_index) < 0 ||
        Number(correct_option_index) >= options.length
      ) {
        return sendErrorResponse(
          res,
          400,
          "Invalid correct option index"
        );
      }
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      await client.query(
        `
        UPDATE tbl_assignment_questions
        SET
          question_text = $1,
          marks = $2,
          updated_at = CURRENT_TIMESTAMP
        WHERE question_id = $3
        `,
        [
          question_text !== undefined
            ? question_text.toString().trim()
            : question.question_text,
          marks !== undefined
            ? Number(marks)
            : question.marks,
          question_id
        ]
      );

      if (options !== undefined) {
        await client.query(
          `
          DELETE FROM tbl_assignment_question_options
          WHERE question_id = $1
          `,
          [question_id]
        );

        for (let index = 0; index < options.length; index++) {
          await client.query(
            `
            INSERT INTO tbl_assignment_question_options (
              question_id,
              option_text,
              is_correct
            )
            VALUES ($1, $2, $3)
            `,
            [
              question_id,
              options[index].toString().trim(),
              index === Number(correct_option_index)
            ]
          );
        }
      }

      await client.query("COMMIT");

      const finalResult = await pool.query(
        `
        SELECT
          q.question_id,
          q.assignment_id,
          q.question_text,
          q.question_type,
          q.marks,
          q.created_at,
          q.updated_at,
          COALESCE(
            JSON_AGG(
              JSON_BUILD_OBJECT(
                'option_id',
                o.option_id,
                'option_text',
                o.option_text
              )
              ORDER BY o.option_id
            )
            FILTER (WHERE o.option_id IS NOT NULL),
            '[]'
          ) AS options
        FROM tbl_assignment_questions q
        LEFT JOIN tbl_assignment_question_options o
          ON o.question_id = q.question_id
        WHERE q.question_id = $1
        GROUP BY q.question_id
        `,
        [question_id]
      );

      return sendSuccessResponse(
        res,
        200,
        "Question updated successfully",
        finalResult.rows[0]
      );
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error(
      "updateQuestion error:",
      error
    );

    return sendErrorResponse(
      res,
      500,
      "Internal server error"
    );
  }
};

export const deleteQuestion = async (req, res) => {
  try {
    const userId = req.user?.user_id;

    if (!userId) {
      return sendErrorResponse(
        res,
        401,
        "Unauthorized"
      );
    }

    const { question_id } = req.params;

    if (
      !question_id ||
      !/^\d+$/.test(question_id.toString())
    ) {
      return sendErrorResponse(
        res,
        400,
        "Invalid question_id"
      );
    }

    const teacherResult = await pool.query(
      `
      SELECT employee_id
      FROM tbl_employees
      WHERE user_id = $1
        AND employee_type = 'TEACHER'
      LIMIT 1
      `,
      [userId]
    );

    if (teacherResult.rows.length === 0) {
      return sendErrorResponse(
        res,
        403,
        "Only teachers can delete questions"
      );
    }

    const teacherId = teacherResult.rows[0].employee_id;

    const questionResult = await pool.query(
      `
      SELECT
        q.question_id,
        a.teacher_id,
        a.status
      FROM tbl_assignment_questions q
      INNER JOIN tbl_assignments a
        ON a.assignment_id = q.assignment_id
      WHERE q.question_id = $1
      LIMIT 1
      `,
      [question_id]
    );

    if (questionResult.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        "Question not found"
      );
    }

    const question = questionResult.rows[0];

    if (
      Number(question.teacher_id) !==
      Number(teacherId)
    ) {
      return sendErrorResponse(
        res,
        403,
        "You can delete only your own questions"
      );
    }

    if (
      ["CLOSED", "CANCELLED"].includes(
        question.status
      )
    ) {
      return sendErrorResponse(
        res,
        400,
        "Questions cannot be deleted after assignment is closed or cancelled"
      );
    }

    await pool.query(
      `
      DELETE FROM tbl_assignment_questions
      WHERE question_id = $1
      `,
      [question_id]
    );

    return sendSuccessResponse(
      res,
      200,
      "Question deleted successfully"
    );
  } catch (error) {
    console.error(
      "deleteQuestion error:",
      error
    );

    return sendErrorResponse(
      res,
      500,
      "Internal server error"
    );
  }
};
