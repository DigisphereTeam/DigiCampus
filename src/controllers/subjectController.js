import pool from "../config/database.js";
import { sendErrorResponse, sendSuccessResponse } from "../utils/response.js";
import { isValidId } from "../utils/validation.js";

export const createBulkSubjects = async (req, res) => {
  const client = await pool.connect();

  try {
    const { subjects } = req.body;

    await client.query("BEGIN");

    const subjectNames = subjects.map((subject) =>
      subject.subject_name.trim().toLowerCase()
    );

    const existingSubjects = await client.query(
      `
      SELECT subject_name
      FROM tbl_subjects
      WHERE LOWER(subject_name) = ANY($1::text[])
      `,
      [subjectNames]
    );

    const existingSubjectNames = new Set(
      existingSubjects.rows.map((row) =>
        row.subject_name.toLowerCase()
      )
    );

    const newSubjects = subjects.filter(
      (subject) =>
        !existingSubjectNames.has(
          subject.subject_name.trim().toLowerCase()
        )
    );

    if (newSubjects.length === 0) {
      await client.query("COMMIT");

      return sendSuccessResponse(
        res,
        200,
        "All subjects already exist",
        []
      );
    }

    const existingCodes = await client.query(
      `
      SELECT subject_code
      FROM tbl_subjects
      `
    );

    const usedCodes = new Set(
      existingCodes.rows.map((row) => row.subject_code)
    );

    const subjectsToInsert = newSubjects.map((subject) => {
      const subjectName = subject.subject_name.trim();

      const baseCode = subjectName
        .replace(/[^A-Za-z]/g, "")
        .substring(0, 3)
        .toUpperCase();

      let subjectCode = baseCode;
      let count = 1;

      while (usedCodes.has(subjectCode)) {
        subjectCode = `${baseCode}${String(count).padStart(3, "0")}`;
        count++;
      }

      usedCodes.add(subjectCode);

      return {
        subject_name: subjectName,
        subject_code: subjectCode,
        description: subject.description?.trim() || null
      };
    });

    const values = [];
    const placeholders = [];

    subjectsToInsert.forEach((subject, index) => {
      const position = index * 3;

      placeholders.push(
        `($${position + 1}, $${position + 2}, $${position + 3}, true)`
      );

      values.push(
        subject.subject_name,
        subject.subject_code,
        subject.description
      );
    });

    const result = await client.query(
      `
      INSERT INTO tbl_subjects (
        subject_name,
        subject_code,
        description,
        is_active
      )
      VALUES ${placeholders.join(", ")}
      RETURNING
        subject_id,
        subject_name,
        subject_code,
        description,
        is_active,
        created_at,
        updated_at
      `,
      values
    );

    await client.query("COMMIT");

    return sendSuccessResponse(
      res,
      201,
      "Subjects created successfully",
      result.rows
    );
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("createBulkSubjects error:", error);

    return sendErrorResponse(
      res,
      500,
      "Failed to create subjects"
    );
  } finally {
    client.release();
  }
};

export const createSubject = async (req, res) => {
  try {
    const { subject_name, description } = req.body;

    const existingSubject = await pool.query(
      `
      SELECT subject_id
      FROM tbl_subjects
      WHERE LOWER(subject_name) = LOWER($1)
      LIMIT 1
      `,
      [subject_name.trim()]
    );

    if (existingSubject.rows.length > 0) {
      return sendErrorResponse(res, 409, "Subject already exists");
    }

    const baseCode = subject_name
      .trim()
      .replace(/[^A-Za-z]/g, "")
      .substring(0, 3)
      .toUpperCase();

    const codeResult = await pool.query(
      `
      SELECT subject_code
      FROM tbl_subjects
      WHERE subject_code LIKE $1
      ORDER BY subject_code DESC
      LIMIT 1
      `,
      [`${baseCode}%`]
    );

    let subjectCode = baseCode;

    if (codeResult.rows.length > 0) {
      const lastCode = codeResult.rows[0].subject_code;
      const number = parseInt(lastCode.replace(baseCode, ""), 10) || 0;

      subjectCode = `${baseCode}${String(number + 1).padStart(3, "0")}`;
    }

    const result = await pool.query(
      `
      INSERT INTO tbl_subjects (
        subject_name,
        subject_code,
        description,
        is_active
      )
      VALUES ($1, $2, $3, true)
      RETURNING
        subject_id,
        subject_name,
        subject_code,
        description,
        is_active,
        created_at,
        updated_at
      `,
      [
        subject_name.trim(),
        subjectCode,
        description?.trim() || null
      ]
    );

    return sendSuccessResponse(
      res,
      201,
      "Subject created successfully",
      result.rows[0]
    );
  } catch (error) {
    console.error("createSubject error:", error);

    if (error.code === "23505") {
      return sendErrorResponse(res, 409, "Subject code already exists");
    }

    return sendErrorResponse(
      res,
      500,
      "Failed to create subject"
    );
  }
};

