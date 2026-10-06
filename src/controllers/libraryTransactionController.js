import pool from "../config/database.js";
import { getCurrentDate } from "../utils/date.js";

import {
  sendErrorResponse,
  sendSuccessResponse,
} from "../utils/response.js";

import { isValidId } from "../utils/validation.js";

export const issueBook = async (req, res) => {
  try {
    const {
      book_id,
      student_id,
      issue_date,
      due_date,
      remarks,
    } = req.body;

    const appliedIssueDate =
      issue_date || getCurrentDate();

    const bookId = Number(book_id);
    const studentId = Number(student_id);

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const bookResult = await client.query(
        `
        SELECT
          book_id,
          book_code,
          title,
          available_copies
        FROM tbl_library_books
        WHERE book_id = $1
          AND is_active = TRUE
        FOR UPDATE
        `,
        [bookId],
      );

      if (bookResult.rows.length === 0) {
        await client.query("ROLLBACK");

        return sendErrorResponse(
          res,
          404,
          `Book with ID ${book_id} not found`,
        );
      }

      const book = bookResult.rows[0];

      if (book.available_copies <= 0) {
        await client.query("ROLLBACK");

        return sendErrorResponse(
          res,
          400,
          "No copies of this book are currently available",
        );
      }

      const studentResult = await client.query(
        `
        SELECT
          student_id
        FROM tbl_students
        WHERE student_id = $1
          AND is_active = TRUE
        `,
        [studentId],
      );

      if (studentResult.rows.length === 0) {
        await client.query("ROLLBACK");

        return sendErrorResponse(
          res,
          404,
          `Student with ID ${student_id} not found`,
        );
      }

      const existingTransaction =
        await client.query(
          `
          SELECT
            transaction_id
          FROM tbl_library_transactions
          WHERE book_id = $1
            AND student_id = $2
            AND status IN ('ISSUED', 'OVERDUE')
          LIMIT 1
          `,
          [
            bookId,
            studentId,
          ],
        );

      if (existingTransaction.rows.length > 0) {
        await client.query("ROLLBACK");

        return sendErrorResponse(
          res,
          409,
          "This book is already issued to this student",
        );
      }

      const transactionResult =
        await client.query(
          `
          INSERT INTO tbl_library_transactions (
            book_id,
            student_id,
            issue_date,
            due_date,
            status,
            remarks
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            'ISSUED',
            $5
          )
          RETURNING
            transaction_id,
            book_id,
            student_id,
            issue_date,
            due_date,
            return_date,
            status,
            remarks,
            created_at,
            updated_at
          `,
          [
            bookId,
            studentId,
            appliedIssueDate,
            due_date,
            remarks || null,
          ],
        );

      await client.query(
        `
        UPDATE tbl_library_books
        SET
          available_copies = available_copies - 1,
          updated_at = CURRENT_TIMESTAMP
        WHERE book_id = $1
        `,
        [bookId],
      );

      await client.query("COMMIT");

      return sendSuccessResponse(
        res,
        201,
        "Book issued successfully",
        {
          ...transactionResult.rows[0],
          book_code: book.book_code,
          title: book.title,
        },
      );
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Issue Book Error:", error);

    return sendErrorResponse(
      res,
      500,
      process.env.NODE_ENV === "development"
        ? error.message
        : "Internal server error",
    );
  }
};

