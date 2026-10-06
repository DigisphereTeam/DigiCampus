import { GENDERS } from "../../constants/constants.js";
import { isValidDate } from "../../utils/date.js";
import { sendErrorResponse } from "../../utils/response.js";

export const validateCreateTeacher = (req, res, next) => {
  const {
    full_name,
    email,
    password,
    phone,
    gender,
    date_of_birth,
    department_id,
    joining_date
  } = req.body || {};

  if (!full_name || (typeof full_name === "string" && !full_name.trim())) {
    return sendErrorResponse(res, 400, "Full name is required");
  }

  if (typeof full_name !== "string") {
    return sendErrorResponse(res, 400, "Invalid full name");
  }

  if (!email || (typeof email === "string" && !email.trim())) {
    return sendErrorResponse(res, 400, "Email is required");
  }

  if (typeof email !== "string") {
    return sendErrorResponse(res, 400, "Invalid email");
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return sendErrorResponse(res, 400, "Invalid email");
  }

  if (!password || (typeof password === "string" && !password.trim())) {
    return sendErrorResponse(res, 400, "Password is required");
  }

  if (typeof password !== "string") {
    return sendErrorResponse(res, 400, "Invalid password");
  }

  const normalizedPassword = password.trim();

  if (normalizedPassword.length < 8) {
    return sendErrorResponse(
      res,
      400,
      "Password must be at least 8 characters"
    );
  }

  if (!phone || (typeof phone === "string" && !phone.trim())) {
    return sendErrorResponse(res, 400, "Phone number is required");
  }

  if (typeof phone !== "string") {
    return sendErrorResponse(res, 400, "Invalid phone number");
  }

  const normalizedPhone = phone.trim();

  if (!/^[6-9]\d{9}$/.test(normalizedPhone)) {
    return sendErrorResponse(
      res,
      400,
      "Phone number must be a valid 10-digit number"
    );
  }

  if (!gender || (typeof gender === "string" && !gender.trim())) {
    return sendErrorResponse(res, 400, "Gender is required");
  }

  if (typeof gender !== "string") {
    return sendErrorResponse(res, 400, "Invalid gender");
  }

  const normalizedGender = gender.trim().toUpperCase();

  if (!GENDERS.includes(normalizedGender)) {
    return sendErrorResponse(res, 400, "Invalid gender");
  }

  if (!department_id) {
    return sendErrorResponse(res, 400, "Department ID is required");
  }

  if (
    !Number.isInteger(Number(department_id)) ||
    Number(department_id) <= 0
  ) {
    return sendErrorResponse(res, 400, "Valid department ID is required");
  }

  if (!joining_date) {
    return sendErrorResponse(res, 400, "Joining date is required");
  }

  if (
    typeof joining_date !== "string" ||
    !isValidDate(joining_date.trim())
  ) {
    return sendErrorResponse(
      res,
      400,
      "Joining date must be in YYYY-MM-DD format"
    );
  }

  if (date_of_birth !== undefined && date_of_birth !== null) {
    if (
      typeof date_of_birth !== "string" ||
      !isValidDate(date_of_birth.trim())
    ) {
      return sendErrorResponse(
        res,
        400,
        "Date of birth must be in YYYY-MM-DD format"
      );
    }
  }

  const optionalFields = [
    "qualification",
    "specialization",
    "designation",
    "address",
  ];

  for (const field of optionalFields) {
    if (req.body[field] !== undefined && req.body[field] !== null) {
      if (typeof req.body[field] !== "string") {
        return sendErrorResponse(res, 400, `Invalid ${field}`);
      }

      if (!req.body[field].trim()) {
        return sendErrorResponse(res, 400, `${field} is required`);
      }
    }
  }

  req.body.full_name = full_name.trim();
  req.body.email = normalizedEmail;
  req.body.password = normalizedPassword;
  req.body.phone = normalizedPhone;
  req.body.gender = normalizedGender;
  req.body.department_id = Number(department_id);
  req.body.joining_date = joining_date.trim();

  if (date_of_birth !== undefined && date_of_birth !== null) {
    req.body.date_of_birth = date_of_birth.trim();
  }

  for (const field of optionalFields) {
    if (req.body[field] !== undefined && req.body[field] !== null) {
      req.body[field] = req.body[field].trim();
    }
  }

  next();
};

