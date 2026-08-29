import pool from "../config/database.js";

import {
  sendErrorResponse,
  sendSuccessResponse
} from "../utils/response.js";

function isValidDate(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const [year, month, day] =
    value.split("-").map(Number);

  const date = new Date(
    year,
    month - 1,
    day
  );

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export async function createAcademicYear(req, res) {
  const client = await pool.connect();

  try {
    const {
      academic_year,
      start_date,
      end_date,
      is_current
    } = req.body || {};

    const errors = {};

    if (
      !academic_year ||
      typeof academic_year !== "string" ||
      !academic_year.trim()
    ) {
      errors.academic_year =
        "Academic year is required";
    }

    if (
      !start_date ||
      typeof start_date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(start_date)
    ) {
      errors.start_date =
        "Start date must be in YYYY-MM-DD format";
    } else if (!isValidDate(start_date)) {
      errors.start_date =
        "Start date must be a valid date";
    }

    if (
      !end_date ||
      typeof end_date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(end_date)
    ) {
      errors.end_date =
        "End date must be in YYYY-MM-DD format";
    } else if (!isValidDate(end_date)) {
      errors.end_date =
        "End date must be a valid date";
    }

    if (
      is_current !== undefined &&
      typeof is_current !== "boolean"
    ) {
      errors.is_current =
        "is_current must be a boolean";
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
      new Date(`${end_date}T00:00:00`) <=
      new Date(`${start_date}T00:00:00`)
    ) {
      return sendErrorResponse(
        res,
        400,
        "End date must be greater than start date"
      );
    }

    const cleanAcademicYear =
      academic_year.trim();

    await client.query("BEGIN");

    await client.query(`
      SELECT pg_advisory_xact_lock(
        hashtext('academic_year_creation')
      )
    `);

    const existing = await client.query(
      `
        SELECT academic_year_id
        FROM tbl_academic_years
        WHERE LOWER(academic_year) = LOWER($1)
        LIMIT 1
      `,
      [cleanAcademicYear]
    );

    if (existing.rows.length > 0) {
      await client.query("ROLLBACK");

      return sendErrorResponse(
        res,
        409,
        `Academic year '${cleanAcademicYear}' already exists`
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
        cleanAcademicYear,
        start_date,
        end_date,
        is_current === true
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

    console.error(
      "Create academic year error:",
      error
    );

    if (error.code === "23505") {
      return sendErrorResponse(
        res,
        409,
        "Academic year already exists"
      );
    }

    const message =
      process.env.NODE_ENV === "development"
        ? error.message
        : "Failed to create academic year";

    return sendErrorResponse(
      res,
      500,
      message
    );

  } finally {
    client.release();
  }
}

export async function getAllAcademicYears(req, res) {
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
        ORDER BY start_date DESC,
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
    console.error(
      "Get academic years error:",
      error
    );

    const message =
      process.env.NODE_ENV === "development"
        ? error.message
        : "Failed to fetch academic years";

    return sendErrorResponse(
      res,
      500,
      message
    );
  }
}

export async function getCurrentAcademicYear(
  req,
  res
) {
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
    console.error(
      "Get current academic year error:",
      error
    );

    const message =
      process.env.NODE_ENV === "development"
        ? error.message
        : "Failed to fetch current academic year";

    return sendErrorResponse(
      res,
      500,
      message
    );
  }
}

export async function getAcademicYearById(
  req,
  res
) {
  try {
    const { academic_year_id } = req.params;

    if (
      !academic_year_id ||
      !/^\d+$/.test(academic_year_id) ||
      Number(academic_year_id) <= 0
    ) {
      return sendErrorResponse(
        res,
        400,
        `Academic year ID ${academic_year_id} is invalid`
      );
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
        WHERE academic_year_id = $1
        LIMIT 1
      `,
      [Number(academic_year_id)]
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Academic year ID ${academic_year_id} not found`
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Academic year fetched successfully",
      result.rows[0]
    );

  } catch (error) {
    console.error(
      "Get academic year error:",
      error
    );

    const message =
      process.env.NODE_ENV === "development"
        ? error.message
        : "Failed to fetch academic year";

    return sendErrorResponse(
      res,
      500,
      message
    );
  }
}

export async function updateAcademicYear(
  req,
  res
) {
  const client = await pool.connect();

  try {
    const { academic_year_id } = req.params;

    const {
      academic_year,
      start_date,
      end_date,
      is_current,
      is_active
    } = req.body || {};

    if (
      !academic_year_id ||
      !/^\d+$/.test(academic_year_id) ||
      Number(academic_year_id) <= 0
    ) {
      return sendErrorResponse(
        res,
        400,
        `Academic year ID ${academic_year_id} is invalid`
      );
    }

    const errors = {};

    if (academic_year !== undefined) {
      if (
        typeof academic_year !== "string" ||
        !academic_year.trim()
      ) {
        errors.academic_year =
          "Academic year cannot be empty";
      }
    }

    if (start_date !== undefined) {
      if (
        typeof start_date !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(start_date)
      ) {
        errors.start_date =
          "Start date must be in YYYY-MM-DD format";
      } else if (!isValidDate(start_date)) {
        errors.start_date =
          "Start date must be a valid date";
      }
    }

    if (end_date !== undefined) {
      if (
        typeof end_date !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(end_date)
      ) {
        errors.end_date =
          "End date must be in YYYY-MM-DD format";
      } else if (!isValidDate(end_date)) {
        errors.end_date =
          "End date must be a valid date";
      }
    }

    if (
      is_current !== undefined &&
      typeof is_current !== "boolean"
    ) {
      errors.is_current =
        "is_current must be a boolean";
    }

    if (
      is_active !== undefined &&
      typeof is_active !== "boolean"
    ) {
      errors.is_active =
        "is_active must be a boolean";
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
      academic_year === undefined &&
      start_date === undefined &&
      end_date === undefined &&
      is_current === undefined &&
      is_active === undefined
    ) {
      return sendErrorResponse(
        res,
        400,
        "At least one field is required"
      );
    }

    await client.query("BEGIN");

    const existingResult =
      await client.query(
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
        [Number(academic_year_id)]
      );

    if (existingResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return sendErrorResponse(
        res,
        404,
        `Academic year ID ${academic_year_id} not found`
      );
    }

    const existing =
      existingResult.rows[0];

    const newAcademicYear =
      academic_year !== undefined
        ? academic_year.trim()
        : existing.academic_year;

    const newStartDate =
      start_date !== undefined
        ? start_date
        : existing.start_date;

    const newEndDate =
      end_date !== undefined
        ? end_date
        : existing.end_date;

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
      const duplicate =
        await client.query(
          `
            SELECT academic_year_id
            FROM tbl_academic_years
            WHERE LOWER(academic_year) =
                  LOWER($1)
              AND academic_year_id <> $2
            LIMIT 1
          `,
          [
            newAcademicYear,
            Number(academic_year_id)
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
        [Number(academic_year_id)]
      );
    }

    const result =
      await client.query(
        `
          UPDATE tbl_academic_years
          SET
            academic_year = $1,
            start_date = $2,
            end_date = $3,
            is_current = COALESCE($4, is_current),
            is_active = COALESCE($5, is_active),
            updated_at = CURRENT_TIMESTAMP
          WHERE academic_year_id = $6
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
          newAcademicYear,
          newStartDate,
          newEndDate,
          is_current ?? null,
          is_active ?? null,
          Number(academic_year_id)
        ]
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

    console.error(
      "Update academic year error:",
      error
    );

    if (error.code === "23505") {
      return sendErrorResponse(
        res,
        409,
        "Academic year already exists"
      );
    }

    const message =
      process.env.NODE_ENV === "development"
        ? error.message
        : "Failed to update academic year";

    return sendErrorResponse(
      res,
      500,
      message
    );

  } finally {
    client.release();
  }
}

export async function updateAcademicYearStatus(
  req,
  res
) {
  try {
    const { academic_year_id } = req.params;

    const { is_active } = req.body || {};

    if (
      !academic_year_id ||
      !/^\d+$/.test(academic_year_id) ||
      Number(academic_year_id) <= 0
    ) {
      return sendErrorResponse(
        res,
        400,
        `Academic year ID ${academic_year_id} is invalid`
      );
    }

    if (typeof is_active !== "boolean") {
      return sendErrorResponse(
        res,
        400,
        "is_active is required and must be a boolean"
      );
    }

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
        Number(academic_year_id)
      ]
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Academic year ID ${academic_year_id} not found`
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
    console.error(
      "Update academic year status error:",
      error
    );

    const message =
      process.env.NODE_ENV === "development"
        ? error.message
        : "Failed to update academic year status";

    return sendErrorResponse(
      res,
      500,
      message
    );
  }
}