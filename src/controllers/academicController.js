import pool from "../config/database.js";

import {
  sendErrorResponse,
  sendSuccessResponse,
} from "../utils/response.js";

import { isValidId } from "../utils/validation.js";

export const createAcademicYear = async (req, res, next) => {
  const client = await pool.connect();

  try {
    const {
      academic_year,
      start_date,
      end_date,
      is_current,
    } = req.body;

    await client.query("BEGIN");

    const existing = await client.query(
      `
        SELECT academic_year_id
        FROM tbl_academic_years
        WHERE LOWER(academic_year) = LOWER($1)
        LIMIT 1
      `,
      [academic_year]
    );

    if (existing.rows.length > 0) {
      await client.query("ROLLBACK");

      return sendErrorResponse(
        res,
        409,
        `Academic year '${academic_year}' already exists`
      );
    }

    if (is_current === true) {
      await client.query(`
        UPDATE tbl_academic_years
        SET
          is_current = FALSE,
          updated_at = CURRENT_TIMESTAMP
        WHERE is_current = TRUE
      `);
    }

    const result = await client.query(
      `
        INSERT INTO tbl_academic_years (
          academic_year,
          start_date,
          end_date,
          is_current
        )
        VALUES ($1, $2, $3, $4)
        RETURNING
          academic_year_id,
          academic_year,
          start_date,
          end_date,
          is_current,
          is_active,
          created_at,
          updated_at
      `,
      [
        academic_year,
        start_date,
        end_date,
        is_current === true,
      ]
    );

    await client.query("COMMIT");

    return sendSuccessResponse(
      res,
      201,
      "Academic year created successfully",
      result.rows[0]
    );
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23505") {
      return sendErrorResponse(
        res,
        409,
        "Academic year already exists"
      );
    }

    next(error);
  } finally {
    client.release();
  }
};

export const getAllAcademicYears = async (req, res, next) => {
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
          academic_year_id,
          academic_year,
          start_date,
          end_date,
          is_current,
          is_active,
          created_at,
          updated_at
        FROM tbl_academic_years
        ${condition}
        ORDER BY
          start_date DESC,
          academic_year_id DESC
      `,
      values
    );

    return sendSuccessResponse(
      res,
      200,
      "Academic years fetched successfully",
      result.rows
    );
  } catch (error) {
    next(error);
  }
};

export const getCurrentAcademicYear = async (
  req,
  res,
  next
) => {
  try {
    const result = await pool.query(`
      SELECT
        academic_year_id,
        academic_year,
        start_date,
        end_date,
        is_current,
        is_active,
        created_at,
        updated_at
      FROM tbl_academic_years
      WHERE is_current = TRUE
        AND is_active = TRUE
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        "Current academic year not found"
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Current academic year fetched successfully",
      result.rows[0]
    );
  } catch (error) {
    next(error);
  }
};

