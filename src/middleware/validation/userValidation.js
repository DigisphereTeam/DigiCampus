import { allowedRoles } from "../../constants/constants.js";
import { sendErrorResponse } from "../../utils/response.js";
import { emailRegex } from "../../utils/validation.js";

export const validateCreateUser = (req, res, next) => {
  const {
    full_name,
    email,
    password,
    role
  } = req.body || {};

  if (
    !full_name ||
    (typeof full_name === "string" && !full_name.trim())
  ) {
    return sendErrorResponse(
      res,
      400,
      "Full name is required"
    );
  }

  if (typeof full_name !== "string") {
    return sendErrorResponse(
      res,
      400,
      "Invalid full name"
    );
  }

  if (full_name.trim().length < 2) {
    return sendErrorResponse(
      res,
      400,
      "Full name must be at least 2 characters"
    );
  }

  if (
    !email ||
    (typeof email === "string" && !email.trim())
  ) {
    return sendErrorResponse(
      res,
      400,
      "Email is required"
    );
  }

  if (typeof email !== "string") {
    return sendErrorResponse(
      res,
      400,
      "Invalid email"
    );
  }

  if (!emailRegex.test(email.trim())) {
    return sendErrorResponse(
      res,
      400,
      "Invalid email address"
    );
  }

  if (
    !password ||
    (typeof password === "string" && !password.trim())
  ) {
    return sendErrorResponse(
      res,
      400,
      "Password is required"
    );
  }

  if (typeof password !== "string") {
    return sendErrorResponse(
      res,
      400,
      "Invalid password"
    );
  }

  if (password.length < 6) {
    return sendErrorResponse(
      res,
      400,
      "Password must be at least 6 characters"
    );
  }

  if (
    !role ||
    (typeof role === "string" && !role.trim())
  ) {
    return sendErrorResponse(
      res,
      400,
      "Role is required"
    );
  }

  if (typeof role !== "string") {
    return sendErrorResponse(
      res,
      400,
      "Invalid role"
    );
  }

  const normalizedRole = role.trim().toUpperCase();

  if (!allowedRoles.includes(normalizedRole)) {
    return sendErrorResponse(
      res,
      400,
      "Invalid user role"
    );
  }

  req.body.full_name = full_name.trim();
  req.body.email = email.trim().toLowerCase();
  req.body.role = normalizedRole;

  next();
};