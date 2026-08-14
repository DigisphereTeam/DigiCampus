import bcrypt from "bcryptjs";
import pool from "../config/database.js";
import {
  sendErrorResponse,
  sendSuccessResponse,
} from "../utils/response.js";

const allowedRoles = [
  "SUPER_ADMIN",
  "ADMIN",
  "TEACHER",
  "ACCOUNTANT",
  "STAFF",
  "STUDENT",
  "PARENT",
];

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function createUser(req, res) {
  const {
    full_name,
    email,
    password,
    role,
  } = req.body;

  try {
    if (
      typeof full_name !== "string" ||
      !full_name.trim()
    ) {
      return sendErrorResponse(
        res,
        400,
        "Full name is required"
      );
    }

    if (
      typeof email !== "string" ||
      !email.trim()
    ) {
      return sendErrorResponse(
        res,
        400,
        "Email is required"
      );
    }

    if (
      typeof password !== "string" ||
      !password
    ) {
      return sendErrorResponse(
        res,
        400,
        "Password is required"
      );
    }

    if (
      typeof role !== "string" ||
      !role.trim()
    ) {
      return sendErrorResponse(
        res,
        400,
        "Role is required"
      );
    }

    const cleanName = full_name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanRole = role.trim().toUpperCase();

    if (cleanName.length < 2) {
      return sendErrorResponse(
        res,
        400,
        "Full name must be at least 2 characters"
      );
    }

    if (!emailRegex.test(cleanEmail)) {
      return sendErrorResponse(
        res,
        400,
        "Invalid email address"
      );
    }

    if (password.length < 6) {
      return sendErrorResponse(
        res,
        400,
        "Password must be at least 6 characters"
      );
    }

    if (!allowedRoles.includes(cleanRole)) {
      return sendErrorResponse(
        res,
        400,
        "Invalid user role"
      );
    }

    const existingUser = await pool.query(
      `
        SELECT user_id
        FROM tbl_users
        WHERE LOWER(email) = LOWER($1)
      `,
      [cleanEmail]
    );

    if (existingUser.rows.length > 0) {
      return sendErrorResponse(
        res,
        409,
        "User with this email already exists"
      );
    }

    const passwordHash = await bcrypt.hash(
      password,
      10
    );

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
      [
        cleanName,
        cleanEmail,
        passwordHash,
        cleanRole,
      ]
    );

    return sendSuccessResponse(
      res,
      201,
      "User created successfully",
      result.rows[0]
    );
  } catch (error) {
    console.error(
      "Create user error:",
      error
    );

    return sendErrorResponse(
      res,
      500,
      error.message || "Failed to create user"
    );
  }
}

export async function getAllUsers(req, res) {
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
        ORDER BY user_id DESC
      `
    );

    return sendSuccessResponse(
      res,
      200,
      "Users fetched successfully",
      result.rows
    );
  } catch (error) {
    console.error(
      "Get users error:",
      error
    );

    return sendErrorResponse(
      res,
      500,
      error.message || "Failed to fetch users"
    );
  }
}

export async function getUserById(req, res) {
  const { user_id } = req.params;

  try {
    if (
      !user_id ||
      !/^\d+$/.test(user_id)
    ) {
      return sendErrorResponse(
        res,
        400,
        "Invalid user ID"
      );
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
        WHERE user_id = $1
      `,
      [user_id]
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        "User not found"
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "User fetched successfully",
      result.rows[0]
    );
  } catch (error) {
    console.error(
      "Get user by ID error:",
      error
    );

    return sendErrorResponse(
      res,
      500,
      error.message || "Failed to fetch user"
    );
  }
}

export async function updateUser(req, res) {
  const { user_id } = req.params;

  try {
    if (!user_id || !/^\d+$/.test(user_id)) {
      return sendErrorResponse(
        res,
        400,
        "Invalid user ID"
      );
    }

    const existingUser = await pool.query(
      `
        SELECT user_id
        FROM tbl_users
        WHERE user_id = $1
      `,
      [user_id]
    );

    if (existingUser.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        "User not found"
      );
    }

    const {
      full_name,
      email,
      role,
      is_active,
    } = req.body;

    const updates = [];
    const values = [];

    if (full_name !== undefined) {
      if (
        typeof full_name !== "string" ||
        !full_name.trim()
      ) {
        return sendErrorResponse(
          res,
          400,
          "Full name cannot be empty"
        );
      }

      const cleanName = full_name.trim();

      if (cleanName.length < 2) {
        return sendErrorResponse(
          res,
          400,
          "Full name must be at least 2 characters"
        );
      }

      values.push(cleanName);
      updates.push(
        `full_name = $${values.length}`
      );
    }

    if (email !== undefined) {
      if (
        typeof email !== "string" ||
        !email.trim()
      ) {
        return sendErrorResponse(
          res,
          400,
          "Email cannot be empty"
        );
      }

      const cleanEmail =
        email.trim().toLowerCase();

      if (!emailRegex.test(cleanEmail)) {
        return sendErrorResponse(
          res,
          400,
          "Invalid email address"
        );
      }

      const emailExists = await pool.query(
        `
          SELECT user_id
          FROM tbl_users
          WHERE LOWER(email) = LOWER($1)
          AND user_id != $2
          LIMIT 1
        `,
        [cleanEmail, user_id]
      );

      if (emailExists.rows.length > 0) {
        return sendErrorResponse(
          res,
          409,
          "Email already exists"
        );
      }

      values.push(cleanEmail);
      updates.push(
        `email = $${values.length}`
      );
    }

    if (role !== undefined) {
      if (
        typeof role !== "string" ||
        !role.trim()
      ) {
        return sendErrorResponse(
          res,
          400,
          "Role cannot be empty"
        );
      }

      const cleanRole =
        role.trim().toUpperCase();

      if (!allowedRoles.includes(cleanRole)) {
        return sendErrorResponse(
          res,
          400,
          "Invalid user role"
        );
      }

      values.push(cleanRole);
      updates.push(
        `role = $${values.length}`
      );
    }

    if (is_active !== undefined) {
      if (typeof is_active !== "boolean") {
        return sendErrorResponse(
          res,
          400,
          "is_active must be true or false"
        );
      }

      values.push(is_active);
      updates.push(
        `is_active = $${values.length}`
      );
    }

    if (updates.length === 0) {
      return sendErrorResponse(
        res,
        400,
        "At least one field is required to update"
      );
    }

    updates.push(
      "updated_at = CURRENT_TIMESTAMP"
    );

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
      values
    );

    return sendSuccessResponse(
      res,
      200,
      "User updated successfully",
      result.rows[0]
    );
  } catch (error) {
    console.error(
      "Update user error:",
      error
    );

    return sendErrorResponse(
      res,
      500,
      error.message ||
      "Failed to update user"
    );
  }
}

export async function deleteUser(req, res) {
  const { user_id } = req.params;

  try {
    if (
      !user_id ||
      !/^\d+$/.test(user_id)
    ) {
      return sendErrorResponse(
        res,
        400,
        "Invalid user ID"
      );
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
      [user_id]
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        "User not found"
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "User deactivated successfully",
      result.rows[0]
    );
  } catch (error) {
    console.error(
      "Deactivate user error:",
      error
    );

    return sendErrorResponse(
      res,
      500,
      error.message || "Failed to deactivate user"
    );
  }
}