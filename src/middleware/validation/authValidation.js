import { sendErrorResponse } from "../../utils/response.js";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const validateLogin = (req, res, next) => {
  const { email, password } = req.body || {};

  if (!email || (typeof email === "string" && !email.trim())) {
    return sendErrorResponse(res, 400, "Email is required");
  }

  if (typeof email !== "string" || !emailRegex.test(email.trim())) {
    return sendErrorResponse(res, 400, "Invalid email address");
  }

  if (!password || (typeof password === "string" && !password.trim())) {
    return sendErrorResponse(res, 400, "Password is required");
  }

  if (typeof password !== "string") {
    return sendErrorResponse(res, 400, "Invalid password");
  }

  next();
};

export const validateChangePassword = (req, res, next) => {
  const { current_password, new_password } = req.body || {};

  if (
    !current_password ||
    (typeof current_password === "string" && !current_password.trim())
  ) {
    return sendErrorResponse(res, 400, "Current password is required");
  }

  if (typeof current_password !== "string") {
    return sendErrorResponse(res, 400, "Invalid current password");
  }

  if (
    !new_password ||
    (typeof new_password === "string" && !new_password.trim())
  ) {
    return sendErrorResponse(res, 400, "New password is required");
  }

  if (typeof new_password !== "string") {
    return sendErrorResponse(res, 400, "Invalid new password");
  }

  if (new_password.length < 8) {
    return sendErrorResponse(
      res,
      400,
      "New password must be at least 8 characters",
    );
  }

  if (current_password === new_password) {
    return sendErrorResponse(
      res,
      400,
      "New password must be different from current password",
    );
  }

  next();
};
