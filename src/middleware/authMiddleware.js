import jwt from "jsonwebtoken";

import {
  sendErrorResponse,
} from "../utils/response.js";

export default function authMiddleware(
  req,
  res,
  next
) {
  try {
    const authHeader =
      req.headers.authorization;

    if (
      !authHeader ||
      !authHeader.startsWith("Bearer ")
    ) {
      return sendErrorResponse(
        res,
        401,
        "Authentication token is required"
      );
    }

    const token =
      authHeader.split(" ")[1];

    if (!token) {
      return sendErrorResponse(
        res,
        401,
        "Authentication token is required"
      );
    }

    if (!process.env.JWT_SECRET) {
      return sendErrorResponse(
        res,
        500,
        "JWT secret is not configured"
      );
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    req.user = decoded;

    next();
  } catch (error) {
    console.error(
      "Auth middleware error:",
      error
    );

    if (error.name === "TokenExpiredError") {
      return sendErrorResponse(
        res,
        401,
        "Authentication token has expired"
      );
    }

    if (
      error.name ===
      "JsonWebTokenError"
    ) {
      return sendErrorResponse(
        res,
        401,
        "Invalid authentication token"
      );
    }

    return sendErrorResponse(
      res,
      500,
      error.message ||
      "Authentication failed"
    );
  }
}