import pool from "../config/database.js";
import {
  sendErrorResponse,
  sendSuccessResponse
} from "../utils/response.js";


export async function bulkCreateDepartments(req, res) {
  try {
    const { departments } = req.body || {};

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

    const errors = [];
    const values = [];
    const placeholders = [];

    departments.forEach((department, index) => {
      const {
        department_name,
        description
      } = department || {};

      if (
        !department_name ||
        typeof department_name !== "string" ||
        !department_name.trim()
      ) {
        errors.push({
          index,
          department_name:
            "Department name is required"
        });
        return;
      }

      const name = department_name.trim();
      const desc =
        description?.toString().trim() || null;

      const nameIndex =
        values.length + 1;

      const descIndex =
        values.length + 2;

      values.push(name, desc);

      placeholders.push(
        `($${nameIndex}, $${descIndex})`
      );
    });

    if (errors.length > 0) {
      return sendErrorResponse(
        res,
        400,
        "Validation failed",
        errors
      );
    }

    const result = await pool.query(
      `
        INSERT INTO tbl_departments (
          department_name,
          description
        )
        VALUES ${placeholders.join(", ")}
        ON CONFLICT (department_name)
        DO NOTHING
        RETURNING *
      `,
      values
    );

    return sendSuccessResponse(
      res,
      201,
      "Departments created successfully",
      result.rows
    );
  } catch (error) {
    console.error(
      "Bulk create departments error:",
      error
    );

    return sendErrorResponse(
      res,
      500,
      "Failed to create departments"
    );
  }
}