export const getBookHistory = async (req, res) => {
  try {
    const { book_id } = req.params;

    if (!isValidId(book_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid book ID is required",
      );
    }

    const result = await pool.query(
      `
      SELECT
        b.book_id,
        b.book_code,
        b.title,
        b.author,
        b.category,
        b.total_copies,
        b.available_copies,
        (
          b.total_copies - b.available_copies
        ) AS issued_copies,
        b.is_active,
        b.created_at,
        b.updated_at,

        COUNT(t.transaction_id) AS total_transactions,
        COUNT(DISTINCT t.student_id) AS total_students,

        COUNT(*) FILTER (
          WHERE t.status = 'ISSUED'
        ) AS currently_issued,

        COUNT(*) FILTER (
          WHERE t.status = 'RETURNED'
        ) AS returned,

        COUNT(*) FILTER (
          WHERE t.status = 'OVERDUE'
        ) AS overdue,

        COALESCE(
          json_agg(
            json_build_object(
              'transaction_id', t.transaction_id,
              'student_id', s.student_id,
              'admission_number', s.admission_number,
              'student_name', s.full_name,
              'issue_date', t.issue_date,
              'due_date', t.due_date,
              'return_date', t.return_date,
              'status', t.status,
              'remarks', t.remarks,
              'created_at', t.created_at,
              'updated_at', t.updated_at
            )
            ORDER BY t.transaction_id DESC
          ) FILTER (
            WHERE t.transaction_id IS NOT NULL
          ),
          '[]'::json
        ) AS history

      FROM tbl_library_books b

      LEFT JOIN tbl_library_transactions t
        ON t.book_id = b.book_id

      LEFT JOIN tbl_students s
        ON s.student_id = t.student_id

      WHERE b.book_id = $1

      GROUP BY
        b.book_id,
        b.book_code,
        b.title,
        b.author,
        b.category,
        b.total_copies,
        b.available_copies,
        b.is_active,
        b.created_at,
        b.updated_at
      `,
      [Number(book_id)],
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Book with ID ${book_id} not found`,
      );
    }

    const data = result.rows[0];

    return sendSuccessResponse(
      res,
      200,
      "Book transaction history fetched successfully",
      {
        book: {
          book_id: data.book_id,
          book_code: data.book_code,
          title: data.title,
          author: data.author,
          category: data.category,
          total_copies: data.total_copies,
          available_copies: data.available_copies,
          issued_copies: data.issued_copies,
          is_active: data.is_active,
          created_at: data.created_at,
          updated_at: data.updated_at,
        },

        statistics: {
          total_transactions:
            Number(data.total_transactions),

          total_students:
            Number(data.total_students),

          currently_issued:
            Number(data.currently_issued),

          returned:
            Number(data.returned),

          overdue:
            Number(data.overdue),
        },

        history: data.history,
      },
    );
  } catch (error) {
    console.error(
      "Get Book History Error:",
      error,
    );

    return sendErrorResponse(
      res,
      500,
      process.env.NODE_ENV === "development"
        ? error.message
        : "Internal server error",
    );
  }
};

export const getBookStudentHistory = async (req, res, next) => {
  try {
    const {
      book_id,
      student_id,
    } = req.params;

    if (!isValidId(book_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid book ID is required"
      );
    }

    if (!isValidId(student_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid student ID is required"
      );
    }

    const bookId = Number(book_id);
    const studentId = Number(student_id);

    const result = await pool.query(
      `
        SELECT
          b.book_id,
          b.book_code,
          b.title,
          b.author,
          b.category,

          s.student_id,
          s.admission_number,
          s.full_name,

          COUNT(t.transaction_id)::INTEGER AS total_times_taken,

          COUNT(t.transaction_id) FILTER (
            WHERE t.status = 'ISSUED'
          )::INTEGER AS currently_issued,

          COUNT(t.transaction_id) FILTER (
            WHERE t.status = 'RETURNED'
          )::INTEGER AS returned,

          COUNT(t.transaction_id) FILTER (
            WHERE t.status = 'OVERDUE'
          )::INTEGER AS overdue,

          COALESCE(
            json_agg(
              json_build_object(
                'transaction_id', t.transaction_id,
                'issue_date', t.issue_date,
                'due_date', t.due_date,
                'return_date', t.return_date,
                'status', t.status,
                'remarks', t.remarks,
                'created_at', t.created_at,
                'updated_at', t.updated_at
              )
              ORDER BY t.transaction_id DESC
            ) FILTER (
              WHERE t.transaction_id IS NOT NULL
            ),
            '[]'::json
          ) AS history

        FROM tbl_library_books b

        CROSS JOIN tbl_students s

        LEFT JOIN tbl_library_transactions t
          ON t.book_id = b.book_id
          AND t.student_id = s.student_id

        WHERE b.book_id = $1
        AND s.student_id = $2

        GROUP BY
          b.book_id,
          b.book_code,
          b.title,
          b.author,
          b.category,
          s.student_id,
          s.admission_number,
          s.full_name
      `,
      [
        bookId,
        studentId,
      ]
    );

    if (result.rows.length === 0) {
      const bookResult = await pool.query(
        `
          SELECT book_id
          FROM tbl_library_books
          WHERE book_id = $1
          LIMIT 1
        `,
        [bookId]
      );

      if (bookResult.rows.length === 0) {
        return sendErrorResponse(
          res,
          404,
          `Book with ID ${bookId} not found`
        );
      }

      const studentResult = await pool.query(
        `
          SELECT student_id
          FROM tbl_students
          WHERE student_id = $1
          LIMIT 1
        `,
        [studentId]
      );

      if (studentResult.rows.length === 0) {
        return sendErrorResponse(
          res,
          404,
          `Student with ID ${studentId} not found`
        );
      }

      return sendSuccessResponse(
        res,
        200,
        "Book student history fetched successfully",
        {
          book: {
            book_id: bookId,
          },
          student: {
            student_id: studentId,
          },
          statistics: {
            total_times_taken: 0,
            currently_issued: 0,
            returned: 0,
            overdue: 0,
          },
          history: [],
        }
      );
    }

    const data = result.rows[0];

    return sendSuccessResponse(
      res,
      200,
      "Book student history fetched successfully",
      {
        book: {
          book_id: data.book_id,
          book_code: data.book_code,
          title: data.title,
          author: data.author,
          category: data.category,
        },

        student: {
          student_id: data.student_id,
          admission_number: data.admission_number,
          full_name: data.full_name,
        },

        statistics: {
          total_times_taken:
            Number(data.total_times_taken),

          currently_issued:
            Number(data.currently_issued),

          returned:
            Number(data.returned),

          overdue:
            Number(data.overdue),
        },

        history: data.history,
      }
    );
  } catch (error) {
    console.error(
      "Get Student Book History Error:",
      error,
    );

    return sendErrorResponse(
      res,
      500,
      process.env.NODE_ENV === "development"
        ? error.message
        : "Internal server error",
    );
  }
};

export const getStudentBookHistory = async (req, res) => {
  try {
    const { student_id } = req.params;

    if (!isValidId(student_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid student ID is required",
      );
    }

    const result = await pool.query(
      `
      SELECT
        s.student_id,
        s.admission_number,
        s.full_name,
        s.email,
        s.phone_number,
        s.gender,
        s.is_active,

        COUNT(t.transaction_id) AS total_transactions,

        COUNT(DISTINCT t.book_id) AS total_books,

        COUNT(*) FILTER (
          WHERE t.status = 'ISSUED'
        ) AS currently_issued,

        COUNT(*) FILTER (
          WHERE t.status = 'RETURNED'
        ) AS returned,

        COUNT(*) FILTER (
          WHERE t.status = 'OVERDUE'
        ) AS overdue,

        COALESCE(
          json_agg(
            json_build_object(
              'transaction_id', t.transaction_id,
              'book_id', b.book_id,
              'book_code', b.book_code,
              'title', b.title,
              'author', b.author,
              'category', b.category,
              'issue_date', t.issue_date,
              'due_date', t.due_date,
              'return_date', t.return_date,
              'status', t.status,
              'remarks', t.remarks,
              'created_at', t.created_at,
              'updated_at', t.updated_at
            )
            ORDER BY t.transaction_id DESC
          ) FILTER (
            WHERE t.transaction_id IS NOT NULL
          ),
          '[]'::json
        ) AS history

      FROM tbl_students s

      LEFT JOIN tbl_library_transactions t
        ON t.student_id = s.student_id

      LEFT JOIN tbl_library_books b
        ON b.book_id = t.book_id

      WHERE s.student_id = $1

      GROUP BY
        s.student_id,
        s.admission_number,
        s.full_name,
        s.email,
        s.phone_number,
        s.gender,
        s.is_active
      `,
      [Number(student_id)],
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Student with ID ${student_id} not found`,
      );
    }

    const data = result.rows[0];

    return sendSuccessResponse(
      res,
      200,
      "Student book history fetched successfully",
      {
        student: {
          student_id: data.student_id,
          admission_number: data.admission_number,
          full_name: data.full_name,
          email: data.email,
          phone: data.phone_number,
          gender: data.gender,
          is_active: data.is_active,
        },

        statistics: {
          total_transactions:
            Number(data.total_transactions),

          total_books:
            Number(data.total_books),

          currently_issued:
            Number(data.currently_issued),

          returned:
            Number(data.returned),

          overdue:
            Number(data.overdue),
        },

        history: data.history,
      },
    );
  } catch (error) {
    console.error(
      "Get Student Book History Error:",
      error,
    );

    return sendErrorResponse(
      res,
      500,
      process.env.NODE_ENV === "development"
        ? error.message
        : "Internal server error",
    );
  }
};