export const getAcademicYearById = async (
  req,
  res,
  next
) => {
  try {
    const { academic_year_id } = req.params;

    if (!isValidId(academic_year_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid academic year ID is required"
      );
    }

    const academicYearId = Number(academic_year_id);

    const result = await pool.query(
      `
        SELECT
          academic_year_id,
          academic_year,
          start_date,
          end_date,
          is_current,
          is_active,
          created_at,
          updated_at
        FROM tbl_academic_years
        WHERE academic_year_id = $1
        LIMIT 1
      `,
      [academicYearId]
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Academic year with ID ${academicYearId} not found`
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Academic year fetched successfully",
      result.rows[0]
    );
  } catch (error) {
    next(error);
  }
};

export const updateAcademicYear = async (
  req,
  res,
  next
) => {
  const client = await pool.connect();

  try {
    const { academic_year_id } = req.params;

    const {
      academic_year,
      start_date,
      end_date,
      is_current,
      is_active,
    } = req.body;

    if (!isValidId(academic_year_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid academic year ID is required"
      );
    }

    const academicYearId = Number(academic_year_id);

    await client.query("BEGIN");

    const existingResult = await client.query(
      `
        SELECT
          academic_year_id,
          academic_year,
          start_date,
          end_date,
          is_current,
          is_active
        FROM tbl_academic_years
        WHERE academic_year_id = $1
        LIMIT 1
      `,
      [academicYearId]
    );

    if (existingResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return sendErrorResponse(
        res,
        404,
        `Academic year with ID ${academicYearId} not found`
      );
    }

    const existing = existingResult.rows[0];

    const newAcademicYear =
      academic_year !== undefined
        ? academic_year
        : existing.academic_year;

    const newStartDate =
      start_date !== undefined
        ? start_date
        : existing.start_date;

    const newEndDate =
      end_date !== undefined
        ? end_date
        : existing.end_date;

    const fields = [];
    const values = [];

    if (academic_year !== undefined) {
      fields.push(
        `academic_year = $${values.length + 1}`
      );
      values.push(newAcademicYear);
    }

    if (start_date !== undefined) {
      fields.push(
        `start_date = $${values.length + 1}`
      );
      values.push(newStartDate);
    }

    if (end_date !== undefined) {
      fields.push(
        `end_date = $${values.length + 1}`
      );
      values.push(newEndDate);
    }

    if (is_current !== undefined) {
      fields.push(
        `is_current = $${values.length + 1}`
      );
      values.push(is_current);
    }

    if (is_active !== undefined) {
      fields.push(
        `is_active = $${values.length + 1}`
      );
      values.push(is_active);
    }

    if (fields.length === 0) {
      await client.query("ROLLBACK");

      return sendErrorResponse(
        res,
        400,
        "At least one field is required for update"
      );
    }

    if (
      new Date(`${newEndDate}T00:00:00`) <=
      new Date(`${newStartDate}T00:00:00`)
    ) {
      await client.query("ROLLBACK");

      return sendErrorResponse(
        res,
        400,
        "End date must be greater than start date"
      );
    }

    if (academic_year !== undefined) {
      const duplicate = await client.query(
        `
          SELECT academic_year_id
          FROM tbl_academic_years
          WHERE LOWER(academic_year) = LOWER($1)
            AND academic_year_id <> $2
          LIMIT 1
        `,
        [
          newAcademicYear,
          academicYearId,
        ]
      );

      if (duplicate.rows.length > 0) {
        await client.query("ROLLBACK");

        return sendErrorResponse(
          res,
          409,
          `Academic year '${newAcademicYear}' already exists`
        );
      }
    }

    if (is_current === true) {
      await client.query(
        `
          UPDATE tbl_academic_years
          SET
            is_current = FALSE,
            updated_at = CURRENT_TIMESTAMP
          WHERE academic_year_id <> $1
            AND is_current = TRUE
        `,
        [academicYearId]
      );
    }

    fields.push(
      "updated_at = CURRENT_TIMESTAMP"
    );

    values.push(academicYearId);

    const result = await client.query(
      `
        UPDATE tbl_academic_years
        SET ${fields.join(", ")}
        WHERE academic_year_id = $${values.length}
        RETURNING
          academic_year_id,
          academic_year,
          start_date,
          end_date,
          is_current,
          is_active,
          created_at,
          updated_at
      `,
      values
    );

    await client.query("COMMIT");

    return sendSuccessResponse(
      res,
      200,
      "Academic year updated successfully",
      result.rows[0]
    );
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23505") {
      return sendErrorResponse(
        res,
        409,
        "Academic year already exists"
      );
    }

    next(error);
  } finally {
    client.release();
  }
};

export const updateAcademicYearStatus = async (
  req,
  res,
  next
) => {
  try {
    const { academic_year_id } = req.params;
    const { is_active } = req.body;

    if (!isValidId(academic_year_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid academic year ID is required"
      );
    }

    const academicYearId = Number(academic_year_id);

    const result = await pool.query(
      `
        UPDATE tbl_academic_years
        SET
          is_active = $1,
          updated_at = CURRENT_TIMESTAMP
        WHERE academic_year_id = $2
        RETURNING
          academic_year_id,
          academic_year,
          start_date,
          end_date,
          is_current,
          is_active,
          created_at,
          updated_at
      `,
      [
        is_active,
        academicYearId,
      ]
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Academic year with ID ${academicYearId} not found`
      );
    }

    return sendSuccessResponse(
      res,
      200,
      `Academic year ${is_active
        ? "activated"
        : "deactivated"
      } successfully`,
      result.rows[0]
    );
  } catch (error) {
    next(error);
  }
};