import pool from "../config/database.js";

import {
  sendErrorResponse,
  sendSuccessResponse
} from "../utils/response.js";

export async function createClassSection(req, res) {
  try {
    const {
      academic_year_id,
      class_id,
      section_id,
      class_teacher_id
    } = req.body || {};

    const errors = {};

    if (
      !academic_year_id ||
      !Number.isInteger(Number(academic_year_id)) ||
      Number(academic_year_id) <= 0
    ) {
      errors.academic_year_id =
        "Academic year ID must be a valid positive integer";
    }

    if (
      !class_id ||
      !Number.isInteger(Number(class_id)) ||
      Number(class_id) <= 0
    ) {
      errors.class_id =
        "Class ID must be a valid positive integer";
    }

    if (
      !section_id ||
      !Number.isInteger(Number(section_id)) ||
      Number(section_id) <= 0
    ) {
      errors.section_id =
        "Section ID must be a valid positive integer";
    }

    if (
      class_teacher_id !== undefined &&
      class_teacher_id !== null &&
      class_teacher_id !== ""
    ) {
      if (
        !Number.isInteger(
          Number(class_teacher_id)
        ) ||
        Number(class_teacher_id) <= 0
      ) {
        errors.class_teacher_id =
          "Class teacher ID must be a valid positive integer";
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

    const academicYearId =
      Number(academic_year_id);

    const classId =
      Number(class_id);

    const sectionId =
      Number(section_id);

    const classTeacherId =
      class_teacher_id !== undefined &&
        class_teacher_id !== null &&
        class_teacher_id !== ""
        ? Number(class_teacher_id)
        : null;

    const academicYearResult =
      await pool.query(
        `
          SELECT academic_year_id
          FROM tbl_academic_years
          WHERE academic_year_id = $1
            AND is_active = TRUE
          LIMIT 1
        `,
        [academicYearId]
      );

    if (
      academicYearResult.rows.length === 0
    ) {
      return sendErrorResponse(
        res,
        404,
        `Academic year ID ${academicYearId} not found or inactive`
      );
    }

    const classResult =
      await pool.query(
        `
          SELECT class_id
          FROM tbl_classes
          WHERE class_id = $1
            AND is_active = TRUE
          LIMIT 1
        `,
        [classId]
      );

    if (classResult.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Class ID ${classId} not found or inactive`
      );
    }

    const sectionResult =
      await pool.query(
        `
          SELECT section_id
          FROM tbl_sections
          WHERE section_id = $1
            AND is_active = TRUE
          LIMIT 1
        `,
        [sectionId]
      );

    if (sectionResult.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Section ID ${sectionId} not found or inactive`
      );
    }

    if (classTeacherId !== null) {
      const teacherResult =
        await pool.query(
          `
            SELECT employee_id
            FROM tbl_employees
            WHERE employee_id = $1
              AND employee_type = 'TEACHER'
              AND is_active = TRUE
            LIMIT 1
          `,
          [classTeacherId]
        );

      if (teacherResult.rows.length === 0) {
        return sendErrorResponse(
          res,
          404,
          `Teacher ID ${classTeacherId} not found or inactive`
        );
      }
    }

    const result =
      await pool.query(
        `
          INSERT INTO tbl_class_sections (
            academic_year_id,
            class_id,
            section_id,
            class_teacher_id
          )
          VALUES ($1, $2, $3, $4)
          RETURNING
            class_section_id,
            academic_year_id,
            class_id,
            section_id,
            class_teacher_id,
            is_active,
            created_at,
            updated_at
        `,
        [
          academicYearId,
          classId,
          sectionId,
          classTeacherId
        ]
      );

    return sendSuccessResponse(
      res,
      201,
      "Class section created successfully",
      result.rows[0]
    );

  } catch (error) {
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
        "Invalid academic year, class, section or teacher"
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
  }
}

export async function bulkCreateClassSections(req, res) {
  const client = await pool.connect();

  try {
    const { academic_year_id, sections } =
      req.body || {};

    const errors = {};

    if (
      !academic_year_id ||
      !Number.isInteger(Number(academic_year_id)) ||
      Number(academic_year_id) <= 0
    ) {
      errors.academic_year_id =
        "Academic year ID must be a valid positive integer";
    }

    if (
      !Array.isArray(sections) ||
      sections.length === 0
    ) {
      errors.sections =
        "Sections must be a non-empty array";
    }

    if (Object.keys(errors).length > 0) {
      return sendErrorResponse(
        res,
        400,
        "Validation failed",
        errors
      );
    }

    const academicYearId =
      Number(academic_year_id);

    const values = [];
    const placeholders = [];
    const combinations = new Set();

    for (let i = 0; i < sections.length; i++) {
      const {
        class_id,
        section_id,
        class_teacher_id
      } = sections[i] || {};

      if (
        !class_id ||
        !Number.isInteger(Number(class_id)) ||
        Number(class_id) <= 0
      ) {
        errors[`sections[${i}].class_id`] =
          "Class ID must be a valid positive integer";
        continue;
      }

      if (
        !section_id ||
        !Number.isInteger(Number(section_id)) ||
        Number(section_id) <= 0
      ) {
        errors[`sections[${i}].section_id`] =
          "Section ID must be a valid positive integer";
        continue;
      }

      if (
        class_teacher_id !== undefined &&
        class_teacher_id !== null &&
        class_teacher_id !== "" &&
        (
          !Number.isInteger(
            Number(class_teacher_id)
          ) ||
          Number(class_teacher_id) <= 0
        )
      ) {
        errors[`sections[${i}].class_teacher_id`] =
          "Class teacher ID must be a valid positive integer";
        continue;
      }

      const classId = Number(class_id);
      const sectionId = Number(section_id);

      const teacherId =
        class_teacher_id !== undefined &&
          class_teacher_id !== null &&
          class_teacher_id !== ""
          ? Number(class_teacher_id)
          : null;

      const combination =
        `${classId}-${sectionId}`;

      if (combinations.has(combination)) {
        errors[`sections[${i}]`] =
          "Duplicate class and section in request";
        continue;
      }

      combinations.add(combination);

      const index = values.length;

      values.push(
        academicYearId,
        classId,
        sectionId,
        teacherId
      );

      placeholders.push(
        `($${index + 1}, $${index + 2}, $${index + 3}, $${index + 4})`
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

    const result = await client.query(
      `
        INSERT INTO tbl_class_sections (
          academic_year_id,
          class_id,
          section_id,
          class_teacher_id
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
          class_teacher_id,
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
        class_sections: result.rows
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
        "Invalid academic year, class, section or teacher ID"
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

export async function getAllClassSections(
  req,
  res
) {
  try {
    const {
      academic_year_id,
      class_id,
      section_id,
      class_teacher_id,
      is_active
    } = req.query;

    const values = [];
    const conditions = [];

    if (academic_year_id !== undefined) {
      if (
        !/^\d+$/.test(academic_year_id) ||
        Number(academic_year_id) <= 0
      ) {
        return sendErrorResponse(
          res,
          400,
          "Invalid academic year ID"
        );
      }

      values.push(
        Number(academic_year_id)
      );

      conditions.push(
        `cs.academic_year_id = $${values.length}`
      );
    }

    if (class_id !== undefined) {
      if (
        !/^\d+$/.test(class_id) ||
        Number(class_id) <= 0
      ) {
        return sendErrorResponse(
          res,
          400,
          "Invalid class ID"
        );
      }

      values.push(Number(class_id));

      conditions.push(
        `cs.class_id = $${values.length}`
      );
    }

    if (section_id !== undefined) {
      if (
        !/^\d+$/.test(section_id) ||
        Number(section_id) <= 0
      ) {
        return sendErrorResponse(
          res,
          400,
          "Invalid section ID"
        );
      }

      values.push(
        Number(section_id)
      );

      conditions.push(
        `cs.section_id = $${values.length}`
      );
    }

    if (class_teacher_id !== undefined) {
      if (
        !/^\d+$/.test(class_teacher_id) ||
        Number(class_teacher_id) <= 0
      ) {
        return sendErrorResponse(
          res,
          400,
          "Invalid class teacher ID"
        );
      }

      values.push(
        Number(class_teacher_id)
      );

      conditions.push(
        `cs.class_teacher_id = $${values.length}`
      );
    }

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

      conditions.push(
        `cs.is_active = $${values.length}`
      );
    }

    const whereClause =
      conditions.length > 0
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

    const result =
      await pool.query(
        `
          SELECT
            cs.class_section_id,

            cs.academic_year_id,
            ay.academic_year,

            cs.class_id,
            c.class_name,

            cs.section_id,
            s.section_name,

            cs.class_teacher_id,
            e.employee_code AS teacher_code,
            u.full_name AS teacher_name,

            cs.is_active,
            cs.created_at,
            cs.updated_at

          FROM tbl_class_sections cs

          INNER JOIN tbl_academic_years ay
            ON ay.academic_year_id =
               cs.academic_year_id

          INNER JOIN tbl_classes c
            ON c.class_id = cs.class_id

          INNER JOIN tbl_sections s
            ON s.section_id = cs.section_id

          LEFT JOIN tbl_employees e
            ON e.employee_id =
               cs.class_teacher_id

          LEFT JOIN tbl_users u
            ON u.user_id = e.user_id

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
      result.rows
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

export async function getClassSectionById(
  req,
  res
) {
  try {
    const { class_section_id } =
      req.params;

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

    const result =
      await pool.query(
        `
          SELECT
            cs.class_section_id,

            cs.academic_year_id,
            ay.academic_year,

            cs.class_id,
            c.class_name,

            cs.section_id,
            s.section_name,

            cs.class_teacher_id,
            e.employee_code AS teacher_code,
            u.full_name AS teacher_name,

            cs.is_active,
            cs.created_at,
            cs.updated_at

          FROM tbl_class_sections cs

          INNER JOIN tbl_academic_years ay
            ON ay.academic_year_id =
               cs.academic_year_id

          INNER JOIN tbl_classes c
            ON c.class_id = cs.class_id

          INNER JOIN tbl_sections s
            ON s.section_id = cs.section_id

          LEFT JOIN tbl_employees e
            ON e.employee_id =
               cs.class_teacher_id

          LEFT JOIN tbl_users u
            ON u.user_id = e.user_id

          WHERE cs.class_section_id = $1

          LIMIT 1
        `,
        [Number(class_section_id)]
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

export async function updateClassSection(
  req,
  res
) {
  try {
    const { class_section_id } =
      req.params;

    const {
      class_teacher_id
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

    if (
      class_teacher_id === undefined
    ) {
      return sendErrorResponse(
        res,
        400,
        "At least one field is required"
      );
    }

    if (
      class_teacher_id !== null &&
      class_teacher_id !== "" &&
      (
        !Number.isInteger(
          Number(class_teacher_id)
        ) ||
        Number(class_teacher_id) <= 0
      )
    ) {
      return sendErrorResponse(
        res,
        400,
        "Class teacher ID must be a valid positive integer"
      );
    }

    const classTeacherId =
      class_teacher_id === null ||
        class_teacher_id === ""
        ? null
        : Number(class_teacher_id);

    const existing =
      await pool.query(
        `
          SELECT class_section_id
          FROM tbl_class_sections
          WHERE class_section_id = $1
          LIMIT 1
        `,
        [Number(class_section_id)]
      );

    if (existing.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Class section ID ${class_section_id} not found`
      );
    }

    if (classTeacherId !== null) {
      const teacherResult =
        await pool.query(
          `
            SELECT employee_id
            FROM tbl_employees
            WHERE employee_id = $1
              AND employee_type = 'TEACHER'
              AND is_active = TRUE
            LIMIT 1
          `,
          [classTeacherId]
        );

      if (
        teacherResult.rows.length === 0
      ) {
        return sendErrorResponse(
          res,
          404,
          `Teacher ID ${classTeacherId} not found or inactive`
        );
      }
    }

    const result =
      await pool.query(
        `
          UPDATE tbl_class_sections
          SET
            class_teacher_id = $1,
            updated_at = CURRENT_TIMESTAMP
          WHERE class_section_id = $2
          RETURNING
            class_section_id,
            academic_year_id,
            class_id,
            section_id,
            class_teacher_id,
            is_active,
            created_at,
            updated_at
        `,
        [
          classTeacherId,
          Number(class_section_id)
        ]
      );

    return sendSuccessResponse(
      res,
      200,
      "Class section updated successfully",
      result.rows[0]
    );

  } catch (error) {
    console.error(
      "Update class section error:",
      error
    );

    const message =
      process.env.NODE_ENV === "development"
        ? error.message
        : "Failed to update class section";

    return sendErrorResponse(
      res,
      500,
      message
    );
  }
}

export async function updateClassSectionStatus(
  req,
  res
) {
  try {
    const { class_section_id } =
      req.params;

    const { is_active } =
      req.body || {};

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
      `Class section ${is_active
        ? "activated"
        : "deactivated"
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

    return sendErrorResponse(
      res,
      500,
      message
    );
  }
}