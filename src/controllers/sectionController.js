import pool from "../config/database.js";

import {
  sendErrorResponse,
  sendSuccessResponse,
} from "../utils/response.js";

import { isValidId } from "../utils/validation.js";

export const bulkCreateSections = async (req, res, next) => {
  const client = await pool.connect();

  try {
    const { sections } = req.body;

    if (!Array.isArray(sections) || sections.length === 0) {
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

    sections.forEach((section, index) => {
      const normalizedName = section.section_name
        .trim()
        .toLowerCase();

      if (names.includes(normalizedName)) {
        errors[`sections[${index}].section_name`] =
          `Duplicate section '${section.section_name}' in request`;

        return;
      }

      names.push(normalizedName);

      const nameIndex = values.length + 1;
      const descriptionIndex = values.length + 2;

      values.push(
        section.section_name,
        section.description || null
      );

      placeholders.push(
        `($${nameIndex}, $${descriptionIndex})`
      );
    });

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

    const insertedNames = [];

    result.rows.forEach((row) => {
      insertedNames.push(row.section_name.toLowerCase());
    });

    const skippedSections = [];

    names.forEach((name) => {
      if (!insertedNames.includes(name)) {
        skippedSections.push(name);
      }
    });

    return sendSuccessResponse(
      res,
      201,
      "Sections processed successfully",
      {
        inserted_count: result.rows.length,
        skipped_count: skippedSections.length,
        skipped_sections: skippedSections,
        sections: result.rows,
      }
    );
  } catch (error) {
    await client.query("ROLLBACK");
    next(error);
  } finally {
    client.release();
  }
};

export const createSection = async (req, res, next) => {
  try {
    const {
      section_name,
      description,
    } = req.body;

    const existingSection = await pool.query(
      `
        SELECT section_id
        FROM tbl_sections
        WHERE LOWER(section_name) = LOWER($1)
        LIMIT 1
      `,
      [section_name]
    );

    if (existingSection.rows.length > 0) {
      return sendErrorResponse(
        res,
        409,
        "Section already exists"
      );
    }

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
        section_name,
        description || null,
      ]
    );

    return sendSuccessResponse(
      res,
      201,
      "Section created successfully",
      result.rows[0]
    );
  } catch (error) {
    next(error);
  }
};

export const getAllSections = async (req, res, next) => {
  try {
    const { is_active } = req.query;

    const values = [];
    let condition = "";

    if (is_active !== undefined) {
      values.push(is_active === "true");

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
    next(error);
  }
};

export const getSectionById = async (req, res, next) => {
  try {
    const { section_id } = req.params;

    if (!isValidId(section_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid section ID is required"
      );
    }

    const sectionId = Number(section_id);

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
      [sectionId]
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Section with ID ${sectionId} not found`
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Section fetched successfully",
      result.rows[0]
    );
  } catch (error) {
    next(error);
  }
};

export const updateSection = async (req, res, next) => {
  try {
    const { section_id } = req.params;

    const {
      section_name,
      description,
    } = req.body;

    if (!isValidId(section_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid section ID is required"
      );
    }

    const sectionId = Number(section_id);

    const existingSection = await pool.query(
      `
        SELECT
          section_id,
          section_name,
          description,
          is_active
        FROM tbl_sections
        WHERE section_id = $1
        LIMIT 1
      `,
      [sectionId]
    );

    if (existingSection.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Section with ID ${sectionId} not found`
      );
    }

    if (section_name !== undefined) {
      const duplicateSection = await pool.query(
        `
          SELECT section_id
          FROM tbl_sections
          WHERE LOWER(section_name) = LOWER($1)
          AND section_id != $2
          LIMIT 1
        `,
        [
          section_name,
          sectionId,
        ]
      );

      if (duplicateSection.rows.length > 0) {
        return sendErrorResponse(
          res,
          409,
          "Section with this name already exists"
        );
      }
    }

    const fields = [];
    const values = [];

    if (section_name !== undefined) {
      fields.push(`section_name = $${values.length + 1}`);
      values.push(section_name);
    }

    if (description !== undefined) {
      fields.push(`description = $${values.length + 1}`);
      values.push(description);
    }

    if (fields.length === 0) {
      return sendErrorResponse(
        res,
        400,
        "At least one field is required for update"
      );
    }

    fields.push("updated_at = CURRENT_TIMESTAMP");

    values.push(sectionId);

    const result = await pool.query(
      `
        UPDATE tbl_sections
        SET ${fields.join(", ")}
        WHERE section_id = $${values.length}
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

    return sendSuccessResponse(
      res,
      200,
      "Section updated successfully",
      result.rows[0]
    );
  } catch (error) {
    next(error);
  }
};

export const updateSectionStatus = async (req, res, next) => {
  try {
    const { section_id } = req.params;
    const { is_active } = req.body;

    if (!isValidId(section_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid section ID is required"
      );
    }

    const sectionId = Number(section_id);

    const result = await pool.query(
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
        sectionId,
      ]
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Section with ID ${sectionId} not found`
      );
    }

    return sendSuccessResponse(
      res,
      200,
      `Section ${is_active ? "activated" : "deactivated"
      } successfully`,
      result.rows[0]
    );
  } catch (error) {
    next(error);
  }
};