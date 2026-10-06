import jwt from "jsonwebtoken";

import pool from "../config/database.js";
import { config } from "../config/env.js";
import { sendErrorResponse } from "../utils/response.js";

export default async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return sendErrorResponse(
        res,
        401,
        "Authentication token is required",
      );
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return sendErrorResponse(
        res,
        401,
        "Authentication token is required",
      );
    }

    if (!config.jwtSecret) {
      return sendErrorResponse(
        res,
        500,
        "JWT secret is not configured",
      );
    }

    const decoded = jwt.verify(token, config.jwtSecret);

    const result = await pool.query(
      `
      SELECT
        user_id,
        email,
        role,
        is_active
      FROM tbl_users
      WHERE user_id = $1
      `,
      [decoded.user_id],
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(res, 401, "User not found");
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return sendErrorResponse(res, 403, "User account is inactive");
    }

    req.user = user;

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);

    if (error.name === "TokenExpiredError") {
      return sendErrorResponse(
        res,
        401,
        "Authentication token has expired",
      );
    }

    if (error.name === "JsonWebTokenError") {
      return sendErrorResponse(
        res,
        401,
        "Invalid authentication token",
      );
    }

    return sendErrorResponse(
      res,
      500,
      process.env.NODE_ENV === "development"
        ? error.message
        : "Authentication failed",
    );
  }
}