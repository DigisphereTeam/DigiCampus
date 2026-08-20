import pool from "../config/database.js";

export const createParent = async (req, res) => {
  const {
    full_name,
    phone,
    email,
    occupation,
    address,
  } = req.body;

  try {
    if (!full_name || !phone) {
      return sendErrorResponse(
        res,
        400,
        "Full name and phone are required."
      );
    }

    if (!/^[6-9]\d{9}$/.test(phone)) {
      return sendErrorResponse(
        res,
        400,
        "Invalid phone number."
      );
    }

    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      return sendErrorResponse(
        res,
        400,
        "Invalid email address."
      );
    }

    const existingParent = await pool.query(
      `
      SELECT parent_id
      FROM tbl_parents
      WHERE phone = $1
      OR ($2::text IS NOT NULL AND LOWER(email) = LOWER($2))
      LIMIT 1
      `,
      [phone.trim(), email?.trim() || null]
    );

    if (existingParent.rowCount > 0) {
      return sendErrorResponse(
        res,
        409,
        "Parent with the given phone or email already exists."
      );
    }

    const result = await pool.query(
      `
      INSERT INTO tbl_parents
      (
        full_name,
        phone,
        email,
        occupation,
        address
      )
      VALUES
      ($1, $2, $3, $4, $5)
      RETURNING *
      `,
      [
        full_name.trim(),
        phone.trim(),
        email?.trim().toLowerCase() || null,
        occupation?.trim() || null,
        address?.trim() || null,
      ]
    );

    return sendSuccessResponse(
      res,
      201,
      "Parent created successfully.",
      result.rows[0]
    );

  } catch (error) {
    console.error("Create Parent Error:", error);

    return sendErrorResponse(
      res,
      500,
      error.message || "Internal Server Error"
    );
  }
};


export const getAllParents = async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        parent_id,
        user_id,
        full_name,
        phone,
        email,
        occupation,
        address,
        created_at,
        updated_at
      FROM tbl_parents
      ORDER BY parent_id DESC
      `
    );

    return sendSuccessResponse(
      res,
      200,
      "Parents fetched successfully.",
      result.rows
    );

  } catch (error) {
    console.error("Get All Parents Error:", error);

    return sendErrorResponse(
      res,
      500,
      error.message || "Internal Server Error"
    );
  }
};

export const getParentById = async (req, res) => {
  const { parent_id } = req.params;

  try {
    if (!parent_id || isNaN(parent_id) || Number(parent_id) <= 0) {
      return sendErrorResponse(
        res,
        400,
        "Valid parent ID is required."
      );
    }

    const result = await pool.query(
      `
      SELECT
        parent_id,
        user_id,
        full_name,
        phone,
        email,
        occupation,
        address,
        created_at,
        updated_at
      FROM tbl_parents
      WHERE parent_id = $1
      `,
      [parent_id]
    );

    if (result.rowCount === 0) {
      return sendErrorResponse(
        res,
        404,
        "Parent not found."
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Parent fetched successfully.",
      result.rows[0]
    );

  } catch (error) {
    console.error("Get Parent By ID Error:", error);

    return sendErrorResponse(
      res,
      500,
      error.message || "Internal Server Error"
    );
  }
};


export const updateParent = async (req, res) => {
  const { parent_id } = req.params;

  const {
    full_name,
    phone,
    email,
    occupation,
    address,
  } = req.body;

  try {
    if (!parent_id || isNaN(parent_id) || Number(parent_id) <= 0) {
      return sendErrorResponse(
        res,
        400,
        "Valid parent ID is required."
      );
    }

    if (!full_name || !phone) {
      return sendErrorResponse(
        res,
        400,
        "Full name and phone are required."
      );
    }

    if (!/^[6-9]\d{9}$/.test(phone)) {
      return sendErrorResponse(
        res,
        400,
        "Invalid phone number."
      );
    }

    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      return sendErrorResponse(
        res,
        400,
        "Invalid email address."
      );
    }

    const existingParent = await pool.query(
      `
      SELECT parent_id
      FROM tbl_parents
      WHERE
        (phone = $1 OR
        ($2::text IS NOT NULL AND LOWER(email) = LOWER($2)))
        AND parent_id <> $3
      LIMIT 1
      `,
      [
        phone.trim(),
        email?.trim() || null,
        parent_id,
      ]
    );

    if (existingParent.rowCount > 0) {
      return sendErrorResponse(
        res,
        409,
        "Another parent with the given phone or email already exists."
      );
    }

    const result = await pool.query(
      `
      UPDATE tbl_parents
      SET
        full_name = $1,
        phone = $2,
        email = $3,
        occupation = $4,
        address = $5,
        updated_at = CURRENT_TIMESTAMP
      WHERE parent_id = $6
      RETURNING *
      `,
      [
        full_name.trim(),
        phone.trim(),
        email?.trim().toLowerCase() || null,
        occupation?.trim() || null,
        address?.trim() || null,
        parent_id,
      ]
    );

    if (result.rowCount === 0) {
      return sendErrorResponse(
        res,
        404,
        "Parent not found."
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Parent updated successfully.",
      result.rows[0]
    );

  } catch (error) {
    console.error("Update Parent Error:", error);

    return sendErrorResponse(
      res,
      500,
      error.message || "Internal Server Error"
    );
  }
};


export const deleteParent = async (req, res) => {
  const { parent_id } = req.params;

  try {
    if (!parent_id || isNaN(parent_id) || Number(parent_id) <= 0) {
      return sendErrorResponse(
        res,
        400,
        "Valid parent ID is required."
      );
    }

    const result = await pool.query(
      `
      DELETE FROM tbl_parents
      WHERE parent_id = $1
      RETURNING *
      `,
      [parent_id]
    );

    if (result.rowCount === 0) {
      return sendErrorResponse(
        res,
        404,
        "Parent not found."
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Parent deleted successfully.",
      result.rows[0]
    );

  } catch (error) {
    console.error("Delete Parent Error:", error);

    return sendErrorResponse(
      res,
      500,
      error.message || "Internal Server Error"
    );
  }
};