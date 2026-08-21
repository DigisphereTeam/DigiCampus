import pool from "../config/database.js";

import {
  sendErrorResponse,
  sendSuccessResponse
} from "../utils/response.js";

export async function bulkCreateSections(req, res) {
  const client = await pool.connect();

  try {
    const { sections } = req.body || {};

    if (
      !Array.isArray(sections) ||
      sections.length === 0
    ) {
      return sendErrorResponse(
        res,
        400,
        "Sections must be a non-empty array"
      );
    }

    const errors = {};
    const names = [];
    const values = [];
    const placeholders = [];

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i] || {};

      const {
        section_name,
        description
      } = section;

      if (
        !section_name ||
        typeof section_name !== "string" ||
        !section_name.trim()
      ) {
        errors[`sections[${i}].section_name`] =
          "Section name is required";

        continue;
      }

      if (
        description !== undefined &&
        description !== null &&
        typeof description !== "string"
      ) {
        errors[`sections[${i}].description`] =
          "Description must be a string";

        continue;
      }

      const cleanName =
        section_name.trim();

      const normalizedName =
        cleanName.toLowerCase();

      if (names.includes(normalizedName)) {
        errors[`sections[${i}].section_name`] =
          `Duplicate section '${cleanName}' in request`;

        continue;
      }

      names.push(normalizedName);

      const nameIndex =
        values.length + 1;

      const descriptionIndex =
        values.length + 2;

      values.push(
        cleanName,
        description?.trim() || null
      );

      placeholders.push(
        `($${nameIndex}, $${descriptionIndex})`
      );
    }

    if (Object.keys(errors).length > 0) {
      return sendErrorResponse(
        res,
        400,
        "Validation failed",
        errors
      );
    }

    await client.query("BEGIN");

    await client.query(`
      SELECT pg_advisory_xact_lock(
        hashtext('section_bulk_creation')
      )
    `);

    const result = await client.query(
      `
        INSERT INTO tbl_sections (
          section_name,
          description
        )
        VALUES ${placeholders.join(", ")}
        ON CONFLICT (LOWER(section_name))
        DO NOTHING
        RETURNING
          section_id,
          section_name,
          description,
          is_active,
          created_at,
          updated_at
      `,
      values
    );

    await client.query("COMMIT");

    const insertedNames =
      result.rows.map(
        row => row.section_name.toLowerCase()
      );

    const skippedSections =
      names.filter(
        name => !insertedNames.includes(name)
      );

    return sendSuccessResponse(
      res,
      201,
      "Sections processed successfully",
      {
        inserted_count:
          result.rows.length,

        skipped_count:
          skippedSections.length,

        skipped_sections:
          skippedSections,

        sections:
          result.rows
      }
    );

  } catch (error) {
    await client.query("ROLLBACK");

    console.error(
      "Bulk create sections error:",
      error
    );

    const message =
      process.env.NODE_ENV === "development"
        ? error.message
        : "Failed to create sections";

    return sendErrorResponse(
      res,
      500,
      message
    );

  } finally {
    client.release();
  }
}

export async function createSection(req, res) {
  try {
    const { section_name, description } =
      req.body || {};

    const errors = {};

    if (
      !section_name ||
      typeof section_name !== "string" ||
      !section_name.trim()
    ) {
      errors.section_name =
        "Section name is required";
    }

    if (
      description !== undefined &&
      description !== null &&
      typeof description !== "string"
    ) {
      errors.description =
        "Description must be a string";
    }

    if (Object.keys(errors).length > 0) {
      return sendErrorResponse(
        res,
        400,
        "Validation failed",
        errors
      );
    }

    const cleanSectionName =
      section_name.trim();

    const result = await pool.query(
      `
        INSERT INTO tbl_sections (
          section_name,
          description
        )
        VALUES ($1, $2)
        RETURNING
          section_id,
          section_name,
          description,
          is_active,
          created_at,
          updated_at
      `,
      [
        cleanSectionName,
        description?.trim() || null
      ]
    );

    return sendSuccessResponse(
      res,
      201,
      "Section created successfully",
      result.rows[0]
    );

  } catch (error) {
    console.error(
      "Create section error:",
      error
    );

    if (error.code === "23505") {
      return sendErrorResponse(
        res,
        409,
        "Section already exists"
      );
    }

    const message =
      process.env.NODE_ENV === "development"
        ? error.message
        : "Failed to create section";

    return sendErrorResponse(
      res,
      500,
      message
    );
  }
}

export async function getAllSections(req, res) {
  try {
    const { is_active } = req.query;

    const values = [];
    let condition = "";

    if (is_active !== undefined) {
      if (
        is_active !== "true" &&
        is_active !== "false"
      ) {
        return sendErrorResponse(
          res,
          400,
          "is_active must be true or false"
        );
      }

      values.push(
        is_active === "true"
      );

      condition = `
        WHERE is_active = $1
      `;
    }

    const result = await pool.query(
      `
        SELECT
          section_id,
          section_name,
          description,
          is_active,
          created_at,
          updated_at
        FROM tbl_sections
        ${condition}
        ORDER BY section_id DESC
      `,
      values
    );

    return sendSuccessResponse(
      res,
      200,
      "Sections fetched successfully",
      result.rows
    );

  } catch (error) {
    console.error(
      "Get sections error:",
      error
    );

    const message =
      process.env.NODE_ENV === "development"
        ? error.message
        : "Failed to fetch sections";

    return sendErrorResponse(
      res,
      500,
      message
    );
  }
}

