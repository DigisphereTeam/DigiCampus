import { GENDERS } from "../../constants/constants.js";
import { isValidDate } from "../../utils/date.js";
import { sendErrorResponse } from "../../utils/response.js";

export const validateCreateStaff = (req, res, next) => {
  const {
    full_name,
    email,
    password,
    phone,
    gender,
    date_of_birth,
    department_id,
    joining_date,
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
    "designation",
    "address",
  ];

  for (const field of optionalFields) {
    if (req.body[field] !== undefined && req.body[field] !== null) {
      if (typeof req.body[field] !== "string") {
        return sendErrorResponse(res, 400, `Invalid ${field}`);
      }

      if (!req.body[field].trim()) {
        return sendErrorResponse(res, 400, `${field} cannot be empty`);
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

export const validateUpdateStaff = (req, res, next) => {
  const {
    full_name,
    email,
    phone,
    gender,
    date_of_birth,
    department_id,
    joining_date,
    is_active,
  } = req.body || {};

  if (Object.keys(req.body || {}).length === 0) {
    return sendErrorResponse(
      res,
      400,
      "At least one field is required to update"
    );
  }

  if (full_name !== undefined) {
    if (typeof full_name !== "string" || !full_name.trim()) {
      return sendErrorResponse(res, 400, "Invalid full name");
    }

    req.body.full_name = full_name.trim();
  }

  if (email !== undefined) {
    if (typeof email !== "string" || !email.trim()) {
      return sendErrorResponse(res, 400, "Invalid email");
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return sendErrorResponse(res, 400, "Invalid email");
    }

    req.body.email = normalizedEmail;
  }

  if (phone !== undefined) {
    if (typeof phone !== "string" || !phone.trim()) {
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
    if (typeof gender !== "string" || !gender.trim()) {
      return sendErrorResponse(res, 400, "Invalid gender");
    }

    const normalizedGender = gender.trim().toUpperCase();

    if (!GENDERS.includes(normalizedGender)) {
      return sendErrorResponse(res, 400, "Invalid gender");
    }

    req.body.gender = normalizedGender;
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

    req.body.date_of_birth = date_of_birth.trim();
  }

  if (department_id !== undefined) {
    if (
      !Number.isInteger(Number(department_id)) ||
      Number(department_id) <= 0
    ) {
      return sendErrorResponse(
        res,
        400,
        "Valid department ID is required"
      );
    }

    req.body.department_id = Number(department_id);
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
    "designation",
    "address",
  ];

  for (const field of optionalFields) {
    if (req.body[field] !== undefined && req.body[field] !== null) {
      if (
        typeof req.body[field] !== "string" ||
        !req.body[field].trim()
      ) {
        return sendErrorResponse(res, 400, `Invalid ${field}`);
      }

      req.body[field] = req.body[field].trim();
    }
  }

  if (is_active !== undefined) {
    if (typeof is_active !== "boolean") {
      return sendErrorResponse(res, 400, "Invalid staff status");
    }
  }

  next();
};

export const validateStaffId = (req, res, next) => {
  const { staff_id } = req.params;

  if (
    !staff_id ||
    !Number.isInteger(Number(staff_id)) ||
    Number(staff_id) <= 0
  ) {
    return sendErrorResponse(
      res,
      400,
      "Valid staff ID is required"
    );
  }

  req.params.staff_id = Number(staff_id);

  next();
};

export const validateGetStaff = (req, res, next) => {
  const {
    page = 1,
    limit = 10,
    search,
    status,
  } = req.query;

  const pageNumber = Number(page);
  const limitNumber = Number(limit);

  if (
    !Number.isInteger(pageNumber) ||
    pageNumber <= 0
  ) {
    return sendErrorResponse(res, 400, "Invalid page");
  }

  if (
    !Number.isInteger(limitNumber) ||
    limitNumber <= 0 ||
    limitNumber > 100
  ) {
    return sendErrorResponse(
      res,
      400,
      "Invalid limit. Maximum limit is 100"
    );
  }

  req.query.page = pageNumber;
  req.query.limit = limitNumber;

  if (search !== undefined && search !== null) {
    if (typeof search !== "string") {
      return sendErrorResponse(res, 400, "Invalid search");
    }

    req.query.search = search.trim();
  }

  if (status !== undefined && status !== null) {
    if (typeof status !== "string") {
      return sendErrorResponse(
        res,
        400,
        "Invalid staff status"
      );
    }

    const normalizedStatus = status.trim().toUpperCase();

    if (!["ACTIVE", "INACTIVE"].includes(normalizedStatus)) {
      return sendErrorResponse(
        res,
        400,
        "Invalid staff status"
      );
    }

    req.query.status = normalizedStatus;
  }

  next();
};