export async function createDepartment(req, res) {
  try {
    const { department_name, description } = req.body || {};

    const errors = {};

    const departmentName =
      typeof department_name === "string"
        ? department_name.trim()
        : "";

    if (!departmentName) {
      errors.department_name =
        "Department name is required";
    } else if (departmentName.length < 2) {
      errors.department_name =
        "Department name must be at least 2 characters";
    } else if (departmentName.length > 100) {
      errors.department_name =
        "Department name must not exceed 100 characters";
    }

    let departmentDescription = null;

    if (description !== undefined && description !== null) {
      if (typeof description !== "string") {
        errors.description =
          "Description must be a string";
      } else {
        departmentDescription =
          description.trim() || null;

        if (departmentDescription?.length > 500) {
          errors.description =
            "Description must not exceed 500 characters";
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      return sendErrorResponse(
        res,
        400,
        "Validation failed",
        errors
      );
    }

    const result = await pool.query(
      `
        INSERT INTO tbl_departments (
          department_name,
          description
        )
        VALUES ($1, $2)
        RETURNING *
      `,
      [
        departmentName,
        departmentDescription
      ]
    );

    return sendSuccessResponse(
      res,
      201,
      "Department created successfully",
      result.rows[0]
    );

  } catch (error) {
    console.error(
      "Create department error:",
      error
    );

    if (error.code === "23505") {
      return sendErrorResponse(
        res,
        409,
        "Department already exists"
      );
    }

    const message =
      process.env.NODE_ENV === "development"
        ? error.message
        : "Failed to create department";

    return sendErrorResponse(
      res,
      500,
      message
    );
  }
}

export async function getAllDepartments(req, res) {
  try {
    const { is_active } = req.query;

    const errors = {};

    if (
      is_active !== undefined &&
      is_active !== "true" &&
      is_active !== "false"
    ) {
      errors.is_active =
        "is_active must be true or false";
    }

    if (Object.keys(errors).length > 0) {
      return sendErrorResponse(
        res,
        400,
        "Validation failed",
        errors
      );
    }

    let query = `
      SELECT
        department_id,
        department_name,
        description,
        is_active,
        created_at,
        updated_at
      FROM tbl_departments
    `;

    const values = [];

    if (is_active !== undefined) {
      values.push(is_active === "true");

      query += `
        WHERE is_active = $1
      `;
    }

    query += `
      ORDER BY department_id DESC
    `;

    const result = await pool.query(
      query,
      values
    );

    return sendSuccessResponse(
      res,
      200,
      "Departments fetched successfully",
      result.rows
    );

  } catch (error) {
    console.error(
      "Get departments error:",
      error
    );

    const message =
      process.env.NODE_ENV === "development"
        ? error.message
        : "Failed to fetch departments";

    return sendErrorResponse(
      res,
      500,
      message
    );
  }
}

export async function getDepartmentById(
  req,
  res
) {
  try {
    const { department_id } =
      req.params;

    if (
      !department_id ||
      !/^\d+$/.test(department_id)
    ) {
      return sendErrorResponse(
        res,
        400,
        "Invalid department ID"
      );
    }

    const result = await pool.query(
      `
        SELECT
          department_id,
          department_name,
          description,
          is_active,
          created_at,
          updated_at
        FROM tbl_departments
        WHERE department_id = $1
      `,
      [department_id]
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        "Department not found"
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Department fetched successfully",
      result.rows[0]
    );
  } catch (error) {
    console.error(
      "Get department error:",
      error
    );

    return sendErrorResponse(
      res,
      500,
      "Failed to fetch department"
    );
  }
}

export async function updateDepartment(
  req,
  res
) {
  try {
    const { department_id } =
      req.params;

    const {
      department_name,
      description,
      is_active
    } = req.body || {};

    if (
      !department_id ||
      !/^\d+$/.test(department_id)
    ) {
      return sendErrorResponse(
        res,
        400,
        "Invalid department ID"
      );
    }

    const errors = {};

    if (
      department_name !== undefined &&
      (
        typeof department_name !== "string" ||
        !department_name.trim()
      )
    ) {
      errors.department_name =
        "Department name cannot be empty";
    }

    if (
      description !== undefined &&
      description !== null &&
      typeof description !== "string"
    ) {
      errors.description =
        "Description must be a string";
    }

    if (
      is_active !== undefined &&
      typeof is_active !== "boolean"
    ) {
      errors.is_active =
        "is_active must be true or false";
    }

    if (Object.keys(errors).length > 0) {
      return sendErrorResponse(
        res,
        400,
        "Validation failed",
        errors
      );
    }

    const updates = [];
    const values = [];

    if (department_name !== undefined) {
      values.push(
        department_name.trim()
      );

      updates.push(
        `department_name = $${values.length}`
      );
    }

    if (description !== undefined) {
      values.push(
        description === null
          ? null
          : description.trim()
      );

      updates.push(
        `description = $${values.length}`
      );
    }

    if (is_active !== undefined) {
      values.push(is_active);

      updates.push(
        `is_active = $${values.length}`
      );
    }

    if (updates.length === 0) {
      return sendErrorResponse(
        res,
        400,
        "At least one field is required to update"
      );
    }

    values.push(department_id);

    const result = await pool.query(
      `
        UPDATE tbl_departments
        SET
          ${updates.join(", ")},
          updated_at = CURRENT_TIMESTAMP
        WHERE department_id = $${values.length}
        RETURNING *
      `,
      values
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        "Department not found"
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Department updated successfully",
      result.rows[0]
    );
  } catch (error) {
    console.error(
      "Update department error:",
      error
    );

    if (error.code === "23505") {
      return sendErrorResponse(
        res,
        409,
        "Department already exists"
      );
    }

    return sendErrorResponse(
      res,
      500,
      "Failed to update department"
    );
  }
}

export async function updateDepartmentStatus(req, res) {
  try {
    const { department_id } = req.params;
    const { is_active } = req.body;

    const errors = {};

    if (
      !department_id ||
      !Number.isInteger(Number(department_id)) ||
      Number(department_id) <= 0
    ) {
      errors.department_id =
        "Valid department ID is required";
    }

    if (
      is_active === undefined ||
      is_active === null ||
      typeof is_active !== "boolean"
    ) {
      errors.is_active =
        "is_active is required and must be a boolean";
    }

    if (Object.keys(errors).length > 0) {
      return sendErrorResponse(
        res,
        400,
        "Validation failed",
        errors
      );
    }

    const result = await pool.query(
      `
        UPDATE tbl_departments
        SET
          is_active = $1,
          updated_at = CURRENT_TIMESTAMP
        WHERE department_id = $2
        RETURNING
          department_id,
          department_name,
          description,
          is_active,
          created_at,
          updated_at
      `,
      [
        is_active,
        Number(department_id)
      ]
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Department with ID ${department_id} not found`
      );
    }

    return sendSuccessResponse(
      res,
      200,
      is_active
        ? "Department activated successfully"
        : "Department deactivated successfully",
      result.rows[0]
    );

  } catch (error) {
    console.error(
      "Update department status error:",
      error
    );

    const message =
      process.env.NODE_ENV === "development"
        ? error.message
        : "Failed to update department status";

    return sendErrorResponse(
      res,
      500,
      message
    );
  }
}