export const returnBook = async (req, res) => {
  try {
    const { transaction_id } = req.params;

    if (!isValidId(transaction_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid transaction ID is required",
      );
    }

    const {
      return_date,
      remarks,
    } = req.body;

    const transactionId = Number(transaction_id);

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const transactionResult =
        await client.query(
          `
          SELECT
            transaction_id,
            book_id,
            student_id,
            issue_date,
            due_date,
            return_date,
            status,
            remarks
          FROM tbl_library_transactions
          WHERE transaction_id = $1
          FOR UPDATE
          `,
          [transactionId],
        );

      if (transactionResult.rows.length === 0) {
        await client.query("ROLLBACK");

        return sendErrorResponse(
          res,
          404,
          `Library transaction with ID ${transaction_id} not found`,
        );
      }

      const transaction =
        transactionResult.rows[0];

      if (transaction.status === "RETURNED") {
        await client.query("ROLLBACK");

        return sendErrorResponse(
          res,
          409,
          "This book has already been returned",
        );
      }

      const bookResult = await client.query(
        `
        SELECT
          book_id,
          book_code,
          title
        FROM tbl_library_books
        WHERE book_id = $1
        FOR UPDATE
        `,
        [Number(transaction.book_id)],
      );

      if (bookResult.rows.length === 0) {
        await client.query("ROLLBACK");

        return sendErrorResponse(
          res,
          404,
          `Book with ID ${transaction.book_id} not found`,
        );
      }

      await client.query(
        `
        UPDATE tbl_library_transactions
        SET
          return_date = COALESCE(
            $1::date,
            CURRENT_DATE
          ),
          status = 'RETURNED',
          remarks = COALESCE($2, remarks),
          updated_at = CURRENT_TIMESTAMP
        WHERE transaction_id = $3
        `,
        [
          return_date || null,
          remarks || null,
          transactionId,
        ],
      );

      await client.query(
        `
        UPDATE tbl_library_books
        SET
          available_copies = LEAST(
            available_copies + 1,
            total_copies
          ),
          updated_at = CURRENT_TIMESTAMP
        WHERE book_id = $1
        `,
        [Number(transaction.book_id)],
      );

      const updatedTransaction =
        await client.query(
          `
          SELECT
            t.transaction_id,
            t.book_id,
            b.book_code,
            b.title,
            t.student_id,
            t.issue_date,
            t.due_date,
            t.return_date,
            t.status,
            t.remarks,
            t.created_at,
            t.updated_at
          FROM tbl_library_transactions t
          INNER JOIN tbl_library_books b
            ON b.book_id = t.book_id
          WHERE t.transaction_id = $1
          `,
          [transactionId],
        );

      await client.query("COMMIT");

      return sendSuccessResponse(
        res,
        200,
        "Book returned successfully",
        updatedTransaction.rows[0],
      );
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Return Book Error:", error);

    return sendErrorResponse(
      res,
      500,
      process.env.NODE_ENV === "development"
        ? error.message
        : "Internal server error",
    );
  }
};

