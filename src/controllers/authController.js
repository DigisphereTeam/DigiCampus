import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import pool from "../config/database.js";

import { sendErrorResponse, sendSuccessResponse } from "../utils/response.js";

export async function login(req, res) {
  const { email, password } = req.body;

  try {
    const cleanEmail = email.trim().toLowerCase();

    const result = await pool.query(
      `
        SELECT
          user_id,
          full_name,
          email,
          password_hash,
          role,
          is_active
        FROM tbl_users
        WHERE LOWER(email) = LOWER($1)
        LIMIT 1
      `,
      [cleanEmail],
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(res, 401, "Invalid email or password");
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return sendErrorResponse(res, 403, "Your account is inactive");
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return sendErrorResponse(res, 401, "Invalid email or password");
    }

    const token = jwt.sign(
      {
        user_id: user.user_id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      },
    );

    const userData = {
      user_id: user.user_id,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      is_active: user.is_active,
    };

    return sendSuccessResponse(res, 200, "Login successful", {
      token,
      user: userData,
    });
  } catch (error) {
    console.error("Login error:", error);

    return sendErrorResponse(res, 500, "Failed to login");
  }
}

export async function getMe(req, res) {
  try {
    const userId = Number(req.user?.user_id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return sendErrorResponse(res, 401, "Invalid authentication");
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
        LIMIT 1
      `,
      [userId],
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(res, 404, "User not found");
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return sendErrorResponse(res, 403, "Your account is inactive");
    }

    return sendSuccessResponse(
      res,
      200,
      "User details fetched successfully",
      user,
    );
  } catch (error) {
    console.error("Get me error:", error);

    return sendErrorResponse(
      res,
      500,
      error.message || "Failed to fetch user details",
    );
  }
}

export async function changePassword(req, res) {
  const { user_id } = req.user;

  const { current_password, new_password } = req.body;

  try {
    const result = await pool.query(
      `
        SELECT
          user_id,
          password_hash,
          is_active
        FROM tbl_users
        WHERE user_id = $1
        LIMIT 1
      `,
      [user_id],
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(res, 404, "User not found");
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return sendErrorResponse(res, 403, "Your account is inactive");
    }

    const isPasswordValid = await bcrypt.compare(
      current_password,
      user.password_hash,
    );

    if (!isPasswordValid) {
      return sendErrorResponse(res, 401, "Current password is incorrect");
    }

    if (current_password === new_password) {
      return sendErrorResponse(
        res,
        400,
        "New password must be different from current password",
      );
    }

    const passwordHash = await bcrypt.hash(new_password, 10);

    await pool.query(
      `
        UPDATE tbl_users
        SET
          password_hash = $1,
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $2
      `,
      [passwordHash, user_id],
    );

    return sendSuccessResponse(res, 200, "Password changed successfully");
  } catch (error) {
    console.error("Change password error:", error);

    return sendErrorResponse(res, 500, "Failed to change password");
  }
}
