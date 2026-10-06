import pool from "../config/database.js";
import { sendErrorResponse, sendSuccessResponse } from "../utils/response.js";
import { isValidId } from "../utils/validation.js";

const generateClassCode = (className) => {
  return className
    .toString()
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
};

export const createClasses = async (req, res, next) => {
  const client = await pool.connect();

  try {
    const { classes } = req.body;

    if (!Array.isArray(classes) || classes.length === 0) {
      return sendErrorResponse(
        res,
        400,
        "Classes must be a non-empty array"
      );
    }

    const errors = [];

    classes.forEach((item, index) => {
      if (!item || typeof item !== "object") {
        errors.push({
          index,
          message: "Invalid class data",
        });

        return;
      }

      if (!item.class_name || !item.class_name.toString().trim()) {
        errors.push({
          index,
          field: "class_name",
          message: "Class name is required",
        });
      }

      if (
        item.is_active !== undefined &&
        typeof item.is_active !== "boolean"
      ) {
        errors.push({
          index,
          field: "is_active",
          message: "is_active must be a boolean",
        });
      }
    });

    if (errors.length > 0) {
      return sendErrorResponse(
        res,
        400,
        "Validation failed",
        errors
      );
    }

    const preparedClasses = classes.map((item) => {
      const className = item.class_name.toString().trim();

      return {
        class_name: className,
        class_code: generateClassCode(className),
        is_active:
          item.is_active !== undefined
            ? item.is_active
            : true,
      };
    });

    const values = [];
    const placeholders = [];

    preparedClasses.forEach((item, index) => {
      const offset = index * 3;

      placeholders.push(
        `($${offset + 1}, $${offset + 2}, $${offset + 3})`
      );

      values.push(
        item.class_name,
        item.class_code,
        item.is_active
      );
    });

    const query = `
      INSERT INTO tbl_classes (
        class_name,
        class_code,
        is_active
      )
      VALUES ${placeholders.join(", ")}
      ON CONFLICT DO NOTHING
      RETURNING *
    `;

    const result = await client.query(query, values);

    return sendSuccessResponse(
      res,
      201,
      "Classes processed successfully",
      result.rows
    );
  } catch (error) {
    next(error);
  } finally {
    client.release();
  }
};

export const createClass = async (req, res) => {
  try {
    const {
      class_name,
      is_active,
    } = req.body;

    const existingClass = await pool.query(
      `
        SELECT class_id
        FROM tbl_classes
        WHERE LOWER(class_name) = LOWER($1)
        LIMIT 1
      `,
      [class_name]
    );

    if (existingClass.rows.length > 0) {
      return sendErrorResponse(
        res,
        409,
        "Class with this name already exists"
      );
    }

    const classCode = generateClassCode(class_name);

    if (!classCode) {
      return sendErrorResponse(
        res,
        400,
        "Unable to generate class code"
      );
    }

    const existingCode = await pool.query(
      `
        SELECT class_id
        FROM tbl_classes
        WHERE class_code = $1
        LIMIT 1
      `,
      [classCode]
    );

    if (existingCode.rows.length > 0) {
      return sendErrorResponse(
        res,
        409,
        "Generated class code already exists"
      );
    }

    const result = await pool.query(
      `
        INSERT INTO tbl_classes (
          class_name,
          class_code,
          is_active
        )
        VALUES ($1, $2, $3)
        RETURNING *
      `,
      [
        class_name,
        classCode,
        is_active,
      ]
    );

    return sendSuccessResponse(
      res,
      201,
      "Class created successfully",
      result.rows[0]
    );
  } catch (error) {
    console.error("Create class error:", error);

    if (error.code === "23505") {
      return sendErrorResponse(
        res,
        409,
        "Class with this name already exists"
      );
    }

    const message =
      process.env.NODE_ENV === "development"
        ? error.message
        : "Failed to create class";

    return sendErrorResponse(
      res,
      500,
      message
    );
  }
};

export const getAllClasses = async (req, res) => {
  try {
    const { is_active } = req.query;

    let query = `
      SELECT
        class_id,
        class_name,
        class_code,
        is_active,
        created_at,
        updated_at
      FROM tbl_classes
    `;

    const values = [];

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

      query += ` WHERE is_active = $1`;
    }

    query += `
      ORDER BY class_id ASC
    `;

    const result = await pool.query(query, values);

    return sendSuccessResponse(
      res,
      200,
      "Classes fetched successfully",
      result.rows
    );
  } catch (error) {
    console.error("Get All Classes Error:", error);

    const message =
      process.env.NODE_ENV === "development"
        ? error.message
        : "Internal server error";

    return sendErrorResponse(
      res,
      500,
      message
    );
  }
};

