import pool from "../config/database.js";

import {
  sendErrorResponse,
  sendSuccessResponse
} from "../utils/response.js";
import { isValidId } from "../utils/validation.js";

export async function bulkCreateClassSections(req, res) {
  const client = await pool.connect();

  try {
    const {
      academic_year_id,
      sections,
    } = req.body;

    const values = [];
    const placeholders = [];

    for (const section of sections) {
      const {
        class_id,
        section_id,
        room_number,
      } = section;

      const index = values.length;

      values.push(
        academic_year_id,
        class_id,
        section_id,
        room_number
      );

      placeholders.push(
        `($${index + 1}, $${index + 2}, $${index + 3}, $${index + 4})`
      );
    }

    await client.query("BEGIN");

    const result = await client.query(
      `
      INSERT INTO tbl_class_sections (
        academic_year_id,
        class_id,
        section_id,
        room_number
      )
      VALUES ${placeholders.join(", ")}
      ON CONFLICT (
        academic_year_id,
        class_id,
        section_id
      )
      DO NOTHING
      RETURNING
        class_section_id,
        academic_year_id,
        class_id,
        section_id,
        room_number,
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
      "Class sections processed successfully",
      {
        inserted_count: result.rows.length,
        skipped_count:
          sections.length - result.rows.length,
        class_sections: result.rows,
      }
    );
  } catch (error) {
    await client.query("ROLLBACK");

    console.error(
      "Bulk create class sections error:",
      error
    );

    if (error.code === "23503") {
      return sendErrorResponse(
        res,
        400,
        "Invalid academic year, class or section ID"
      );
    }

    if (error.code === "23505") {
      return sendErrorResponse(
        res,
        409,
        "Duplicate class section"
      );
    }

    const message =
      process.env.NODE_ENV === "development"
        ? error.message
        : "Failed to create class sections";

    return sendErrorResponse(
      res,
      500,
      message
    );
  } finally {
    client.release();
  }
}

export async function createClassSection(req, res) {
  const client = await pool.connect();

  try {
    const {
      academic_year_id,
      class_id,
      section_id,
      room_number,
    } = req.body;

    const academicYearResult = await client.query(
      `
      SELECT academic_year_id
      FROM tbl_academic_years
      WHERE academic_year_id = $1
        AND is_active = TRUE
      LIMIT 1
      `,
      [academic_year_id]
    );

    if (academicYearResult.rowCount === 0) {
      return sendErrorResponse(
        res,
        404,
        `Academic year ID ${academic_year_id} not found or inactive`
      );
    }

    const classResult = await client.query(
      `
      SELECT class_id
      FROM tbl_classes
      WHERE class_id = $1
        AND is_active = TRUE
      LIMIT 1
      `,
      [class_id]
    );

    if (classResult.rowCount === 0) {
      return sendErrorResponse(
        res,
        404,
        `Class ID ${class_id} not found or inactive`
      );
    }

    const sectionResult = await client.query(
      `
      SELECT section_id
      FROM tbl_sections
      WHERE section_id = $1
        AND is_active = TRUE
      LIMIT 1
      `,
      [section_id]
    );

    if (sectionResult.rowCount === 0) {
      return sendErrorResponse(
        res,
        404,
        `Section ID ${section_id} not found or inactive`
      );
    }

    await client.query("BEGIN");

    const result = await client.query(
      `
      INSERT INTO tbl_class_sections (
        academic_year_id,
        class_id,
        section_id,
        room_number
      )
      VALUES ($1, $2, $3, $4)
      RETURNING
        class_section_id,
        academic_year_id,
        class_id,
        section_id,
        room_number,
        is_active,
        created_at,
        updated_at
      `,
      [
        academic_year_id,
        class_id,
        section_id,
        room_number,
      ]
    );

    await client.query("COMMIT");

    return sendSuccessResponse(
      res,
      201,
      "Class section created successfully",
      result.rows[0]
    );
  } catch (error) {
    await client.query("ROLLBACK");

    console.error(
      "Create class section error:",
      error
    );

    if (error.code === "23505") {
      return sendErrorResponse(
        res,
        409,
        "This class and section already exists for the selected academic year"
      );
    }

    if (error.code === "23503") {
      return sendErrorResponse(
        res,
        400,
        "Invalid academic year, class or section"
      );
    }

    const message =
      process.env.NODE_ENV === "development"
        ? error.message
        : "Failed to create class section";

    return sendErrorResponse(
      res,
      500,
      message
    );
  } finally {
    client.release();
  }
}

export async function getAllClassSections(req, res) {
  try {
    const {
      academic_year_id,
      class_id,
      section_id,
      is_active,
    } = req.query;

    const values = [];
    const conditions = [];

    if (academic_year_id !== undefined) {
      values.push(Number(academic_year_id));

      conditions.push(
        `cs.academic_year_id = $${values.length}`
      );
    }

    if (class_id !== undefined) {
      values.push(Number(class_id));

      conditions.push(
        `cs.class_id = $${values.length}`
      );
    }

    if (section_id !== undefined) {
      values.push(Number(section_id));

      conditions.push(
        `cs.section_id = $${values.length}`
      );
    }

    if (is_active !== undefined) {
      values.push(is_active === "true");

      conditions.push(
        `cs.is_active = $${values.length}`
      );
    }

    const whereClause =
      conditions.length > 0
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

    const result = await pool.query(
      `
      SELECT
        cs.class_section_id,
        cs.academic_year_id,
        ay.academic_year,
        cs.class_id,
        c.class_name,
        cs.section_id,
        s.section_name,
        cs.room_number,
        cs.is_active,
        cs.created_at,
        cs.updated_at
      FROM tbl_class_sections cs
      INNER JOIN tbl_academic_years ay
        ON ay.academic_year_id = cs.academic_year_id
      INNER JOIN tbl_classes c
        ON c.class_id = cs.class_id
      INNER JOIN tbl_sections s
        ON s.section_id = cs.section_id
      ${whereClause}
      ORDER BY
        ay.start_date DESC,
        c.class_id ASC,
        s.section_name ASC
      `,
      values
    );

    return sendSuccessResponse(
      res,
      200,
      "Class sections fetched successfully",
      {
        filters: {
          academic_year_id:
            academic_year_id !== undefined
              ? Number(academic_year_id)
              : null,
          class_id:
            class_id !== undefined
              ? Number(class_id)
              : null,
          section_id:
            section_id !== undefined
              ? Number(section_id)
              : null,
          is_active:
            is_active !== undefined
              ? is_active === "true"
              : null,
        },
        records: result.rows,
      }
    );
  } catch (error) {
    console.error(
      "Get class sections error:",
      error
    );

    const message =
      process.env.NODE_ENV === "development"
        ? error.message
        : "Failed to fetch class sections";

    return sendErrorResponse(
      res,
      500,
      message
    );
  }
}

export async function getClassSectionById(req, res) {
  try {
    const { class_section_id } = req.params;

    if (!isValidId(class_section_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid class section ID is required"
      );
    }

    const result = await pool.query(
      `
      SELECT
        cs.class_section_id,
        cs.academic_year_id,
        ay.academic_year,
        cs.class_id,
        c.class_name,
        cs.section_id,
        s.section_name,
        cs.room_number,
        cs.is_active,
        cs.created_at,
        cs.updated_at
      FROM tbl_class_sections cs
      INNER JOIN tbl_academic_years ay
        ON ay.academic_year_id = cs.academic_year_id
      INNER JOIN tbl_classes c
        ON c.class_id = cs.class_id
      INNER JOIN tbl_sections s
        ON s.section_id = cs.section_id
      WHERE cs.class_section_id = $1
      LIMIT 1
      `,
      [Number(class_section_id)]
    );

    if (result.rowCount === 0) {
      return sendErrorResponse(
        res,
        404,
        `Class section with ID ${class_section_id} not found`
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Class section fetched successfully",
      result.rows[0]
    );
  } catch (error) {
    console.error(
      "Get class section error:",
      error
    );

    const message =
      process.env.NODE_ENV === "development"
        ? error.message
        : "Failed to fetch class section";

    return sendErrorResponse(
      res,
      500,
      message
    );
  }
}

export async function updateClassSection(req, res) {
  const client = await pool.connect();

  try {
    const { class_section_id } = req.params;

    const {
      class_teacher_id,
      room_number
    } = req.body || {};

    if (
      !class_section_id ||
      !/^\d+$/.test(class_section_id) ||
      Number(class_section_id) <= 0
    ) {
      return sendErrorResponse(
        res,
        400,
        `Class section ID ${class_section_id} is invalid`
      );
    }

    const classSectionId = Number(class_section_id);

    if (
      class_teacher_id === undefined &&
      room_number === undefined
    ) {
      return sendErrorResponse(
        res,
        400,
        "At least one field is required"
      );
    }

    if (
      class_teacher_id !== undefined &&
      class_teacher_id !== null &&
      class_teacher_id !== ""
    ) {
      if (
        !Number.isInteger(Number(class_teacher_id)) ||
        Number(class_teacher_id) <= 0
      ) {
        return sendErrorResponse(
          res,
          400,
          "Class teacher ID must be a valid positive integer"
        );
      }
    }

    if (
      room_number !== undefined &&
      room_number !== null &&
      room_number !== ""
    ) {
      if (
        typeof room_number !== "string" ||
        room_number.trim().length === 0 ||
        room_number.trim().length > 50
      ) {
        return sendErrorResponse(
          res,
          400,
          "Room number must be a valid string with maximum 50 characters"
        );
      }
    }

    const existingResult = await pool.query(
      `
        SELECT
          class_section_id,
          class_teacher_id,
          room_number
        FROM tbl_class_sections
        WHERE class_section_id = $1
        LIMIT 1
      `,
      [classSectionId]
    );

    if (existingResult.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Class section ID ${classSectionId} not found`
      );
    }

    const existingClassSection =
      existingResult.rows[0];

    const oldTeacherId =
      existingClassSection.class_teacher_id;

    let newTeacherId = oldTeacherId;

    if (class_teacher_id !== undefined) {
      newTeacherId =
        class_teacher_id === null ||
          class_teacher_id === ""
          ? null
          : Number(class_teacher_id);
    }

    const teacherChanged =
      class_teacher_id !== undefined &&
      Number(oldTeacherId) !== Number(newTeacherId);

    if (
      teacherChanged &&
      newTeacherId !== null
    ) {
      const teacherResult = await pool.query(
        `
          SELECT employee_id
          FROM tbl_employees
          WHERE employee_id = $1
            AND employee_type = 'TEACHER'
            AND is_active = TRUE
          LIMIT 1
        `,
        [newTeacherId]
      );

      if (teacherResult.rows.length === 0) {
        return sendErrorResponse(
          res,
          404,
          `Teacher ID ${newTeacherId} not found or inactive`
        );
      }
    }

    let newRoomNumber =
      existingClassSection.room_number;

    if (room_number !== undefined) {
      newRoomNumber =
        room_number === null ||
          room_number === ""
          ? null
          : room_number.trim();
    }

    await client.query("BEGIN");

    const updateResult = await client.query(
      `
        UPDATE tbl_class_sections
        SET
          class_teacher_id = $1,
          room_number = $2,
          updated_at = CURRENT_TIMESTAMP
        WHERE class_section_id = $3
        RETURNING
          class_section_id,
          academic_year_id,
          class_id,
          section_id,
          class_teacher_id,
          room_number,
          is_active,
          created_at,
          updated_at
      `,
      [
        newTeacherId,
        newRoomNumber,
        classSectionId
      ]
    );

    if (teacherChanged) {
      if (oldTeacherId !== null) {
        await client.query(
          `
            UPDATE tbl_class_section_teachers
            SET
              end_date = CURRENT_DATE,
              is_current = FALSE,
              updated_at = CURRENT_TIMESTAMP
            WHERE class_section_id = $1
              AND is_current = TRUE
          `,
          [classSectionId]
        );
      }

      if (newTeacherId !== null) {
        await client.query(
          `
            INSERT INTO tbl_class_section_teachers (
              class_section_id,
              teacher_id,
              start_date,
              end_date,
              is_current,
              created_at,
              updated_at
            )
            VALUES (
              $1,
              $2,
              CURRENT_DATE,
              NULL,
              TRUE,
              CURRENT_TIMESTAMP,
              CURRENT_TIMESTAMP
            )
          `,
          [
            classSectionId,
            newTeacherId
          ]
        );
      }
    }

    await client.query("COMMIT");

    return sendSuccessResponse(
      res,
      200,
      teacherChanged
        ? "Class section and teacher assignment updated successfully"
        : "Class section updated successfully",
      updateResult.rows[0]
    );
  } catch (error) {
    await client.query("ROLLBACK");

    console.error(
      "Update class section error:",
      error
    );

    if (error.code === "23503") {
      return sendErrorResponse(
        res,
        400,
        "Invalid teacher or class section reference"
      );
    }

    const message =
      process.env.NODE_ENV === "development"
        ? error.message
        : "Failed to update class section";

    return sendErrorResponse(
      res,
      500,
      message
    );
  } finally {
    client.release();
  }
}


export async function updateClassSectionStatus(req, res) {
  try {
    const { class_section_id } = req.params;
    const { is_active } = req.body || {};

    if (
      !class_section_id ||
      !/^\d+$/.test(class_section_id) ||
      Number(class_section_id) <= 0
    ) {
      return sendErrorResponse(
        res,
        400,
        `Class section ID ${class_section_id} is invalid`
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
        UPDATE tbl_class_sections
        SET
          is_active = $1,
          updated_at = CURRENT_TIMESTAMP
        WHERE class_section_id = $2
        RETURNING
          class_section_id,
          academic_year_id,
          class_id,
          section_id,
          class_teacher_id,
          room_number,
          is_active,
          created_at,
          updated_at
      `,
      [
        is_active,
        Number(class_section_id)
      ]
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Class section ID ${class_section_id} not found`
      );
    }

    return sendSuccessResponse(
      res,
      200,
      `Class section ${is_active ? "activated" : "deactivated"
      } successfully`,
      result.rows[0]
    );
  } catch (error) {
    console.error(
      "Update class section status error:",
      error
    );

    const message =
      process.env.NODE_ENV === "development"
        ? error.message
        : "Failed to update class section status";

    return sendErrorResponse(res, 500, message);
  }
}
