import pool from "../config/database.js";
import {
  sendSuccessResponse,
  sendErrorResponse,
} from "../utils/response.js";

export const createSubject = async (req, res) => {
  const {
    subject_code,
    subject_name,
    description,
  } = req.body;

  if (!subject_code || !subject_name) {
    return sendErrorResponse(
      res,
      400,
      "Subject code and subject name are required."
    );
  }

  if (!subject_code.trim() || !subject_name.trim()) {
    return sendErrorResponse(
      res,
      400,
      "Subject code and subject name cannot be empty."
    );
  }

  try {
    const existingSubject = await pool.query(
      `
      SELECT subject_id
      FROM tbl_subjects
      WHERE LOWER(subject_code) = LOWER($1)
         OR LOWER(subject_name) = LOWER($2)
      LIMIT 1
      `,
      [
        subject_code.trim(),
        subject_name.trim(),
      ]
    );

    if (existingSubject.rowCount > 0) {
      return sendErrorResponse(
        res,
        409,
        "Subject code or subject name already exists."
      );
    }

    const result = await pool.query(
      `
      INSERT INTO tbl_subjects
      (
        subject_code,
        subject_name,
        description
      )
      VALUES
      ($1, $2, $3)
      RETURNING *;
      `,
      [
        subject_code.trim(),
        subject_name.trim(),
        description?.trim() || null,
      ]
    );

    return sendSuccessResponse(
      res,
      201,
      "Subject created successfully.",
      result.rows[0]
    );
  } catch (error) {
    console.error(
      "Create Subject Error:",
      error
    );

    return sendErrorResponse(
      res,
      500,
      error.message ||
        "Failed to create subject."
    );
  }
};

export const getAllSubjects = async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        subject_id,
        subject_code,
        subject_name,
        description,
        is_active,
        created_at,
        updated_at
      FROM tbl_subjects
      ORDER BY subject_id DESC;
      `
    );

    return sendSuccessResponse(
      res,
      200,
      "Subjects fetched successfully.",
      result.rows
    );
  } catch (error) {
    console.error(
      "Get All Subjects Error:",
      error
    );

    return sendErrorResponse(
      res,
      500,
      error.message ||
        "Failed to fetch subjects."
    );
  }
};

export const getSubjectById = async (req, res) => {
  const { subject_id } = req.params;

  if (
    !subject_id ||
    isNaN(subject_id) ||
    Number(subject_id) <= 0
  ) {
    return sendErrorResponse(
      res,
      400,
      "Valid subject ID is required."
    );
  }

  try {
    const result = await pool.query(
      `
      SELECT
        subject_id,
        subject_code,
        subject_name,
        description,
        is_active,
        created_at,
        updated_at
      FROM tbl_subjects
      WHERE subject_id = $1;
      `,
      [subject_id]
    );

    if (result.rowCount === 0) {
      return sendErrorResponse(
        res,
        404,
        "Subject not found."
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Subject fetched successfully.",
      result.rows[0]
    );
  } catch (error) {
    console.error(
      "Get Subject By ID Error:",
      error
    );

    return sendErrorResponse(
      res,
      500,
      error.message ||
        "Failed to fetch subject."
    );
  }
};

export const updateSubject = async (req, res) => {
  const { subject_id } = req.params;

  if (
    !subject_id ||
    isNaN(subject_id) ||
    Number(subject_id) <= 0
  ) {
    return sendErrorResponse(
      res,
      400,
      "Valid subject ID is required."
    );
  }

  const {
    subject_code,
    subject_name,
    description,
    is_active,
  } = req.body;

  if (
    subject_code === undefined &&
    subject_name === undefined &&
    description === undefined &&
    is_active === undefined
  ) {
    return sendErrorResponse(
      res,
      400,
      "At least one field is required to update."
    );
  }

  if (
    subject_code !== undefined &&
    !subject_code.trim()
  ) {
    return sendErrorResponse(
      res,
      400,
      "Subject code cannot be empty."
    );
  }

  if (
    subject_name !== undefined &&
    !subject_name.trim()
  ) {
    return sendErrorResponse(
      res,
      400,
      "Subject name cannot be empty."
    );
  }

  if (
    is_active !== undefined &&
    typeof is_active !== "boolean"
  ) {
    return sendErrorResponse(
      res,
      400,
      "is_active must be true or false."
    );
  }

  try {
    const subjectCheck = await pool.query(
      `
      SELECT subject_id
      FROM tbl_subjects
      WHERE subject_id = $1;
      `,
      [subject_id]
    );

    if (subjectCheck.rowCount === 0) {
      return sendErrorResponse(
        res,
        404,
        "Subject not found."
      );
    }

    if (
      subject_code !== undefined ||
      subject_name !== undefined
    ) {
      const duplicateSubject =
        await pool.query(
          `
          SELECT subject_id
          FROM tbl_subjects
          WHERE subject_id != $1
          AND (
            (
              $2 IS NOT NULL
              AND LOWER(subject_code) = LOWER($2)
            )
            OR
            (
              $3 IS NOT NULL
              AND LOWER(subject_name) = LOWER($3)
            )
          )
          LIMIT 1;
          `,
          [
            subject_id,
            subject_code?.trim() || null,
            subject_name?.trim() || null,
          ]
        );

      if (duplicateSubject.rowCount > 0) {
        return sendErrorResponse(
          res,
          409,
          "Subject code or subject name already exists."
        );
      }
    }

    const result = await pool.query(
      `
      UPDATE tbl_subjects
      SET
        subject_code = COALESCE($1, subject_code),
        subject_name = COALESCE($2, subject_name),
        description = COALESCE($3, description),
        is_active = COALESCE($4, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE subject_id = $5
      RETURNING *;
      `,
      [
        subject_code?.trim() || null,
        subject_name?.trim() || null,
        description !== undefined
          ? description?.trim() || null
          : null,
        is_active ?? null,
        subject_id,
      ]
    );

    return sendSuccessResponse(
      res,
      200,
      "Subject updated successfully.",
      result.rows[0]
    );
  } catch (error) {
    console.error(
      "Update Subject Error:",
      error
    );

    return sendErrorResponse(
      res,
      500,
      error.message ||
        "Failed to update subject."
    );
  }
};

export const deleteSubject = async (req, res) => {
  const { subject_id } = req.params;

  if (
    !subject_id ||
    isNaN(subject_id) ||
    Number(subject_id) <= 0
  ) {
    return sendErrorResponse(
      res,
      400,
      "Valid subject ID is required."
    );
  }

  try {
    const result = await pool.query(
      `
      UPDATE tbl_subjects
      SET
        is_active = FALSE,
        updated_at = CURRENT_TIMESTAMP
      WHERE subject_id = $1
      RETURNING *;
      `,
      [subject_id]
    );

    if (result.rowCount === 0) {
      return sendErrorResponse(
        res,
        404,
        "Subject not found."
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Subject deleted successfully.",
      result.rows[0]
    );
  } catch (error) {
    console.error(
      "Delete Subject Error:",
      error
    );

    return sendErrorResponse(
      res,
      500,
      error.message ||
        "Failed to delete subject."
    );
  }
};