export const validateUpdateTeacher = (req, res, next) => {
  const {
    full_name,
    email,
    phone,
    gender,
    date_of_birth,
    qualification,
    specialization,
    department_id,
    designation,
    joining_date,
    address,
    is_active,
  } = req.body || {};

  if (
    full_name === undefined &&
    email === undefined &&
    phone === undefined &&
    gender === undefined &&
    date_of_birth === undefined &&
    qualification === undefined &&
    specialization === undefined &&
    department_id === undefined &&
    designation === undefined &&
    joining_date === undefined &&
    address === undefined &&
    is_active === undefined
  ) {
    return sendErrorResponse(
      res,
      400,
      "At least one field is required to update the teacher"
    );
  }

  if (full_name !== undefined) {
    if (typeof full_name !== "string") {
      return sendErrorResponse(res, 400, "Invalid full name");
    }

    if (!full_name.trim()) {
      return sendErrorResponse(res, 400, "Full name is required");
    }

    req.body.full_name = full_name.trim();
  }

  if (email !== undefined) {
    if (typeof email !== "string") {
      return sendErrorResponse(res, 400, "Invalid email");
    }

    if (!email.trim()) {
      return sendErrorResponse(res, 400, "Email is required");
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return sendErrorResponse(res, 400, "Invalid email");
    }

    req.body.email = normalizedEmail;
  }

  if (phone !== undefined) {
    if (typeof phone !== "string") {
      return sendErrorResponse(res, 400, "Invalid phone number");
    }

    const normalizedPhone = phone.trim();

    if (!/^[6-9]\d{9}$/.test(normalizedPhone)) {
      return sendErrorResponse(
        res,
        400,
        "Phone number must be a valid 10-digit number"
      );
    }

    req.body.phone = normalizedPhone;
  }

  if (gender !== undefined) {
    if (typeof gender !== "string") {
      return sendErrorResponse(res, 400, "Invalid gender");
    }

    if (!gender.trim()) {
      return sendErrorResponse(res, 400, "Gender is required");
    }

    const normalizedGender = gender.trim().toUpperCase();

    if (!GENDERS.includes(normalizedGender)) {
      return sendErrorResponse(res, 400, "Invalid gender");
    }

    req.body.gender = normalizedGender;
  }

  if (date_of_birth !== undefined) {
    if (
      date_of_birth !== null &&
      (typeof date_of_birth !== "string" ||
        !isValidDate(date_of_birth.trim()))
    ) {
      return sendErrorResponse(
        res,
        400,
        "Date of birth must be in YYYY-MM-DD format"
      );
    }

    if (typeof date_of_birth === "string") {
      req.body.date_of_birth = date_of_birth.trim();
    }
  }

  if (department_id !== undefined) {
    if (
      department_id !== null &&
      (!Number.isInteger(Number(department_id)) ||
        Number(department_id) <= 0)
    ) {
      return sendErrorResponse(
        res,
        400,
        "Valid department ID is required"
      );
    }

    if (department_id !== null) {
      req.body.department_id = Number(department_id);
    }
  }

  if (joining_date !== undefined) {
    if (
      typeof joining_date !== "string" ||
      !isValidDate(joining_date.trim())
    ) {
      return sendErrorResponse(
        res,
        400,
        "Joining date must be in YYYY-MM-DD format"
      );
    }

    req.body.joining_date = joining_date.trim();
  }

  const optionalFields = [
    "qualification",
    "specialization",
    "designation",
    "address",
  ];

  for (const field of optionalFields) {
    if (req.body[field] !== undefined && req.body[field] !== null) {
      if (typeof req.body[field] !== "string") {
        return sendErrorResponse(
          res,
          400,
          `Invalid ${field}`
        );
      }

      if (!req.body[field].trim()) {
        return sendErrorResponse(
          res,
          400,
          `${field} is required`
        );
      }

      req.body[field] = req.body[field].trim();
    }
  }

  if (is_active !== undefined && typeof is_active !== "boolean") {
    return sendErrorResponse(res, 400, "Invalid is_active");
  }

  next();
};

export const validateTeacherId = (req, res, next) => {
  const { teacher_id } = req.params;

  if (
    !teacher_id ||
    !Number.isInteger(Number(teacher_id)) ||
    Number(teacher_id) <= 0
  ) {
    return sendErrorResponse(
      res,
      400,
      "Valid teacher ID is required"
    );
  }

  req.params.teacher_id = String(Number(teacher_id));

  next();
};