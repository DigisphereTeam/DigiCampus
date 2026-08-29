import pool from "../config/database.js";
import {
  sendSuccessResponse,
  sendErrorResponse,
} from "../utils/response.js";

export const issueBook = async (req, res) => {
  const {
    book_id,
    student_id,
    issue_date,
    due_date,
    remarks,
  } = req.body;

  if (
    !book_id ||
    !student_id ||
    !due_date
  ) {
    return sendErrorResponse(
      res,
      400,
      "Book ID, student ID and due date are required."
    );
  }

  if (
    isNaN(book_id) ||
    Number(book_id) <= 0 ||
    isNaN(student_id) ||
    Number(student_id) <= 0
  ) {
    return sendErrorResponse(
      res,
      400,
      "Valid book ID and student ID are required."
    );
  }

  try {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const bookResult = await client.query(
        `
        SELECT *
        FROM tbl_library_books
        WHERE book_id = $1
        AND is_active = TRUE
        FOR UPDATE
        `,
        [book_id]
      );

      if (bookResult.rowCount === 0) {
        await client.query("ROLLBACK");

        return sendErrorResponse(
          res,
          404,
          "Book not found or inactive."
        );
      }

      const book = bookResult.rows[0];

      if (book.available_copies <= 0) {
        await client.query("ROLLBACK");

        return sendErrorResponse(
          res,
          400,
          "No copies of this book are currently available."
        );
      }

      const studentResult = await client.query(
        `
        SELECT student_id
        FROM tbl_students
        WHERE student_id = $1
        AND is_active = TRUE
        `,
        [student_id]
      );

      if (studentResult.rowCount === 0) {
        await client.query("ROLLBACK");

        return sendErrorResponse(
          res,
          404,
          "Student not found or inactive."
        );
      }

      const existingTransaction = await client.query(
        `
        SELECT transaction_id
        FROM tbl_library_transactions
        WHERE book_id = $1
        AND student_id = $2
        AND status IN ('ISSUED', 'OVERDUE')
        LIMIT 1
        `,
        [book_id, student_id]
      );

      if (existingTransaction.rowCount > 0) {
        await client.query("ROLLBACK");

        return sendErrorResponse(
          res,
          409,
          "This book is already issued to this student."
        );
      }

      const transactionResult = await client.query(
        `
        INSERT INTO tbl_library_transactions
        (
          book_id,
          student_id,
          issue_date,
          due_date,
          status,
          remarks
        )
        VALUES
        (
          $1,
          $2,
          COALESCE($3::date, CURRENT_DATE),
          $4,
          'ISSUED',
          $5
        )
        RETURNING *;
        `,
        [
          book_id,
          student_id,
          issue_date || null,
          due_date,
          remarks?.trim() || null,
        ]
      );

      await client.query(
        `
        UPDATE tbl_library_books
        SET
          available_copies = available_copies - 1,
          updated_at = CURRENT_TIMESTAMP
        WHERE book_id = $1
        `,
        [book_id]
      );

      await client.query("COMMIT");

      return sendSuccessResponse(
        res,
        201,
        "Book issued successfully.",
        transactionResult.rows[0]
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
      error.message || "Failed to issue book."
    );
  }
};

export const returnBook = async (req, res) => {
  const { transaction_id } = req.params;

  if (
    !transaction_id ||
    isNaN(transaction_id) ||
    Number(transaction_id) <= 0
  ) {
    return sendErrorResponse(
      res,
      400,
      "Valid transaction ID is required."
    );
  }

  const {
    return_date,
    remarks,
  } = req.body;

  try {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const transactionResult = await client.query(
        `
        SELECT *
        FROM tbl_library_transactions
        WHERE transaction_id = $1
        FOR UPDATE
        `,
        [transaction_id]
      );

      if (transactionResult.rowCount === 0) {
        await client.query("ROLLBACK");

        return sendErrorResponse(
          res,
          404,
          "Library transaction not found."
        );
      }

      const transaction =
        transactionResult.rows[0];

      if (transaction.status === "RETURNED") {
        await client.query("ROLLBACK");

        return sendErrorResponse(
          res,
          409,
          "This book has already been returned."
        );
      }

      await client.query(
        `
        UPDATE tbl_library_transactions
        SET
          return_date =
            COALESCE($1::date, CURRENT_DATE),
          status = 'RETURNED',
          remarks = COALESCE($2, remarks),
          updated_at = CURRENT_TIMESTAMP
        WHERE transaction_id = $3
        `,
        [
          return_date || null,
          remarks?.trim() || null,
          transaction_id,
        ]
      );

      await client.query(
        `
        UPDATE tbl_library_books
        SET
          available_copies =
            LEAST(
              available_copies + 1,
              total_copies
            ),
          updated_at = CURRENT_TIMESTAMP
        WHERE book_id = $1
        `,
        [transaction.book_id]
      );

      const updatedTransaction =
        await client.query(
          `
          SELECT *
          FROM tbl_library_transactions
          WHERE transaction_id = $1
          `,
          [transaction_id]
        );

      await client.query("COMMIT");

      return sendSuccessResponse(
        res,
        200,
        "Book returned successfully.",
        updatedTransaction.rows[0]
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
      error.message || "Failed to return book."
    );
  }
};

export const getAllTransactions = async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        t.transaction_id,

        b.book_id,
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
        t.transaction_id DESC;
      `
    );

    return sendSuccessResponse(
      res,
      200,
      "Library transactions fetched successfully.",
      result.rows
    );
  } catch (error) {
    console.error(
      "Get All Transactions Error:",
      error
    );

    return sendErrorResponse(
      res,
      500,
      error.message ||
        "Failed to fetch library transactions."
    );
  }
};

export const getTransactionById = async (req, res) => {
  const { transaction_id } = req.params;

  if (
    !transaction_id ||
    isNaN(transaction_id) ||
    Number(transaction_id) <= 0
  ) {
    return sendErrorResponse(
      res,
      400,
      "Valid transaction ID is required."
    );
  }

  try {
    const result = await pool.query(
      `
      SELECT
        t.transaction_id,

        b.book_id,
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

      WHERE t.transaction_id = $1;
      `,
      [transaction_id]
    );

    if (result.rowCount === 0) {
      return sendErrorResponse(
        res,
        404,
        "Library transaction not found."
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Library transaction fetched successfully.",
      result.rows[0]
    );
  } catch (error) {
    console.error(
      "Get Transaction By ID Error:",
      error
    );

    return sendErrorResponse(
      res,
      500,
      error.message ||
        "Failed to fetch library transaction."
    );
  }
};

export const deleteTransaction = async (req, res) => {
  const { transaction_id } = req.params;

  if (
    !transaction_id ||
    isNaN(transaction_id) ||
    Number(transaction_id) <= 0
  ) {
    return sendErrorResponse(
      res,
      400,
      "Valid transaction ID is required."
    );
  }

  try {
    const result = await pool.query(
      `
      DELETE FROM tbl_library_transactions
      WHERE transaction_id = $1
      RETURNING *;
      `,
      [transaction_id]
    );

    if (result.rowCount === 0) {
      return sendErrorResponse(
        res,
        404,
        "Library transaction not found."
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Library transaction deleted successfully.",
      result.rows[0]
    );
  } catch (error) {
    console.error(
      "Delete Transaction Error:",
      error
    );

    return sendErrorResponse(
      res,
      500,
      error.message ||
        "Failed to delete library transaction."
    );
  }
};

