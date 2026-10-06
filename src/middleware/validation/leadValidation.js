import { BLOOD_GROUPS, GENDERS, LEAD_STATUSES } from "../../constants/constants.js";
import { isValidDate } from "../../utils/date.js";
import { sendErrorResponse } from "../../utils/response.js";
import { emailRegex, isValidId, phoneRegex } from "../../utils/validation.js";


const validateOptionalString = (value) => {
  return value === undefined || value === null || typeof value === "string";
};

export const validateCreateLead = (req, res, next) => {
  const {
    student_name,
    date_of_birth,
    gender,
    blood_group,
    phone_number,
    email,
    address,
    father_name,
    father_phone,
    father_email,
    father_occupation,
    mother_name,
    mother_phone,
    mother_email,
    mother_occupation,
    guardian_name,
    guardian_phone,
    guardian_email,
    guardian_relationship,
    academic_year_id,
    lead_source,
    lead_status,
    follow_up_date,
    remarks,
  } = req.body || {};

  if (!student_name || (typeof student_name === "string" && !student_name.trim())) {
    return sendErrorResponse(res, 400, "Student name is required");
  }

  if (typeof student_name !== "string") {
    return sendErrorResponse(res, 400, "Student name must be a string");
  }

  if (!phone_number || (typeof phone_number === "string" && !phone_number.trim())) {
    return sendErrorResponse(res, 400, "Phone number is required");
  }

  if (typeof phone_number !== "string") {
    return sendErrorResponse(res, 400, "Phone number must be a string");
  }

  if (!phoneRegex.test(phone_number.trim())) {
    return sendErrorResponse(res, 400, "Invalid phone number");
  }

  if (date_of_birth !== undefined) {
    if (typeof date_of_birth !== "string") {
      return sendErrorResponse(res, 400, "Date of birth must be a string");
    }

    if (!isValidDate(date_of_birth)) {
      return sendErrorResponse(res, 400, "Invalid date of birth");
    }
  }

  if (gender !== undefined) {
    if (typeof gender !== "string") {
      return sendErrorResponse(res, 400, "Gender must be a string");
    }

    const normalizedGender = gender.trim().toUpperCase();

    if (!GENDERS.includes(normalizedGender)) {
      return sendErrorResponse(
        res,
        400,
        `Gender must be one of: ${GENDERS.join(", ")}`
      );
    }

    req.body.gender = normalizedGender;
  }

  if (blood_group !== undefined) {
    if (typeof blood_group !== "string") {
      return sendErrorResponse(res, 400, "Blood group must be a string");
    }

    const normalizedBloodGroup = blood_group.trim().toUpperCase();

    if (!BLOOD_GROUPS.includes(normalizedBloodGroup)) {
      return sendErrorResponse(
        res,
        400,
        `Blood group must be one of: ${BLOOD_GROUPS.join(", ")}`
      );
    }

    req.body.blood_group = normalizedBloodGroup;
  }

  if (email !== undefined && email !== null && email.trim()) {
    if (typeof email !== "string") {
      return sendErrorResponse(res, 400, "Email must be a string");
    }

    if (!emailRegex.test(email.trim())) {
      return sendErrorResponse(res, 400, "Invalid email address");
    }

    req.body.email = email.trim().toLowerCase();
  }

  if (academic_year_id !== undefined) {
    if (!isValidId(academic_year_id)) {
      return sendErrorResponse(res, 400, "Valid academic year ID is required");
    }

    req.body.academic_year_id = Number(academic_year_id);
  }

  if (lead_status !== undefined) {
    if (typeof lead_status !== "string") {
      return sendErrorResponse(res, 400, "Lead status must be a string");
    }

    const normalizedStatus = lead_status.trim().toUpperCase();

    if (!LEAD_STATUSES.includes(normalizedStatus)) {
      return sendErrorResponse(
        res,
        400,
        `Lead status must be one of: ${LEAD_STATUSES.join(", ")}`
      );
    }

    req.body.lead_status = normalizedStatus;
  }

  if (follow_up_date !== undefined) {
    if (typeof follow_up_date !== "string") {
      return sendErrorResponse(res, 400, "Follow-up date must be a string");
    }

    if (!isValidDate(follow_up_date)) {
      return sendErrorResponse(res, 400, "Invalid follow-up date");
    }
  }

  const optionalFields = {
    address,
    father_name,
    father_phone,
    father_email,
    father_occupation,
    mother_name,
    mother_phone,
    mother_email,
    mother_occupation,
    guardian_name,
    guardian_phone,
    guardian_email,
    guardian_relationship,
    lead_source,
    remarks,
  };

  for (const [field, value] of Object.entries(optionalFields)) {
    if (!validateOptionalString(value)) {
      return sendErrorResponse(
        res,
        400,
        `${field.replaceAll("_", " ")} must be a string`
      );
    }
  }

  const phoneFields = {
    father_phone,
    mother_phone,
    guardian_phone,
  };

  for (const [field, value] of Object.entries(phoneFields)) {
    if (value !== undefined && value !== null && value.trim()) {
      if (!phoneRegex.test(value.trim())) {
        return sendErrorResponse(
          res,
          400,
          `Invalid ${field.replaceAll("_", " ")}`
        );
      }
    }
  }

  const emailFields = {
    father_email,
    mother_email,
    guardian_email,
  };

  for (const [field, value] of Object.entries(emailFields)) {
    if (value !== undefined && value !== null && value.trim()) {
      if (!emailRegex.test(value.trim())) {
        return sendErrorResponse(
          res,
          400,
          `Invalid ${field.replaceAll("_", " ")}`
        );
      }
    }
  }

  req.body.student_name = student_name.trim();
  req.body.phone_number = phone_number.trim();

  Object.entries(optionalFields).forEach(([field, value]) => {
    if (typeof value === "string") {
      req.body[field] = value.trim();
    }
  });

  next();
};