export const getClassById = async (req, res) => {
  try {
    const { class_id } = req.params;

    if (!isValidId(class_id)) {
      return sendErrorResponse(
        res,
        400,
        "A valid class ID is required"
      );
    }

    const classId = Number(class_id);

    const result = await pool.query(
      `
        SELECT
          class_id,
          class_name,
          class_code,
          is_active,
          created_at,
          updated_at
        FROM tbl_classes
        WHERE class_id = $1
      `,
      [classId]
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Class with ID ${classId} not found`
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Class fetched successfully",
      result.rows[0]
    );
  } catch (error) {
    console.error("Get Class By ID Error:", error);

    const message =
      process.env.NODE_ENV === "development"
        ? error.message
        : "Internal server error";

    return sendErrorResponse(
      res,
      500,
      message
    );
  }
};

export const updateClass = async (req, res) => {
  try {
    const { class_id } = req.params;

    const {
      class_name,
      is_active,
    } = req.body;

    if (!isValidId(class_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid class_id is required"
      );
    }

    if (
      class_name === undefined &&
      is_active === undefined
    ) {
      return sendErrorResponse(
        res,
        400,
        "At least one field is required for update"
      );
    }

    const errors = {};

    if (
      class_name !== undefined &&
      !class_name.toString().trim()
    ) {
      errors.class_name = "Class name cannot be empty";
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

    const existingClass = await pool.query(
      `
        SELECT *
        FROM tbl_classes
        WHERE class_id = $1
      `,
      [Number(class_id)]
    );

    if (existingClass.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        "Class not found"
      );
    }

    const currentClass = existingClass.rows[0];

    const updatedClassName =
      class_name !== undefined
        ? class_name.toString().trim()
        : currentClass.class_name;

    const updatedIsActive =
      is_active !== undefined
        ? is_active
        : currentClass.is_active;

    let updatedClassCode = currentClass.class_code;

    if (
      class_name !== undefined &&
      updatedClassName.toLowerCase() !==
      currentClass.class_name.toLowerCase()
    ) {
      updatedClassCode = generateClassCode(
        updatedClassName
      );

      if (!updatedClassCode) {
        return sendErrorResponse(
          res,
          400,
          "Unable to generate class code"
        );
      }

      const duplicateCode = await pool.query(
        `
          SELECT class_id
          FROM tbl_classes
          WHERE class_code = $1
          AND class_id != $2
        `,
        [
          updatedClassCode,
          Number(class_id),
        ]
      );

      if (duplicateCode.rows.length > 0) {
        return sendErrorResponse(
          res,
          409,
          "Generated class code already exists"
        );
      }
    }

    const duplicateName = await pool.query(
      `
        SELECT class_id
        FROM tbl_classes
        WHERE LOWER(class_name) = LOWER($1)
        AND class_id != $2
      `,
      [
        updatedClassName,
        Number(class_id),
      ]
    );

    if (duplicateName.rows.length > 0) {
      return sendErrorResponse(
        res,
        409,
        "Class name already exists"
      );
    }

    const result = await pool.query(
      `
        UPDATE tbl_classes
        SET
          class_name = $1,
          class_code = $2,
          is_active = $3,
          updated_at = CURRENT_TIMESTAMP
        WHERE class_id = $4
        RETURNING *
      `,
      [
        updatedClassName,
        updatedClassCode,
        updatedIsActive,
        Number(class_id),
      ]
    );

    return sendSuccessResponse(
      res,
      200,
      "Class updated successfully",
      result.rows[0]
    );
  } catch (error) {
    console.error("Update Class Error:", error);

    return sendErrorResponse(
      res,
      500,
      "Internal server error"
    );
  }
};

export const deleteClass = async (req, res) => {
  try {
    const { class_id } = req.params;

    if (!isValidId(class_id)) {
      return sendErrorResponse(
        res,
        400,
        "A valid class ID is required"
      );
    }

    const result = await pool.query(
      `
        UPDATE tbl_classes
        SET
          is_active = FALSE,
          updated_at = CURRENT_TIMESTAMP
        WHERE class_id = $1
        AND is_active = TRUE
        RETURNING *
      `,
      [Number(class_id)]
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Class with ID ${class_id} not found`
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Class deleted successfully",
      result.rows[0]
    );
  } catch (error) {
    console.error("Delete Class Error:", error);

    return sendErrorResponse(
      res,
      500,
      "Internal server error"
    );
  }
};

export const toggleClassStatus = async (req, res) => {
  try {
    const { class_id } = req.params;

    if (!isValidId(class_id)) {
      return sendErrorResponse(
        res,
        400,
        "A valid class ID is required"
      );
    }

    const result = await pool.query(
      `
        UPDATE tbl_classes
        SET
          is_active = NOT is_active,
          updated_at = CURRENT_TIMESTAMP
        WHERE class_id = $1
        RETURNING *
      `,
      [Number(class_id)]
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Class with ID ${class_id} not found`
      );
    }

    const classData = result.rows[0];

    return sendSuccessResponse(
      res,
      200,
      `Class ${classData.is_active
        ? "activated"
        : "deactivated"
      } successfully`,
      classData
    );
  } catch (error) {
    console.error("Toggle Class Status Error:", error);

    return sendErrorResponse(
      res,
      500,
      "Internal server error"
    );
  }
};