export async function getSectionById(req, res) {
  try {
    const { section_id } =
      req.params;

    if (
      !section_id ||
      !/^\d+$/.test(section_id) ||
      Number(section_id) <= 0
    ) {
      return sendErrorResponse(
        res,
        400,
        `Section ID ${section_id} is invalid`
      );
    }

    const result = await pool.query(
      `
        SELECT
          section_id,
          section_name,
          description,
          is_active,
          created_at,
          updated_at
        FROM tbl_sections
        WHERE section_id = $1
        LIMIT 1
      `,
      [Number(section_id)]
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Section ID ${section_id} not found`
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Section fetched successfully",
      result.rows[0]
    );

  } catch (error) {
    console.error(
      "Get section error:",
      error
    );

    const message =
      process.env.NODE_ENV === "development"
        ? error.message
        : "Failed to fetch section";

    return sendErrorResponse(
      res,
      500,
      message
    );
  }
}

export async function updateSection(req, res) {
  try {
    const { section_id } =
      req.params;

    const {
      section_name,
      description
    } = req.body || {};

    if (
      !section_id ||
      !/^\d+$/.test(section_id) ||
      Number(section_id) <= 0
    ) {
      return sendErrorResponse(
        res,
        400,
        `Section ID ${section_id} is invalid`
      );
    }

    const errors = {};

    if (section_name !== undefined) {
      if (
        typeof section_name !== "string" ||
        !section_name.trim()
      ) {
        errors.section_name =
          "Section name cannot be empty";
      }
    }

    if (
      description !== undefined &&
      description !== null &&
      typeof description !== "string"
    ) {
      errors.description =
        "Description must be a string";
    }

    if (Object.keys(errors).length > 0) {
      return sendErrorResponse(
        res,
        400,
        "Validation failed",
        errors
      );
    }

    if (
      section_name === undefined &&
      description === undefined
    ) {
      return sendErrorResponse(
        res,
        400,
        "At least one field is required"
      );
    }

    const existing =
      await pool.query(
        `
          SELECT
            section_id,
            section_name,
            description
          FROM tbl_sections
          WHERE section_id = $1
          LIMIT 1
        `,
        [Number(section_id)]
      );

    if (existing.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Section ID ${section_id} not found`
      );
    }

    const current =
      existing.rows[0];

    const newSectionName =
      section_name !== undefined
        ? section_name.trim()
        : current.section_name;

    const newDescription =
      description !== undefined
        ? description?.trim() || null
        : current.description;

    const duplicate =
      await pool.query(
        `
          SELECT section_id
          FROM tbl_sections
          WHERE LOWER(section_name) =
                LOWER($1)
            AND section_id <> $2
          LIMIT 1
        `,
        [
          newSectionName,
          Number(section_id)
        ]
      );

    if (duplicate.rows.length > 0) {
      return sendErrorResponse(
        res,
        409,
        `Section '${newSectionName}' already exists`
      );
    }

    const result =
      await pool.query(
        `
          UPDATE tbl_sections
          SET
            section_name = $1,
            description = $2,
            updated_at = CURRENT_TIMESTAMP
          WHERE section_id = $3
          RETURNING
            section_id,
            section_name,
            description,
            is_active,
            created_at,
            updated_at
        `,
        [
          newSectionName,
          newDescription,
          Number(section_id)
        ]
      );

    return sendSuccessResponse(
      res,
      200,
      "Section updated successfully",
      result.rows[0]
    );

  } catch (error) {
    console.error(
      "Update section error:",
      error
    );

    if (error.code === "23505") {
      return sendErrorResponse(
        res,
        409,
        "Section already exists"
      );
    }

    const message =
      process.env.NODE_ENV === "development"
        ? error.message
        : "Failed to update section";

    return sendErrorResponse(
      res,
      500,
      message
    );
  }
}

export async function updateSectionStatus(
  req,
  res
) {
  try {
    const { section_id } =
      req.params;

    const { is_active } =
      req.body || {};

    if (
      !section_id ||
      !/^\d+$/.test(section_id) ||
      Number(section_id) <= 0
    ) {
      return sendErrorResponse(
        res,
        400,
        `Section ID ${section_id} is invalid`
      );
    }

    if (
      typeof is_active !== "boolean"
    ) {
      return sendErrorResponse(
        res,
        400,
        "is_active is required and must be a boolean"
      );
    }

    const result =
      await pool.query(
        `
          UPDATE tbl_sections
          SET
            is_active = $1,
            updated_at = CURRENT_TIMESTAMP
          WHERE section_id = $2
          RETURNING
            section_id,
            section_name,
            description,
            is_active,
            created_at,
            updated_at
        `,
        [
          is_active,
          Number(section_id)
        ]
      );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Section ID ${section_id} not found`
      );
    }

    return sendSuccessResponse(
      res,
      200,
      `Section ${is_active
        ? "activated"
        : "deactivated"
      } successfully`,
      result.rows[0]
    );

  } catch (error) {
    console.error(
      "Update section status error:",
      error
    );

    const message =
      process.env.NODE_ENV === "development"
        ? error.message
        : "Failed to update section status";

    return sendErrorResponse(
      res,
      500,
      message
    );
  }
}