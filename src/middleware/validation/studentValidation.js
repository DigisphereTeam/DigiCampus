import { BLOOD_GROUPS, GENDERS, STUDENT_STATUSES } from "../../constants/constants.js";
import { getCurrentDate, isValidDate } from "../../utils/date.js";
import { sendErrorResponse } from "../../utils/response.js";
import { emailRegex, isValidId, phoneRegex } from "../../utils/validation.js";

export const validateCreateStudent = (req, res, next) => {
  const {
    full_name,
    date_of_birth,
    gender,
    blood_group,
    phone_number,
    email,
    address,
    admission_date,
    status,
    profile_image,

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

    class_id,
    section_id,
    roll_number
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

  req.body.full_name = full_name.trim();

  if (!date_of_birth) {
    return sendErrorResponse(
      res,
      400,
      "Date of birth is required"
    );
  }

  if (typeof date_of_birth !== "string") {
    return sendErrorResponse(
      res,
      400,
      "Invalid date of birth"
    );
  }

  if (!isValidDate(date_of_birth)) {
    return sendErrorResponse(
      res,
      400,
      "Date of birth must be in YYYY-MM-DD format"
    );
  }

  if (date_of_birth > getCurrentDate()) {
    return sendErrorResponse(
      res,
      400,
      "Date of birth cannot be in the future"
    );
  }

  if (
    !gender ||
    (typeof gender === "string" && !gender.trim())
  ) {
    return sendErrorResponse(
      res,
      400,
      "Gender is required"
    );
  }

  if (typeof gender !== "string") {
    return sendErrorResponse(
      res,
      400,
      "Invalid gender"
    );
  }

  const normalizedGender = gender.trim().toUpperCase();

  if (!GENDERS.includes(normalizedGender)) {
    return sendErrorResponse(
      res,
      400,
      "Gender must be MALE, FEMALE or OTHER"
    );
  }

  req.body.gender = normalizedGender;

  if (blood_group !== undefined && blood_group !== null) {
    if (typeof blood_group !== "string") {
      return sendErrorResponse(
        res,
        400,
        "Invalid blood group"
      );
    }

    if (
      blood_group.trim() &&
      !BLOOD_GROUPS.includes(
        blood_group.trim().toUpperCase()
      )
    ) {
      return sendErrorResponse(
        res,
        400,
        "Invalid blood group"
      );
    }

    if (blood_group.trim()) {
      req.body.blood_group =
        blood_group.trim().toUpperCase();
    }
  }

  if (phone_number !== undefined && phone_number !== null) {
    if (typeof phone_number !== "string") {
      return sendErrorResponse(
        res,
        400,
        "Invalid student phone number"
      );
    }

    if (
      phone_number.trim() &&
      !phoneRegex.test(phone_number.trim())
    ) {
      return sendErrorResponse(
        res,
        400,
        "Student phone number must be a valid 10-digit Indian mobile number"
      );
    }

    if (phone_number.trim()) {
      req.body.phone_number = phone_number.trim();
    }
  }

  if (email !== undefined && email !== null) {
    if (typeof email !== "string") {
      return sendErrorResponse(
        res,
        400,
        "Invalid student email"
      );
    }

    if (
      email.trim() &&
      !emailRegex.test(email.trim())
    ) {
      return sendErrorResponse(
        res,
        400,
        "Invalid student email address"
      );
    }

    if (email.trim()) {
      req.body.email = email.trim().toLowerCase();
    }
  }

  if (admission_date !== undefined && admission_date !== null) {
    if (typeof admission_date !== "string") {
      return sendErrorResponse(
        res,
        400,
        "Invalid admission date"
      );
    }

    if (admission_date.trim()) {
      if (!isValidDate(admission_date)) {
        return sendErrorResponse(
          res,
          400,
          "Admission date must be in YYYY-MM-DD format"
        );
      }

      if (admission_date > getCurrentDate()) {
        return sendErrorResponse(
          res,
          400,
          "Admission date cannot be in the future"
        );
      }

      req.body.admission_date = admission_date.trim();
    }
  }

  if (status !== undefined && status !== null) {
    if (typeof status !== "string") {
      return sendErrorResponse(
        res,
        400,
        "Invalid student status"
      );
    }

    if (!status.trim()) {
      return sendErrorResponse(
        res,
        400,
        "Student status is required"
      );
    }

    const normalizedStatus = status.trim().toUpperCase();

    if (!STUDENT_STATUSES.includes(normalizedStatus)) {
      return sendErrorResponse(
        res,
        400,
        `Student status must be one of: ${STUDENT_STATUSES.join(", ")}`
      );
    }

    req.body.status = normalizedStatus;
  }

  if (address !== undefined && address !== null) {
    if (typeof address !== "string") {
      return sendErrorResponse(
        res,
        400,
        "Invalid address"
      );
    }

    if (address.trim()) {
      req.body.address = address.trim();
    }
  }

  if (profile_image !== undefined && profile_image !== null) {
    if (typeof profile_image !== "string") {
      return sendErrorResponse(
        res,
        400,
        "Invalid profile image"
      );
    }

    if (profile_image.trim()) {
      req.body.profile_image = profile_image.trim();
    }
  }

  if (father_name !== undefined && father_name !== null) {
    if (typeof father_name !== "string") {
      return sendErrorResponse(
        res,
        400,
        "Invalid father name"
      );
    }

    if (
      father_name.trim() &&
      father_name.trim().length < 2
    ) {
      return sendErrorResponse(
        res,
        400,
        "Father name must be at least 2 characters"
      );
    }

    if (father_name.trim()) {
      req.body.father_name = father_name.trim();
    }
  }

  if (father_phone !== undefined && father_phone !== null) {
    if (typeof father_phone !== "string") {
      return sendErrorResponse(
        res,
        400,
        "Invalid father phone number"
      );
    }

    if (
      father_phone.trim() &&
      !phoneRegex.test(father_phone.trim())
    ) {
      return sendErrorResponse(
        res,
        400,
        "Father phone number must be a valid 10-digit Indian mobile number"
      );
    }

    if (father_phone.trim()) {
      req.body.father_phone = father_phone.trim();
    }
  }

  if (father_email !== undefined && father_email !== null) {
    if (typeof father_email !== "string") {
      return sendErrorResponse(
        res,
        400,
        "Invalid father email"
      );
    }

    if (
      father_email.trim() &&
      !emailRegex.test(father_email.trim())
    ) {
      return sendErrorResponse(
        res,
        400,
        "Invalid father email address"
      );
    }

    if (father_email.trim()) {
      req.body.father_email =
        father_email.trim().toLowerCase();
    }
  }

  if (
    father_occupation !== undefined &&
    father_occupation !== null
  ) {
    if (typeof father_occupation !== "string") {
      return sendErrorResponse(
        res,
        400,
        "Invalid father occupation"
      );
    }

    if (father_occupation.trim()) {
      req.body.father_occupation =
        father_occupation.trim();
    }
  }

  if (mother_name !== undefined && mother_name !== null) {
    if (typeof mother_name !== "string") {
      return sendErrorResponse(
        res,
        400,
        "Invalid mother name"
      );
    }

    if (
      mother_name.trim() &&
      mother_name.trim().length < 2
    ) {
      return sendErrorResponse(
        res,
        400,
        "Mother name must be at least 2 characters"
      );
    }

    if (mother_name.trim()) {
      req.body.mother_name = mother_name.trim();
    }
  }

  if (mother_phone !== undefined && mother_phone !== null) {
    if (typeof mother_phone !== "string") {
      return sendErrorResponse(
        res,
        400,
        "Invalid mother phone number"
      );
    }

    if (
      mother_phone.trim() &&
      !phoneRegex.test(mother_phone.trim())
    ) {
      return sendErrorResponse(
        res,
        400,
        "Mother phone number must be a valid 10-digit Indian mobile number"
      );
    }

    if (mother_phone.trim()) {
      req.body.mother_phone = mother_phone.trim();
    }
  }

  if (mother_email !== undefined && mother_email !== null) {
    if (typeof mother_email !== "string") {
      return sendErrorResponse(
        res,
        400,
        "Invalid mother email"
      );
    }

    if (
      mother_email.trim() &&
      !emailRegex.test(mother_email.trim())
    ) {
      return sendErrorResponse(
        res,
        400,
        "Invalid mother email address"
      );
    }

    if (mother_email.trim()) {
      req.body.mother_email =
        mother_email.trim().toLowerCase();
    }
  }

  if (
    mother_occupation !== undefined &&
    mother_occupation !== null
  ) {
    if (typeof mother_occupation !== "string") {
      return sendErrorResponse(
        res,
        400,
        "Invalid mother occupation"
      );
    }

    if (mother_occupation.trim()) {
      req.body.mother_occupation =
        mother_occupation.trim();
    }
  }

  if (guardian_name !== undefined && guardian_name !== null) {
    if (typeof guardian_name !== "string") {
      return sendErrorResponse(
        res,
        400,
        "Invalid guardian name"
      );
    }

    if (
      guardian_name.trim() &&
      guardian_name.trim().length < 2
    ) {
      return sendErrorResponse(
        res,
        400,
        "Guardian name must be at least 2 characters"
      );
    }

    if (guardian_name.trim()) {
      req.body.guardian_name = guardian_name.trim();
    }
  }

  if (guardian_phone !== undefined && guardian_phone !== null) {
    if (typeof guardian_phone !== "string") {
      return sendErrorResponse(
        res,
        400,
        "Invalid guardian phone number"
      );
    }

    if (
      guardian_phone.trim() &&
      !phoneRegex.test(guardian_phone.trim())
    ) {
      return sendErrorResponse(
        res,
        400,
        "Guardian phone number must be a valid 10-digit Indian mobile number"
      );
    }

    if (guardian_phone.trim()) {
      req.body.guardian_phone = guardian_phone.trim();
    }
  }

  if (guardian_email !== undefined && guardian_email !== null) {
    if (typeof guardian_email !== "string") {
      return sendErrorResponse(
        res,
        400,
        "Invalid guardian email"
      );
    }

    if (
      guardian_email.trim() &&
      !emailRegex.test(guardian_email.trim())
    ) {
      return sendErrorResponse(
        res,
        400,
        "Invalid guardian email address"
      );
    }

    if (guardian_email.trim()) {
      req.body.guardian_email =
        guardian_email.trim().toLowerCase();
    }
  }

  if (
    guardian_relationship !== undefined &&
    guardian_relationship !== null
  ) {
    if (typeof guardian_relationship !== "string") {
      return sendErrorResponse(
        res,
        400,
        "Invalid guardian relationship"
      );
    }

    if (guardian_relationship.trim()) {
      req.body.guardian_relationship =
        guardian_relationship.trim();
    }
  }

  const hasClassId =
    class_id !== undefined &&
    class_id !== null;

  const hasSectionId =
    section_id !== undefined &&
    section_id !== null;

  if (hasClassId && !isValidId(class_id)) {
    return sendErrorResponse(
      res,
      400,
      "Invalid class ID"
    );
  }

  if (hasSectionId && !isValidId(section_id)) {
    return sendErrorResponse(
      res,
      400,
      "Invalid section ID"
    );
  }

  if (hasClassId !== hasSectionId) {
    return sendErrorResponse(
      res,
      400,
      "Class ID and section ID must be provided together"
    );
  }

  if (hasClassId && hasSectionId) {
    req.body.class_id = Number(class_id);
    req.body.section_id = Number(section_id);
  }

  if (
    roll_number !== undefined &&
    roll_number !== null
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
  }

  next();
};

export const validateUpdateStudent = (req, res, next) => {
  const {
    full_name,
    date_of_birth,
    gender,
    blood_group,
    phone_number,
    email,
    address,
    admission_date,
    status,
    profile_image,

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
    guardian_relationship
  } = req.body || {};

  if (full_name !== undefined) {
    if (typeof full_name !== "string" || !full_name.trim()) {
      return sendErrorResponse(res, 400, "Invalid full name");
    }

    if (full_name.trim().length < 2) {
      return sendErrorResponse(
        res,
        400,
        "Full name must be at least 2 characters"
      );
    }

    req.body.full_name = full_name.trim();
  }

  if (date_of_birth !== undefined) {
    if (
      typeof date_of_birth !== "string" ||
      !isValidDate(date_of_birth)
    ) {
      return sendErrorResponse(res, 400, "Invalid date of birth");
    }

    if (date_of_birth > getCurrentDate()) {
      return sendErrorResponse(
        res,
        400,
        "Date of birth cannot be in the future"
      );
    }
  }

  if (gender !== undefined) {
    const value = gender?.toString().trim().toUpperCase();

    if (!GENDERS.includes(value)) {
      return sendErrorResponse(res, 400, "Invalid gender");
    }

    req.body.gender = value;
  }

  if (blood_group !== undefined) {
    const value = blood_group?.toString().trim().toUpperCase();

    if (!BLOOD_GROUPS.includes(value)) {
      return sendErrorResponse(res, 400, "Invalid blood group");
    }

    req.body.blood_group = value;
  }

  if (phone_number !== undefined) {
    const value = phone_number?.toString().trim();

    if (!phoneRegex.test(value)) {
      return sendErrorResponse(
        res,
        400,
        "Invalid student phone number"
      );
    }

    req.body.phone_number = value;
  }

  if (email !== undefined) {
    const value = email?.toString().trim().toLowerCase();

    if (!emailRegex.test(value)) {
      return sendErrorResponse(
        res,
        400,
        "Invalid student email address"
      );
    }

    req.body.email = value;
  }

  if (address !== undefined) {
    if (
      typeof address !== "string" ||
      !address.trim()
    ) {
      return sendErrorResponse(res, 400, "Invalid address");
    }

    req.body.address = address.trim();
  }

  if (admission_date !== undefined) {
    if (
      typeof admission_date !== "string" ||
      !isValidDate(admission_date)
    ) {
      return sendErrorResponse(
        res,
        400,
        "Invalid admission date"
      );
    }

    if (admission_date > getCurrentDate()) {
      return sendErrorResponse(
        res,
        400,
        "Admission date cannot be in the future"
      );
    }
  }

  if (status !== undefined) {
    const value = status
      ?.toString()
      .trim()
      .toUpperCase();

    if (!STUDENT_STATUSES.includes(value)) {
      return sendErrorResponse(
        res,
        400,
        "Invalid student status"
      );
    }

    req.body.status = value;
  }

  if (profile_image !== undefined) {
    if (
      typeof profile_image !== "string" ||
      !profile_image.trim()
    ) {
      return sendErrorResponse(
        res,
        400,
        "Invalid profile image"
      );
    }

    req.body.profile_image = profile_image.trim();
  }

  if (father_name !== undefined) {
    if (
      typeof father_name !== "string" ||
      !father_name.trim()
    ) {
      return sendErrorResponse(res, 400, "Invalid father name");
    }

    if (father_name.trim().length < 2) {
      return sendErrorResponse(
        res,
        400,
        "Father name must be at least 2 characters"
      );
    }

    req.body.father_name = father_name.trim();
  }

  if (father_phone !== undefined) {
    const value = father_phone?.toString().trim();

    if (!phoneRegex.test(value)) {
      return sendErrorResponse(
        res,
        400,
        "Invalid father phone number"
      );
    }

    req.body.father_phone = value;
  }

  if (father_email !== undefined) {
    const value = father_email?.toString().trim().toLowerCase();

    if (!emailRegex.test(value)) {
      return sendErrorResponse(
        res,
        400,
        "Invalid father email address"
      );
    }

    req.body.father_email = value;
  }

  if (father_occupation !== undefined) {
    if (
      typeof father_occupation !== "string" ||
      !father_occupation.trim()
    ) {
      return sendErrorResponse(
        res,
        400,
        "Invalid father occupation"
      );
    }

    req.body.father_occupation = father_occupation.trim();
  }

  if (mother_name !== undefined) {
    if (
      typeof mother_name !== "string" ||
      !mother_name.trim()
    ) {
      return sendErrorResponse(res, 400, "Invalid mother name");
    }

    if (mother_name.trim().length < 2) {
      return sendErrorResponse(
        res,
        400,
        "Mother name must be at least 2 characters"
      );
    }

    req.body.mother_name = mother_name.trim();
  }

  if (mother_phone !== undefined) {
    const value = mother_phone?.toString().trim();

    if (!phoneRegex.test(value)) {
      return sendErrorResponse(
        res,
        400,
        "Invalid mother phone number"
      );
    }

    req.body.mother_phone = value;
  }

  if (mother_email !== undefined) {
    const value = mother_email?.toString().trim().toLowerCase();

    if (!emailRegex.test(value)) {
      return sendErrorResponse(
        res,
        400,
        "Invalid mother email address"
      );
    }

    req.body.mother_email = value;
  }

  if (mother_occupation !== undefined) {
    if (
      typeof mother_occupation !== "string" ||
      !mother_occupation.trim()
    ) {
      return sendErrorResponse(
        res,
        400,
        "Invalid mother occupation"
      );
    }

    req.body.mother_occupation = mother_occupation.trim();
  }

  if (guardian_name !== undefined) {
    if (
      typeof guardian_name !== "string" ||
      !guardian_name.trim()
    ) {
      return sendErrorResponse(
        res,
        400,
        "Invalid guardian name"
      );
    }

    if (guardian_name.trim().length < 2) {
      return sendErrorResponse(
        res,
        400,
        "Guardian name must be at least 2 characters"
      );
    }

    req.body.guardian_name = guardian_name.trim();
  }

  if (guardian_phone !== undefined) {
    const value = guardian_phone?.toString().trim();

    if (!phoneRegex.test(value)) {
      return sendErrorResponse(
        res,
        400,
        "Invalid guardian phone number"
      );
    }

    req.body.guardian_phone = value;
  }

  if (guardian_email !== undefined) {
    const value = guardian_email?.toString().trim().toLowerCase();

    if (!emailRegex.test(value)) {
      return sendErrorResponse(
        res,
        400,
        "Invalid guardian email address"
      );
    }

    req.body.guardian_email = value;
  }

  if (guardian_relationship !== undefined) {
    if (
      typeof guardian_relationship !== "string" ||
      !guardian_relationship.trim()
    ) {
      return sendErrorResponse(
        res,
        400,
        "Invalid guardian relationship"
      );
    }

    req.body.guardian_relationship =
      guardian_relationship.trim();
  }

  next();
};

export const validateUpdateStudentStatus = (req, res, next) => {
  const { status } = req.body || {};

  if (
    !status ||
    (typeof status === "string" && !status.trim())
  ) {
    return sendErrorResponse(
      res,
      400,
      "Student status is required"
    );
  }

  if (typeof status !== "string") {
    return sendErrorResponse(
      res,
      400,
      "Invalid student status"
    );
  }

  const normalizedStatus = status.trim().toUpperCase();

  if (!STUDENT_STATUSES.includes(normalizedStatus)) {
    return sendErrorResponse(
      res,
      400,
      `Student status must be one of: ${STUDENT_STATUSES.join(", ")}`
    );
  }

  req.body.status = normalizedStatus;

  next();
};