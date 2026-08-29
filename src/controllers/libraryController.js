import pool from "../config/database.js";

import {
  sendSuccessResponse,
  sendErrorResponse,
} from "../utils/response.js";

export const createBook = async (req, res) => {
  const {
    title,
    author,
    category,
    total_copies,
    available_copies,
  } = req.body;

  if (!title || !author || total_copies == null) {
    return sendErrorResponse(
      res,
      400,
      "Title, author and total copies are required."
    );
  }

  if (Number(total_copies) < 1) {
    return sendErrorResponse(
      res,
      400,
      "Total copies must be at least 1."
    );
  }

  const availableCopies =
    available_copies == null
      ? Number(total_copies)
      : Number(available_copies);

  if (availableCopies < 0) {
    return sendErrorResponse(
      res,
      400,
      "Available copies cannot be negative."
    );
  }

  if (availableCopies > Number(total_copies)) {
    return sendErrorResponse(
      res,
      400,
      "Available copies cannot be greater than total copies."
    );
  }

  try {
    const result = await pool.query(
      `
      INSERT INTO tbl_library_books
      (
        title,
        author,
        category,
        total_copies,
        available_copies
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
      `,
      [
        title.trim(),
        author.trim(),
        category?.trim() || null,
        Number(total_copies),
        availableCopies,
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
      error.message || "Failed to create book."
    );
  }
};

export const getAllBooks = async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT *
      FROM tbl_library_books
      ORDER BY book_id DESC;
      `
    );

    return sendSuccessResponse(
      res,
      200,
      "Books fetched successfully.",
      result.rows
    );
  } catch (error) {
    console.error("Get All Books Error:", error);

    return sendErrorResponse(
      res,
      500,
      error.message || "Failed to fetch books."
    );
  }
};

export const getBookById = async (req, res) => {
  const { book_id } = req.params;

  if (
    !book_id ||
    isNaN(book_id) ||
    Number(book_id) <= 0
  ) {
    return sendErrorResponse(
      res,
      400,
      "Valid book ID is required."
    );
  }

  try {
    const result = await pool.query(
      `
      SELECT *
      FROM tbl_library_books
      WHERE book_id = $1;
      `,
      [book_id]
    );

    if (result.rowCount === 0) {
      return sendErrorResponse(
        res,
        404,
        "Book not found."
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Book fetched successfully.",
      result.rows[0]
    );
  } catch (error) {
    console.error("Get Book By ID Error:", error);

    return sendErrorResponse(
      res,
      500,
      error.message || "Failed to fetch book."
    );
  }
};

export const updateBook = async (req, res) => {
  const { book_id } = req.params;

  if (
    !book_id ||
    isNaN(book_id) ||
    Number(book_id) <= 0
  ) {
    return sendErrorResponse(
      res,
      400,
      "Valid book ID is required."
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

  if (
    title === undefined &&
    author === undefined &&
    category === undefined &&
    total_copies === undefined &&
    available_copies === undefined &&
    is_active === undefined
  ) {
    return sendErrorResponse(
      res,
      400,
      "At least one field is required to update."
    );
  }

  try {
    const existingBook = await pool.query(
      `
      SELECT *
      FROM tbl_library_books
      WHERE book_id = $1;
      `,
      [book_id]
    );

    if (existingBook.rowCount === 0) {
      return sendErrorResponse(
        res,
        404,
        "Book not found."
      );
    }

    const currentBook = existingBook.rows[0];

    const newTotalCopies =
      total_copies !== undefined
        ? Number(total_copies)
        : currentBook.total_copies;

    const newAvailableCopies =
      available_copies !== undefined
        ? Number(available_copies)
        : currentBook.available_copies;

    if (newTotalCopies < 1) {
      return sendErrorResponse(
        res,
        400,
        "Total copies must be at least 1."
      );
    }

    if (newAvailableCopies < 0) {
      return sendErrorResponse(
        res,
        400,
        "Available copies cannot be negative."
      );
    }

    if (newAvailableCopies > newTotalCopies) {
      return sendErrorResponse(
        res,
        400,
        "Available copies cannot be greater than total copies."
      );
    }

    const result = await pool.query(
      `
      UPDATE tbl_library_books
      SET
        title = COALESCE($1, title),
        author = COALESCE($2, author),
        category = COALESCE($3, category),
        total_copies = $4,
        available_copies = $5,
        is_active = COALESCE($6, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE book_id = $7
      RETURNING *;
      `,
      [
        title?.trim() || null,
        author?.trim() || null,
        category?.trim() || null,
        newTotalCopies,
        newAvailableCopies,
        is_active ?? null,
        book_id,
      ]
    );

    return sendSuccessResponse(
      res,
      200,
      "Book updated successfully.",
      result.rows[0]
    );
  } catch (error) {
    console.error("Update Book Error:", error);

    return sendErrorResponse(
      res,
      500,
      error.message || "Failed to update book."
    );
  }
};

export const deleteBook = async (req, res) => {
  const { book_id } = req.params;

  if (
    !book_id ||
    isNaN(book_id) ||
    Number(book_id) <= 0
  ) {
    return sendErrorResponse(
      res,
      400,
      "Valid book ID is required."
    );
  }

  try {
    const result = await pool.query(
      `
      DELETE FROM tbl_library_books
      WHERE book_id = $1
      RETURNING *;
      `,
      [book_id]
    );

    if (result.rowCount === 0) {
      return sendErrorResponse(
        res,
        404,
        "Book not found."
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Book deleted successfully.",
      result.rows[0]
    );
  } catch (error) {
    console.error("Delete Book Error:", error);

    return sendErrorResponse(
      res,
      500,
      error.message || "Failed to delete book."
    );
  }
};