import pool from "../config/database.js";
import {
  sendErrorResponse,
  sendSuccessResponse
} from "../utils/response.js";

export async function bulkCreateDesignations(req, res) {
  try {
    const { designations } = req.body || {};

    if (
      !Array.isArray(designations) ||
      designations.length === 0
    ) {
      return sendErrorResponse(
        res,
        400,
        "Designations must be a non-empty array"
      );
    }

    const errors = [];
    const values = [];
    const placeholders = [];

    designations.forEach((designation, index) => {
      const {
        designation_name,
        description
      } = designation || {};

      if (
        !designation_name ||
        typeof designation_name !== "string" ||
        !designation_name.trim()
      ) {
        errors.push({
          index,
          designation_name:
            "Designation name is required"
        });
        return;
      }

      const cleanName =
        designation_name.trim();

      const cleanDescription =
        description !== undefined &&
          description !== null
          ? description.toString().trim() || null
          : null;

      const nameIndex =
        values.length + 1;

      const descriptionIndex =
        values.length + 2;

      values.push(
        cleanName,
        cleanDescription
      );

      placeholders.push(
        `($${nameIndex}, $${descriptionIndex})`
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
        INSERT INTO tbl_designations (
          designation_name,
          description
        )
        VALUES ${placeholders.join(", ")}
        ON CONFLICT (designation_name)
        DO NOTHING
        RETURNING *
      `,
      values
    );

    return sendSuccessResponse(
      res,
      201,
      "Designations created successfully",
      result.rows
    );
  } catch (error) {
    console.error(
      "Bulk create designations error:",
      error
    );

    return sendErrorResponse(
      res,
      500,
      "Failed to create designations"
    );
  }
}

export async function createDesignation(req, res) {
  try {
    const { designation_name, description } =
      req.body || {};

    const errors = {};

    const designationName =
      typeof designation_name === "string"
        ? designation_name.trim()
        : "";

    if (!designationName) {
      errors.designation_name =
        "Designation name is required";
    }

    let designationDescription = null;

    if (
      description !== undefined &&
      description !== null
    ) {
      if (typeof description !== "string") {
        errors.description =
          "Description must be a string";
      } else {
        designationDescription =
          description.trim() || null;
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
        INSERT INTO tbl_designations (
          designation_name,
          description
        )
        VALUES ($1, $2)
        RETURNING *
      `,
      [
        designationName,
        designationDescription
      ]
    );

    return sendSuccessResponse(
      res,
      201,
      "Designation created successfully",
      result.rows[0]
    );

  } catch (error) {
    console.error(
      "Create designation error:",
      error
    );

    if (error.code === "23505") {
      return sendErrorResponse(
        res,
        409,
        "Designation already exists"
      );
    }

    const message =
      process.env.NODE_ENV === "development"
        ? error.message
        : "Failed to create designation";

    return sendErrorResponse(
      res,
      500,
      message
    );
  }
}

export async function getAllDesignations(req, res) {
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
        designation_id,
        designation_name,
        description,
        is_active,
        created_at,
        updated_at
      FROM tbl_designations
    `;

    const values = [];

    if (is_active !== undefined) {
      values.push(is_active === "true");

      query += `
        WHERE is_active = $1
      `;
    }

    query += `
      ORDER BY designation_id DESC
    `;

    const result = await pool.query(
      query,
      values
    );

    return sendSuccessResponse(
      res,
      200,
      "Designations fetched successfully",
      result.rows
    );

  } catch (error) {
    console.error(
      "Get designations error:",
      error
    );

    const message =
      process.env.NODE_ENV === "development"
        ? error.message
        : "Failed to fetch designations";

    return sendErrorResponse(
      res,
      500,
      message
    );
  }
}

export async function getDesignationById(
  req,
  res
) {
  try {
    const { designation_id } =
      req.params;

    if (
      !designation_id ||
      !/^\d+$/.test(designation_id)
    ) {
      return sendErrorResponse(
        res,
        400,
        "Invalid designation ID"
      );
    }

    const result = await pool.query(
      `
        SELECT
          designation_id,
          designation_name,
          description,
          is_active,
          created_at,
          updated_at
        FROM tbl_designations
        WHERE designation_id = $1
      `,
      [designation_id]
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        "Designation not found"
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Designation fetched successfully",
      result.rows[0]
    );
  } catch (error) {
    console.error(
      "Get designation error:",
      error
    );

    return sendErrorResponse(
      res,
      500,
      "Failed to fetch designation"
    );
  }
}

export async function updateDesignation(
  req,
  res
) {
  try {
    const { designation_id } =
      req.params;

    const {
      designation_name,
      description,
      is_active
    } = req.body || {};

    if (
      !designation_id ||
      !/^\d+$/.test(designation_id)
    ) {
      return sendErrorResponse(
        res,
        400,
        "Invalid designation ID"
      );
    }

    const errors = {};

    if (
      designation_name !== undefined &&
      (
        typeof designation_name !== "string" ||
        !designation_name.trim()
      )
    ) {
      errors.designation_name =
        "Designation name cannot be empty";
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

    if (designation_name !== undefined) {
      values.push(
        designation_name.trim()
      );

      updates.push(
        `designation_name = $${values.length}`
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

    values.push(designation_id);

    const result = await pool.query(
      `
        UPDATE tbl_designations
        SET
          ${updates.join(", ")},
          updated_at = CURRENT_TIMESTAMP
        WHERE designation_id = $${values.length}
        RETURNING *
      `,
      values
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        "Designation not found"
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Designation updated successfully",
      result.rows[0]
    );
  } catch (error) {
    console.error(
      "Update designation error:",
      error
    );

    if (error.code === "23505") {
      return sendErrorResponse(
        res,
        409,
        "Designation already exists"
      );
    }

    return sendErrorResponse(
      res,
      500,
      "Failed to update designation"
    );
  }
}

export async function updateDesignationStatus(req, res) {
  try {
    const { designation_id } = req.params;
    const { is_active } = req.body || {};

    const errors = {};

    if (
      !designation_id ||
      !Number.isInteger(Number(designation_id)) ||
      Number(designation_id) <= 0
    ) {
      errors.designation_id =
        "Valid designation ID is required";
    }

    if (is_active === undefined || is_active === null) {
      errors.is_active =
        "is_active is required";
    }

    if (typeof is_active !== "boolean") {
      errors.is_active = "is_active must be a boolean";
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
        UPDATE tbl_designations
        SET
          is_active = $1,
          updated_at = CURRENT_TIMESTAMP
        WHERE designation_id = $2
        RETURNING
          designation_id,
          designation_name,
          description,
          is_active,
          created_at,
          updated_at
      `,
      [
        is_active,
        Number(designation_id)
      ]
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Designation with ID ${designation_id} not found`
      );
    }

    return sendSuccessResponse(
      res,
      200,
      is_active
        ? "Designation activated successfully"
        : "Designation deactivated successfully",
      result.rows[0]
    );

  } catch (error) {
    console.error(
      "Update designation status error:",
      error
    );

    const message =
      process.env.NODE_ENV === "development"
        ? error.message
        : "Failed to update designation status";

    return sendErrorResponse(
      res,
      500,
      message
    );
  }
}