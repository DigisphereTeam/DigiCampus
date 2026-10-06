import pool from "../config/database.js";

import {
  sendErrorResponse,
  sendSuccessResponse,
} from "../utils/response.js";

import { isValidId } from "../utils/validation.js";

export const createBook = async (req, res) => {
  const {
    title,
    author,
    category,
    total_copies,
  } = req.body;

  try {
    const existingBook = await pool.query(
      `
      SELECT book_id
      FROM tbl_library_books
      WHERE LOWER(TRIM(title)) = LOWER(TRIM($1))
        AND LOWER(TRIM(author)) = LOWER(TRIM($2))
      `,
      [
        title,
        author,
      ]
    );

    if (existingBook.rows.length > 0) {
      return sendErrorResponse(
        res,
        409,
        "Book with the same title and author already exists."
      );
    }

    const currentYear = new Date().getFullYear();

    const bookCodeResult = await pool.query(
      `
      SELECT COALESCE(
        MAX(
          CAST(
            SUBSTRING(book_code FROM 7)
            AS INTEGER
          )
        ),
        0
      ) + 1 AS next_number
      FROM tbl_library_books
      WHERE book_code LIKE $1
      `,
      [`BK${currentYear}%`]
    );

    const nextNumber = bookCodeResult.rows[0].next_number;

    const bookCode = `BK${currentYear}${String(nextNumber).padStart(4, "0")}`;

    const result = await pool.query(
      `
      INSERT INTO tbl_library_books
      (
        book_code,
        title,
        author,
        category,
        total_copies,
        available_copies
      )
      VALUES ($1, $2, $3, $4, $5, $5)
      RETURNING
        book_id,
        book_code,
        title,
        author,
        category,
        total_copies,
        available_copies,
        (total_copies - available_copies) AS issued_copies,
        is_active,
        created_at,
        updated_at
      `,
      [
        bookCode,
        title,
        author,
        category,
        total_copies,
      ]
    );

    return sendSuccessResponse(
      res,
      201,
      "Book created successfully.",
      result.rows[0]
    );
  } catch (error) {
    console.error("Create Book Error:", error);

    return sendErrorResponse(
      res,
      500,
      process.env.NODE_ENV === "development"
        ? error.message
        : "Internal server error"
    );
  }
};

