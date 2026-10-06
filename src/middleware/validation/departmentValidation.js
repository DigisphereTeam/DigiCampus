import { hasValue } from "../../utils/validation.js";


export const validateCreateDepartment = (req, res, next) => {
  const {
    department_name,
    description,
  } = req.body;

  if (
    typeof department_name !== "string" ||
    !department_name.trim()
  ) {
    return sendErrorResponse(
      res,
      400,
      "Department name is required"
    );
  }

  const departmentName = department_name.trim();

  if (departmentName.length < 2) {
    return sendErrorResponse(
      res,
      400,
      "Department name must be at least 2 characters"
    );
  }

  if (departmentName.length > 100) {
    return sendErrorResponse(
      res,
      400,
      "Department name must not exceed 100 characters"
    );
  }

  if (
    hasValue(description) &&
    typeof description !== "string"
  ) {
    return sendErrorResponse(
      res,
      400,
      "Description must be a string"
    );
  }

  req.body.department_name = departmentName;

  if (typeof description === "string") {
    req.body.description = description.trim() || null;
  }

  next();
};

export const validateBulkCreateDepartments = (req, res, next) => {
  const { departments } = req.body;

  if (
    !Array.isArray(departments) ||
    departments.length === 0
  ) {
    return sendErrorResponse(
      res,
      400,
      "Departments must be a non-empty array"
    );
  }

  for (let index = 0; index < departments.length; index++) {
    const department = departments[index];

    if (
      !department ||
      typeof department !== "object" ||
      Array.isArray(department)
    ) {
      return sendErrorResponse(
        res,
        400,
        `Invalid department data at index ${index}`
      );
    }

    const {
      department_name,
      description,
    } = department;

    if (
      typeof department_name !== "string" ||
      !department_name.trim()
    ) {
      return sendErrorResponse(
        res,
        400,
        `Department name is required at index ${index}`
      );
    }

    const departmentName = department_name.trim();

    if (departmentName.length < 2) {
      return sendErrorResponse(
        res,
        400,
        `Department name must be at least 2 characters at index ${index}`
      );
    }

    if (departmentName.length > 100) {
      return sendErrorResponse(
        res,
        400,
        `Department name must not exceed 100 characters at index ${index}`
      );
    }

    if (
      hasValue(description) &&
      typeof description !== "string"
    ) {
      return sendErrorResponse(
        res,
        400,
        `Description must be a string at index ${index}`
      );
    }

    req.body.departments[index].department_name =
      departmentName;

    if (typeof description === "string") {
      req.body.departments[index].description =
        description.trim() || null;
    }
  }

  next();
};

export const validateGetDepartments = (req, res, next) => {
  const { is_active } = req.query;

  if (
    hasValue(is_active) &&
    is_active !== "true" &&
    is_active !== "false"
  ) {
    return sendErrorResponse(
      res,
      400,
      "is_active must be true or false"
    );
  }

  next();
};

export const validateUpdateDepartment = (req, res, next) => {
  const {
    department_name,
    description,
    is_active,
  } = req.body;

  if (
    department_name === undefined &&
    description === undefined &&
    is_active === undefined
  ) {
    return sendErrorResponse(
      res,
      400,
      "At least one field is required to update"
    );
  }

  if (
    department_name !== undefined &&
    (
      typeof department_name !== "string" ||
      !department_name.trim()
    )
  ) {
    return sendErrorResponse(
      res,
      400,
      "Department name cannot be empty"
    );
  }

  if (
    typeof department_name === "string"
  ) {
    const departmentName = department_name.trim();

    if (departmentName.length < 2) {
      return sendErrorResponse(
        res,
        400,
        "Department name must be at least 2 characters"
      );
    }

    if (departmentName.length > 100) {
      return sendErrorResponse(
        res,
        400,
        "Department name must not exceed 100 characters"
      );
    }

    req.body.department_name = departmentName;
  }

  if (
    description !== undefined &&
    description !== null &&
    typeof description !== "string"
  ) {
    return sendErrorResponse(
      res,
      400,
      "Description must be a string"
    );
  }

  if (typeof description === "string") {
    req.body.description = description.trim() || null;
  }

  if (
    is_active !== undefined &&
    typeof is_active !== "boolean"
  ) {
    return sendErrorResponse(
      res,
      400,
      "is_active must be true or false"
    );
  }

  next();
};

export const validateUpdateDepartmentStatus = (
  req,
  res,
  next
) => {
  const { is_active } = req.body;

  if (
    is_active === undefined ||
    is_active === null ||
    typeof is_active !== "boolean"
  ) {
    return sendErrorResponse(
      res,
      400,
      "is_active is required and must be a boolean"
    );
  }

  next();
};