export const getAllTransactions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
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
        "Invalid page",
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
        "Invalid limit. Maximum limit is 100",
      );
    }

    const countResult = await pool.query(
      `
      SELECT COUNT(*) AS total
      FROM tbl_library_transactions
      `,
    );

    const total =
      Number(countResult.rows[0].total);

    const offset =
      (pageNumber - 1) * limitNumber;

    const result = await pool.query(
      `
      SELECT
        t.transaction_id,

        b.book_id,
        b.book_code,
        b.title,
        b.author,
        b.category,

        s.student_id,
        s.admission_number,
        s.full_name AS student_name,

        t.issue_date,
        t.due_date,
        t.return_date,
        t.status,
        t.remarks,
        t.created_at,
        t.updated_at

      FROM tbl_library_transactions t

      INNER JOIN tbl_library_books b
        ON b.book_id = t.book_id

      INNER JOIN tbl_students s
        ON s.student_id = t.student_id

      ORDER BY
        t.transaction_id DESC

      LIMIT $1
      OFFSET $2
      `,
      [
        limitNumber,
        offset,
      ],
    );

    return sendSuccessResponse(
      res,
      200,
      "Library transactions fetched successfully",
      {
        filters: {
          page: pageNumber,
          limit: limitNumber,
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

          total_pages:
            Math.ceil(
              total / limitNumber,
            ),
        },

        transactions: result.rows,
      },
    );
  } catch (error) {
    console.error(
      "Get All Transactions Error:",
      error,
    );

    return sendErrorResponse(
      res,
      500,
      process.env.NODE_ENV === "development"
        ? error.message
        : "Internal server error",
    );
  }
};