export const getAllBooks = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      is_active,
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

    const conditions = [];
    const values = [];

    if (
      search !== undefined &&
      search !== null
    ) {
      if (typeof search !== "string") {
        return sendErrorResponse(
          res,
          400,
          "Invalid search"
        );
      }

      const cleanSearch = search.trim();

      if (cleanSearch) {
        values.push(`%${cleanSearch}%`);

        conditions.push(`
          (
            b.book_code ILIKE $${values.length}
            OR b.title ILIKE $${values.length}
            OR b.author ILIKE $${values.length}
            OR b.category ILIKE $${values.length}
          )
        `);
      }
    }

    if (
      status !== undefined &&
      status !== null
    ) {
      if (typeof status !== "string") {
        return sendErrorResponse(
          res,
          400,
          "Invalid book status"
        );
      }

      const normalizedStatus = status
        .trim()
        .toUpperCase();

      if (
        !["IN_STOCK", "OUT_OF_STOCK"].includes(
          normalizedStatus
        )
      ) {
        return sendErrorResponse(
          res,
          400,
          "Invalid book status"
        );
      }

      if (normalizedStatus === "IN_STOCK") {
        conditions.push(
          "b.available_copies > 0"
        );
      }

      if (normalizedStatus === "OUT_OF_STOCK") {
        conditions.push(
          "b.available_copies = 0"
        );
      }
    }

    if (
      is_active !== undefined &&
      is_active !== null
    ) {
      if (
        is_active !== "true" &&
        is_active !== "false"
      ) {
        return sendErrorResponse(
          res,
          400,
          "Invalid active status"
        );
      }

      values.push(is_active === "true");

      conditions.push(
        `b.is_active = $${values.length}`
      );
    }

    const whereClause =
      conditions.length > 0
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

    const countResult = await pool.query(
      `
      SELECT COUNT(*) AS total
      FROM tbl_library_books b
      ${whereClause}
      `,
      values
    );

    const total = Number(
      countResult.rows[0].total
    );

    const statisticsResult = await pool.query(
      `
      SELECT
        COUNT(*) AS total_books,
        COALESCE(
          SUM(b.total_copies),
          0
        ) AS total_copies,
        COALESCE(
          SUM(b.available_copies),
          0
        ) AS available_copies,
        COALESCE(
          SUM(
            b.total_copies - b.available_copies
          ),
          0
        ) AS issued_copies,
        COUNT(*) FILTER (
          WHERE b.available_copies > 0
        ) AS in_stock_books,
        COUNT(*) FILTER (
          WHERE b.available_copies = 0
        ) AS out_of_stock_books
      FROM tbl_library_books b
      ${whereClause}
      `,
      values
    );

    const statistics = statisticsResult.rows[0];

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
        CASE
          WHEN b.available_copies > 0
            THEN 'IN_STOCK'
          ELSE 'OUT_OF_STOCK'
        END AS status,
        b.is_active,
        b.created_at,
        b.updated_at
      FROM tbl_library_books b
      ${whereClause}
      ORDER BY b.book_id DESC
      LIMIT $${limitIndex}
      OFFSET $${offsetIndex}
      `,
      dataValues
    );

    return sendSuccessResponse(
      res,
      200,
      "Books fetched successfully",
      {
        statistics: {
          total_books: Number(
            statistics.total_books
          ),
          total_copies: Number(
            statistics.total_copies
          ),
          available_copies: Number(
            statistics.available_copies
          ),
          issued_copies: Number(
            statistics.issued_copies
          ),
          in_stock_books: Number(
            statistics.in_stock_books
          ),
          out_of_stock_books: Number(
            statistics.out_of_stock_books
          ),
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
        books: result.rows,
      }
    );
  } catch (error) {
    console.error(
      "Get all books error:",
      error
    );

    return sendErrorResponse(
      res,
      500,
      "Failed to fetch books"
    );
  }
};

export const getBookById = async (req, res) => {
  try {
    const { book_id } = req.params;

    if (!isValidId(book_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid book ID is required"
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
        CASE
          WHEN b.available_copies > 0
            THEN 'IN_STOCK'
          ELSE 'OUT_OF_STOCK'
        END AS status,
        b.is_active,
        b.created_at,
        b.updated_at
      FROM tbl_library_books b
      WHERE b.book_id = $1
      LIMIT 1
      `,
      [Number(book_id)]
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Book with ID ${book_id} not found`
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Book fetched successfully",
      result.rows[0]
    );
  } catch (error) {
    console.error(
      "Get book by ID error:",
      error
    );

    return sendErrorResponse(
      res,
      500,
      "Failed to fetch book"
    );
  }
};

export const updateBook = async (req, res) => {
  try {
    const { book_id } = req.params;

    if (!isValidId(book_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid book ID is required"
      );
    }

    const {
      title,
      author,
      category,
      total_copies,
      available_copies,
      is_active,
    } = req.body;

    const existingBook = await pool.query(
      `
      SELECT
        book_id,
        title,
        author
      FROM tbl_library_books
      WHERE book_id = $1
      `,
      [Number(book_id)]
    );

    if (existingBook.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Book with ID ${book_id} not found`
      );
    }

    if (
      title !== undefined ||
      author !== undefined
    ) {
      const duplicateTitle = title !== undefined
        ? title
        : existingBook.rows[0].title;

      const duplicateAuthor = author !== undefined
        ? author
        : existingBook.rows[0].author;

      const duplicateBook = await pool.query(
        `
        SELECT book_id
        FROM tbl_library_books
        WHERE LOWER(TRIM(title)) = LOWER(TRIM($1))
          AND LOWER(TRIM(author)) = LOWER(TRIM($2))
          AND book_id <> $3
        LIMIT 1
        `,
        [
          duplicateTitle,
          duplicateAuthor,
          Number(book_id),
        ]
      );

      if (duplicateBook.rows.length > 0) {
        return sendErrorResponse(
          res,
          409,
          "Book with the same title and author already exists."
        );
      }
    }

    const fields = [];
    const values = [];

    const updates = {
      title,
      author,
      category,
      total_copies,
      available_copies,
      is_active,
    };

    Object.entries(updates).forEach(
      ([field, value]) => {
        if (value !== undefined) {
          fields.push(
            `${field} = $${values.length + 1}`
          );

          values.push(
            typeof value === "string"
              ? value.trim()
              : value
          );
        }
      }
    );

    if (fields.length === 0) {
      return sendErrorResponse(
        res,
        400,
        "No fields provided for update"
      );
    }

    fields.push(
      "updated_at = CURRENT_TIMESTAMP"
    );

    values.push(Number(book_id));

    const result = await pool.query(
      `
      UPDATE tbl_library_books
      SET ${fields.join(", ")}
      WHERE book_id = $${values.length}
      RETURNING
        book_id,
        book_code,
        title,
        author,
        category,
        total_copies,
        available_copies,
        (
          total_copies - available_copies
        ) AS issued_copies,
        CASE
          WHEN available_copies > 0
            THEN 'IN_STOCK'
          ELSE 'OUT_OF_STOCK'
        END AS status,
        is_active,
        created_at,
        updated_at
      `,
      values
    );

    return sendSuccessResponse(
      res,
      200,
      "Book updated successfully",
      result.rows[0]
    );
  } catch (error) {
    console.error(
      "Update Book Error:",
      error
    );

    if (error.code === "23505") {
      return sendErrorResponse(
        res,
        409,
        "A book with the same title and author already exists"
      );
    }

    return sendErrorResponse(
      res,
      500,
      process.env.NODE_ENV === "development"
        ? error.message
        : "Internal server error"
    );
  }
};

export const deleteBook = async (req, res) => {
  try {
    const { book_id } = req.params;

    if (!isValidId(book_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid book ID is required"
      );
    }

    const result = await pool.query(
      `
      DELETE FROM tbl_library_books
      WHERE book_id = $1
      RETURNING
        book_id,
        book_code,
        title,
        author,
        category,
        total_copies,
        available_copies,
        is_active,
        created_at,
        updated_at
      `,
      [Number(book_id)]
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Book with ID ${book_id} not found`
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Book deleted successfully",
      result.rows[0]
    );
  } catch (error) {
    console.error(
      "Delete Book Error:",
      error
    );

    return sendErrorResponse(
      res,
      500,
      process.env.NODE_ENV === "development"
        ? error.message
        : "Internal server error"
    );
  }
};