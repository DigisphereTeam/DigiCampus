import pool from "../config/database.js";
import {
  sendErrorResponse,
  sendSuccessResponse,
} from "../utils/response.js";
import { isValidId } from "../utils/validation.js";

export const bulkCreateDepartments = async (req, res) => {
  try {
    const { departments } = req.body;

    const values = [];
    const placeholders = [];

    departments.forEach((department, index) => {
      const valueIndex = index * 2;

      values.push(
        department.department_name,
        department.description || null
      );

      placeholders.push(
        `($${valueIndex + 1}, $${valueIndex + 2})`
      );
    });

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
    console.error("Bulk create departments error:", error);

    return sendErrorResponse(
      res,
      500,
      "Failed to create departments"
    );
  }
};

export const createDepartment = async (req, res) => {
  try {
    const {
      department_name,
      description,
    } = req.body;

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
        department_name,
        description || null,
      ]
    );

    return sendSuccessResponse(
      res,
      201,
      "Department created successfully",
      result.rows[0]
    );
  } catch (error) {
    console.error("Create department error:", error);

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
      "Failed to create department"
    );
  }
};

export const getAllDepartments = async (req, res) => {
  try {
    const { is_active } = req.query;

    const values = [];
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
    console.error("Get departments error:", error);

    return sendErrorResponse(
      res,
      500,
      "Failed to fetch departments"
    );
  }
};

export const getDepartmentById = async (req, res) => {
  try {
    const { department_id } = req.params;

    if (!isValidId(department_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid department ID is required"
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
        `Department with ID ${department_id} not found`
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Department fetched successfully",
      result.rows[0]
    );
  } catch (error) {
    console.error("Get department error:", error);

    return sendErrorResponse(
      res,
      500,
      "Failed to fetch department"
    );
  }
};

export const updateDepartment = async (req, res) => {
  try {
    const { department_id } = req.params;

    const {
      department_name,
      description,
      is_active,
    } = req.body;

    if (!isValidId(department_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid department ID is required"
      );
    }

    const fields = [];
    const values = [];

    if (department_name !== undefined) {
      values.push(department_name);
      fields.push(
        `department_name = $${values.length}`
      );
    }

    if (description !== undefined) {
      values.push(description);
      fields.push(
        `description = $${values.length}`
      );
    }

    if (is_active !== undefined) {
      values.push(is_active);
      fields.push(
        `is_active = $${values.length}`
      );
    }

    if (fields.length === 0) {
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
          ${fields.join(", ")},
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
        `Department with ID ${department_id} not found`
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Department updated successfully",
      result.rows[0]
    );
  } catch (error) {
    console.error("Update department error:", error);

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
};

export const updateDepartmentStatus = async (req, res) => {
  try {
    const { department_id } = req.params;
    const { is_active } = req.body;

    if (!isValidId(department_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid department ID is required"
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
        department_id,
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

    return sendErrorResponse(
      res,
      500,
      "Failed to update department status"
    );
  }
};