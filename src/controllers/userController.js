import bcrypt from "bcryptjs";
import pool from "../config/database.js";
import { allowedRoles } from "../constants/constants.js";
import { sendErrorResponse, sendSuccessResponse } from "../utils/response.js";
import { isValidId } from "../utils/validation.js";

export async function createUser(req, res) {
  const { full_name, email, password, role } = req.body || {};

  try {
    const existingUser = await pool.query(
      `
      SELECT user_id
      FROM tbl_users
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1
      `,
      [email],
    );

    if (existingUser.rows.length > 0) {
      return sendErrorResponse(res, 409, "User with this email already exists");
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `
      INSERT INTO tbl_users (
        full_name,
        email,
        password_hash,
        role
      )
      VALUES ($1, $2, $3, $4)
      RETURNING
        user_id,
        full_name,
        email,
        role,
        is_active,
        created_at,
        updated_at
      `,
      [full_name, email, passwordHash, role],
    );

    return sendSuccessResponse(
      res,
      201,
      "User created successfully",
      result.rows[0],
    );
  } catch (error) {
    console.error("Create user error:", error);

    return sendErrorResponse(res, 500, "Failed to create user");
  }
}

export async function getAllUsers(req, res) {
  const { role } = req.query;

  try {
    const values = [];
    let whereClause = "";

    if (role) {
      const userRole = role.toUpperCase();

      if (!allowedRoles.includes(userRole)) {
        return sendErrorResponse(res, 400, "Invalid user role");
      }

      values.push(userRole);
      whereClause = "WHERE role = $1";
    }

    const result = await pool.query(
      `
        SELECT
          user_id,
          full_name,
          email,
          role,
          is_active,
          created_at,
          updated_at
        FROM tbl_users
        ${whereClause}
        ORDER BY user_id DESC
      `,
      values,
    );

    return sendSuccessResponse(
      res,
      200,
      "Users fetched successfully",
      result.rows,
    );
  } catch (error) {
    console.error("Get users error:", error);

    return sendErrorResponse(res, 500, "Failed to fetch users");
  }
}

export async function getUserById(req, res) {
  const { user_id } = req.params;
  if (!isValidId(user_id)) {
    return sendErrorResponse(res, 400, "Valid user ID is required");
  }
  try {
    const result = await pool.query(
      `
        SELECT
          user_id,
          full_name,
          email,
          role,
          is_active,
          created_at,
          updated_at
        FROM tbl_users
        WHERE user_id = $1
      `,
      [user_id],
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `User with ID ${user_id} not found`
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "User fetched successfully",
      result.rows[0],
    );
  } catch (error) {
    console.error("Get user by ID error:", error);

    return sendErrorResponse(res, 500, error.message || "Failed to fetch user");
  }
}

export async function updateUser(req, res) {
  const { user_id } = req.params;

  try {
    if (!isValidId(user_id)) {
      return sendErrorResponse(res, 400, "Valid user ID is required");
    }

    const existingUser = await pool.query(
      `
        SELECT user_id
        FROM tbl_users
        WHERE user_id = $1
      `,
      [user_id],
    );

    if (existingUser.rows.length === 0) {
      return sendErrorResponse(res, 404, "User not found");
    }

    const { full_name, email, role, is_active } = req.body;

    const updates = [];
    const values = [];

    if (full_name !== undefined) {
      if (typeof full_name !== "string" || !full_name.trim()) {
        return sendErrorResponse(res, 400, "Full name cannot be empty");
      }

      const cleanName = full_name.trim();

      if (cleanName.length < 2) {
        return sendErrorResponse(
          res,
          400,
          "Full name must be at least 2 characters",
        );
      }

      values.push(cleanName);
      updates.push(`full_name = $${values.length}`);
    }

    if (email !== undefined) {
      if (typeof email !== "string" || !email.trim()) {
        return sendErrorResponse(res, 400, "Email cannot be empty");
      }

      const cleanEmail = email.trim().toLowerCase();

      if (!emailRegex.test(cleanEmail)) {
        return sendErrorResponse(res, 400, "Invalid email address");
      }

      const emailExists = await pool.query(
        `
          SELECT user_id
          FROM tbl_users
          WHERE LOWER(email) = LOWER($1)
          AND user_id != $2
          LIMIT 1
        `,
        [cleanEmail, user_id],
      );

      if (emailExists.rows.length > 0) {
        return sendErrorResponse(res, 409, "Email already exists");
      }

      values.push(cleanEmail);
      updates.push(`email = $${values.length}`);
    }

    if (role !== undefined) {
      if (typeof role !== "string" || !role.trim()) {
        return sendErrorResponse(res, 400, "Role cannot be empty");
      }

      const cleanRole = role.trim().toUpperCase();

      if (!allowedRoles.includes(cleanRole)) {
        return sendErrorResponse(res, 400, "Invalid user role");
      }

      values.push(cleanRole);
      updates.push(`role = $${values.length}`);
    }

    if (is_active !== undefined) {
      if (typeof is_active !== "boolean") {
        return sendErrorResponse(res, 400, "is_active must be true or false");
      }

      values.push(is_active);
      updates.push(`is_active = $${values.length}`);
    }

    if (updates.length === 0) {
      return sendErrorResponse(
        res,
        400,
        "At least one field is required to update",
      );
    }

    updates.push("updated_at = CURRENT_TIMESTAMP");

    values.push(user_id);

    const result = await pool.query(
      `
        UPDATE tbl_users
        SET
          ${updates.join(", ")}
        WHERE user_id = $${values.length}
        RETURNING
          user_id,
          full_name,
          email,
          role,
          is_active,
          created_at,
          updated_at
      `,
      values,
    );

    return sendSuccessResponse(
      res,
      200,
      "User updated successfully",
      result.rows[0],
    );
  } catch (error) {
    console.error("Update user error:", error);

    return sendErrorResponse(
      res,
      500,
      error.message || "Failed to update user",
    );
  }
}

export async function deactivateUser(req, res) {
  const { user_id } = req.params;

  try {
    if (!user_id || !/^\d+$/.test(user_id) || Number(user_id) <= 0) {
      return sendErrorResponse(res, 400, "Invalid user ID");
    }

    const result = await pool.query(
      `
        UPDATE tbl_users
        SET
          is_active = FALSE,
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1
        RETURNING
          user_id,
          full_name,
          email,
          role,
          is_active,
          updated_at
      `,
      [Number(user_id)],
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(res, 404, "User not found");
    }

    return sendSuccessResponse(
      res,
      200,
      "User deactivated successfully",
      result.rows[0],
    );
  } catch (error) {
    console.error("Deactivate user error:", error);

    const message =
      process.env.NODE_ENV === "development"
        ? error.message
        : "Failed to deactivate user";

    return sendErrorResponse(res, 500, message);
  }
}
