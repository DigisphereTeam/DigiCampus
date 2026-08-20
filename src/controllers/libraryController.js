import pool from "../config/db.js";

export const createBook = async (req, res) => {
  const {
    book_code,
    title,
    author,
    isbn,
    category,
    publisher,
    total_quantity,
    available_quantity,
    shelf_number,
  } = req.body;

  try {
    if (
      !book_code ||
      !title ||
      total_quantity == null ||
      available_quantity == null
    ) {
      return res.status(400).json({
        success: false,
        message: "Book code, title, total quantity and available quantity are required.",
      });
    }

    if (Number(total_quantity) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Total quantity must be greater than zero.",
      });
    }

    if (Number(available_quantity) < 0) {
      return res.status(400).json({
        success: false,
        message: "Available quantity cannot be negative.",
      });
    }

    if (Number(available_quantity) > Number(total_quantity)) {
      return res.status(400).json({
        success: false,
        message: "Available quantity cannot be greater than total quantity.",
      });
    }

    const existingBook = await pool.query(
      `
      SELECT book_id
      FROM tbl_library_books
      WHERE LOWER(book_code) = LOWER($1)
         OR ($2 IS NOT NULL AND isbn = $2)
      LIMIT 1
      `,
      [
        book_code.trim(),
        isbn?.trim() || null,
      ]
    );

    if (existingBook.rowCount > 0) {
      return res.status(409).json({
        success: false,
        message: "Book code or ISBN already exists.",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO tbl_library_books
      (
        book_code,
        title,
        author,
        isbn,
        category,
        publisher,
        total_quantity,
        available_quantity,
        shelf_number
      )
      VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *
      `,
      [
        book_code.trim(),
        title.trim(),
        author?.trim() || null,
        isbn?.trim() || null,
        category?.trim() || null,
        publisher?.trim() || null,
        Number(total_quantity),
        Number(available_quantity),
        shelf_number?.trim() || null,
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Book created successfully.",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Create Book Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};

export const getAllBooks = async (req, res) => {
  const { search, category, is_active } = req.query;

  try {
    let query = `
      SELECT
        book_id,
        book_code,
        title,
        author,
        isbn,
        category,
        publisher,
        total_quantity,
        available_quantity,
        shelf_number,
        is_active,
        created_at,
        updated_at
      FROM tbl_library_books
      WHERE 1=1
    `;

    const values = [];
    let index = 1;

    if (search) {
      query += `
        AND (
          title ILIKE $${index}
          OR book_code ILIKE $${index}
          OR author ILIKE $${index}
          OR isbn ILIKE $${index}
        )
      `;

      values.push(`%${search}%`);
      index++;
    }

    if (category) {
      query += `
        AND LOWER(category) = LOWER($${index})
      `;

      values.push(category.trim());
      index++;
    }

    if (is_active !== undefined) {
      query += `
        AND is_active = $${index}
      `;

      values.push(is_active === "true");
      index++;
    }

    query += `
      ORDER BY book_id DESC
    `;

    const result = await pool.query(query, values);

    return res.status(200).json({
      success: true,
      message: "Books fetched successfully.",
      data: result.rows,
    });
  } catch (error) {
    console.error("Get All Books Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};

export const getBookById = async (req, res) => {
  const { book_id } = req.params;

  try {
    if (!book_id || isNaN(book_id) || Number(book_id) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid book ID is required.",
      });
    }

    const result = await pool.query(
      `
      SELECT
        book_id,
        book_code,
        title,
        author,
        isbn,
        category,
        publisher,
        total_quantity,
        available_quantity,
        shelf_number,
        is_active,
        created_at,
        updated_at
      FROM tbl_library_books
      WHERE book_id = $1
      `,
      [book_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Book not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Book fetched successfully.",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Get Book By ID Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};

export const updateBook = async (req, res) => {
  const { book_id } = req.params;

  const {
    book_code,
    title,
    author,
    isbn,
    category,
    publisher,
    total_quantity,
    available_quantity,
    shelf_number,
  } = req.body;

  try {
    if (!book_id || isNaN(book_id) || Number(book_id) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid book ID is required.",
      });
    }

    if (!book_code || !title) {
      return res.status(400).json({
        success: false,
        message: "Book code and title are required.",
      });
    }

    if (total_quantity == null || available_quantity == null) {
      return res.status(400).json({
        success: false,
        message: "Total quantity and available quantity are required.",
      });
    }

    if (Number(total_quantity) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Total quantity must be greater than zero.",
      });
    }

    if (Number(available_quantity) < 0) {
      return res.status(400).json({
        success: false,
        message: "Available quantity cannot be negative.",
      });
    }

    if (Number(available_quantity) > Number(total_quantity)) {
      return res.status(400).json({
        success: false,
        message: "Available quantity cannot be greater than total quantity.",
      });
    }

    const bookResult = await pool.query(
      `
      SELECT book_id
      FROM tbl_library_books
      WHERE book_id = $1
      `,
      [book_id]
    );

    if (bookResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Book not found.",
      });
    }

    const duplicateBook = await pool.query(
      `
      SELECT book_id
      FROM tbl_library_books
      WHERE
        book_id != $1
        AND (
          LOWER(book_code) = LOWER($2)
          OR ($3 IS NOT NULL AND isbn = $3)
        )
      LIMIT 1
      `,
      [
        book_id,
        book_code.trim(),
        isbn?.trim() || null,
      ]
    );

    if (duplicateBook.rowCount > 0) {
      return res.status(409).json({
        success: false,
        message: "Book code or ISBN already exists.",
      });
    }

    const result = await pool.query(
      `
      UPDATE tbl_library_books
      SET
        book_code = $1,
        title = $2,
        author = $3,
        isbn = $4,
        category = $5,
        publisher = $6,
        total_quantity = $7,
        available_quantity = $8,
        shelf_number = $9,
        updated_at = CURRENT_TIMESTAMP
      WHERE book_id = $10
      RETURNING *
      `,
      [
        book_code.trim(),
        title.trim(),
        author?.trim() || null,
        isbn?.trim() || null,
        category?.trim() || null,
        publisher?.trim() || null,
        Number(total_quantity),
        Number(available_quantity),
        shelf_number?.trim() || null,
        book_id,
      ]
    );

    return res.status(200).json({
      success: true,
      message: "Book updated successfully.",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Update Book Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};

export const deleteBook = async (req, res) => {
  const { book_id } = req.params;

  try {
    if (!book_id || isNaN(book_id) || Number(book_id) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid book ID is required.",
      });
    }

    const result = await pool.query(
      `
      UPDATE tbl_library_books
      SET
        is_active = FALSE,
        updated_at = CURRENT_TIMESTAMP
      WHERE book_id = $1
      RETURNING *
      `,
      [book_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Book not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Book deleted successfully.",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Delete Book Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};