export const getTransactionById = async (req, res) => {
  try {
    const { transaction_id } = req.params;

    if (!isValidId(transaction_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid transaction ID is required",
      );
    }

    const result = await pool.query(
      `
      SELECT
        t.transaction_id,

        b.book_id,
        b.book_code,
        b.title,
        b.author,
        b.category,

        s.student_id,
        s.admission_number,
        s.full_name AS student_name,

        t.issue_date,
        t.due_date,
        t.return_date,
        t.status,
        t.remarks,
        t.created_at,
        t.updated_at

      FROM tbl_library_transactions t

      INNER JOIN tbl_library_books b
        ON b.book_id = t.book_id

      INNER JOIN tbl_students s
        ON s.student_id = t.student_id

      WHERE t.transaction_id = $1
      `,
      [Number(transaction_id)],
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Library transaction with ID ${transaction_id} not found`,
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Library transaction fetched successfully",
      result.rows[0],
    );
  } catch (error) {
    console.error(
      "Get Transaction By ID Error:",
      error,
    );

    return sendErrorResponse(
      res,
      500,
      process.env.NODE_ENV === "development"
        ? error.message
        : "Internal server error",
    );
  }
};

export const deleteTransaction = async (req, res) => {
  try {
    const { transaction_id } = req.params;

    if (!isValidId(transaction_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid transaction ID is required",
      );
    }

    const result = await pool.query(
      `
      DELETE FROM tbl_library_transactions
      WHERE transaction_id = $1
      RETURNING
        transaction_id,
        book_id,
        student_id,
        issue_date,
        due_date,
        return_date,
        status,
        remarks,
        created_at,
        updated_at
      `,
      [Number(transaction_id)],
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Library transaction with ID ${transaction_id} not found`,
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Library transaction deleted successfully",
      result.rows[0],
    );
  } catch (error) {
    console.error(
      "Delete Transaction Error:",
      error,
    );

    return sendErrorResponse(
      res,
      500,
      process.env.NODE_ENV === "development"
        ? error.message
        : "Internal server error",
    );
  }
};