export const validateUpdateLead = (req, res, next) => {
  const updates = req.body || {};

  if (Object.keys(updates).length === 0) {
    return sendErrorResponse(res, 400, "At least one field is required");
  }

  if (updates.student_name !== undefined) {
    if (
      !updates.student_name ||
      (typeof updates.student_name === "string" &&
        !updates.student_name.trim())
    ) {
      return sendErrorResponse(res, 400, "Student name is required");
    }

    if (typeof updates.student_name !== "string") {
      return sendErrorResponse(res, 400, "Student name must be a string");
    }

    req.body.student_name = updates.student_name.trim();
  }

  if (updates.phone_number !== undefined) {
    if (
      !updates.phone_number ||
      (typeof updates.phone_number === "string" &&
        !updates.phone_number.trim())
    ) {
      return sendErrorResponse(res, 400, "Phone number is required");
    }

    if (typeof updates.phone_number !== "string") {
      return sendErrorResponse(res, 400, "Phone number must be a string");
    }

    if (!phoneRegex.test(updates.phone_number.trim())) {
      return sendErrorResponse(res, 400, "Invalid phone number");
    }

    req.body.phone_number = updates.phone_number.trim();
  }

  if (updates.date_of_birth !== undefined) {
    if (!isValidDate(updates.date_of_birth)) {
      return sendErrorResponse(res, 400, "Invalid date of birth");
    }
  }

  if (updates.gender !== undefined) {
    if (typeof updates.gender !== "string") {
      return sendErrorResponse(res, 400, "Gender must be a string");
    }

    const gender = updates.gender.trim().toUpperCase();

    if (!GENDERS.includes(gender)) {
      return sendErrorResponse(
        res,
        400,
        `Gender must be one of: ${GENDERS.join(", ")}`
      );
    }

    req.body.gender = gender;
  }

  if (updates.blood_group !== undefined) {
    if (typeof updates.blood_group !== "string") {
      return sendErrorResponse(res, 400, "Blood group must be a string");
    }

    const bloodGroup = updates.blood_group.trim().toUpperCase();

    if (!BLOOD_GROUPS.includes(bloodGroup)) {
      return sendErrorResponse(
        res,
        400,
        `Blood group must be one of: ${BLOOD_GROUPS.join(", ")}`
      );
    }

    req.body.blood_group = bloodGroup;
  }

  if (updates.email !== undefined) {
    if (typeof updates.email !== "string") {
      return sendErrorResponse(res, 400, "Email must be a string");
    }

    if (updates.email.trim() && !emailRegex.test(updates.email.trim())) {
      return sendErrorResponse(res, 400, "Invalid email address");
    }

    req.body.email = updates.email.trim().toLowerCase();
  }

  if (updates.academic_year_id !== undefined) {
    if (!isValidId(updates.academic_year_id)) {
      return sendErrorResponse(res, 400, "Valid academic year ID is required");
    }

    req.body.academic_year_id = Number(updates.academic_year_id);
  }

  if (updates.lead_status !== undefined) {
    if (typeof updates.lead_status !== "string") {
      return sendErrorResponse(res, 400, "Lead status must be a string");
    }

    const status = updates.lead_status.trim().toUpperCase();

    if (!LEAD_STATUSES.includes(status)) {
      return sendErrorResponse(
        res,
        400,
        `Lead status must be one of: ${LEAD_STATUSES.join(", ")}`
      );
    }

    req.body.lead_status = status;
  }

  if (updates.follow_up_date !== undefined) {
    if (!isValidDate(updates.follow_up_date)) {
      return sendErrorResponse(res, 400, "Invalid follow-up date");
    }
  }

  next();
};

export const validateUpdateLeadStatus = (req, res, next) => {
  const { lead_status } = req.body || {};

  if (
    !lead_status ||
    (typeof lead_status === "string" && !lead_status.trim())
  ) {
    return sendErrorResponse(res, 400, "Lead status is required");
  }

  if (typeof lead_status !== "string") {
    return sendErrorResponse(res, 400, "Lead status must be a string");
  }

  const normalizedStatus = lead_status.trim().toUpperCase();

  if (!LEAD_STATUSES.includes(normalizedStatus)) {
    return sendErrorResponse(
      res,
      400,
      `Lead status must be one of: ${LEAD_STATUSES.join(", ")}`
    );
  }

  req.body.lead_status = normalizedStatus;

  next();
};

export const validateConvertLead = (req, res, next) => {
  const { class_section_id, roll_number } = req.body || {};

  if (!class_section_id) {
    return sendErrorResponse(
      res,
      400,
      "Valid class section ID is required"
    );
  }

  if (!isValidId(class_section_id)) {
    return sendErrorResponse(
      res,
      400,
      "Valid class section ID is required"
    );
  }

  req.body.class_section_id = Number(class_section_id);

  if (
    roll_number !== undefined &&
    roll_number !== null &&
    roll_number !== ""
  ) {
    if (
      !Number.isInteger(Number(roll_number)) ||
      Number(roll_number) <= 0
    ) {
      return sendErrorResponse(
        res,
        400,
        "Invalid roll number"
      );
    }

    req.body.roll_number = Number(roll_number);
  } else {
    delete req.body.roll_number;
  }

  next();
};