export const getSubjects = async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        subject_id,
        subject_name,
        subject_code,
        description,
        is_active,
        created_at,
        updated_at
      FROM tbl_subjects
      WHERE is_active = true
      ORDER BY subject_name ASC
      `
    );

    return sendSuccessResponse(
      res,
      200,
      "Subjects retrieved successfully",
      result.rows
    );
  } catch (error) {
    console.error("getSubjects error:", error);

    return sendErrorResponse(
      res,
      500,
      "Failed to retrieve subjects"
    );
  }
};

export const getSubjectById = async (req, res) => {
  try {
    const { subject_id } = req.params;

    if (!isValidId(subject_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid subject ID is required"
      );
    }

    const result = await pool.query(
      `
      SELECT
        subject_id,
        subject_name,
        subject_code,
        description,
        is_active,
        created_at,
        updated_at
      FROM tbl_subjects
      WHERE subject_id = $1
      `,
      [subject_id]
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Subject with ID ${subject_id} not found`
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Subject retrieved successfully",
      result.rows[0]
    );
  } catch (error) {
    console.error("getSubjectById error:", error);

    return sendErrorResponse(
      res,
      500,
      "Failed to retrieve subject"
    );
  }
};

export const updateSubject = async (req, res) => {
  try {
    const { subject_id } = req.params;
    const { subject_name, description } = req.body;

    if (!isValidId(subject_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid subject ID is required"
      );
    }

    const existingSubject = await pool.query(
      `
      SELECT subject_id
      FROM tbl_subjects
      WHERE subject_id = $1
        AND is_active = TRUE
      `,
      [subject_id]
    );

    if (existingSubject.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Active subject with ID ${subject_id} not found`
      );
    }

    if (subject_name !== undefined) {
      const duplicateSubject = await pool.query(
        `
        SELECT subject_id
        FROM tbl_subjects
        WHERE LOWER(subject_name) = LOWER($1)
          AND subject_id != $2
          AND is_active = TRUE
        LIMIT 1
        `,
        [subject_name.trim(), subject_id]
      );

      if (duplicateSubject.rows.length > 0) {
        return sendErrorResponse(
          res,
          409,
          "Subject already exists"
        );
      }
    }

    const fields = [];
    const values = [];
    let index = 1;

    if (subject_name !== undefined) {
      fields.push(`subject_name = $${index++}`);
      values.push(subject_name.trim());
    }

    if (description !== undefined) {
      fields.push(`description = $${index++}`);
      values.push(description?.trim() || null);
    }

    if (fields.length === 0) {
      return sendErrorResponse(
        res,
        400,
        "At least one field is required to update"
      );
    }

    fields.push("updated_at = CURRENT_TIMESTAMP");

    values.push(subject_id);

    const result = await pool.query(
      `
      UPDATE tbl_subjects
      SET ${fields.join(", ")}
      WHERE subject_id = $${index}
        AND is_active = TRUE
      RETURNING
        subject_id,
        subject_name,
        subject_code,
        description,
        is_active,
        created_at,
        updated_at
      `,
      values
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Active subject with ID ${subject_id} not found`
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Subject updated successfully",
      result.rows[0]
    );
  } catch (error) {
    console.error(
      "updateSubject error:",
      error
    );

    return sendErrorResponse(
      res,
      500,
      "Failed to update subject"
    );
  }
};

export const deleteSubject = async (req, res) => {
  try {
    const { subject_id } = req.params;

    if (!isValidId(subject_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid subject ID is required"
      );
    }

    const result = await pool.query(
      `
      UPDATE tbl_subjects
      SET
        is_active = false,
        updated_at = CURRENT_TIMESTAMP
      WHERE subject_id = $1
      AND is_active = true
      RETURNING subject_id
      `,
      [subject_id]
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Subject with ID ${subject_id} not found`
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Subject deleted successfully"
    );
  } catch (error) {
    console.error("deleteSubject error:", error);

    return sendErrorResponse(
      res,
      500,
      "Failed to delete subject"
    );
  }
};