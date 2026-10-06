import pool from "../config/database.js";
import {
  sendErrorResponse,
  sendSuccessResponse,
} from "../utils/response.js";
import { isValidId } from "../utils/validation.js";

export const createAssignmentAttachment = async (req, res) => {
  try {
    const { assignment_id } = req.params;
    const {
      file_name,
      file_url,
      file_type,
      file_size,
    } = req.body;

    if (!isValidId(assignment_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid assignment ID is required"
      );
    }

    const assignmentResult = await pool.query(
      `
      SELECT assignment_id
      FROM tbl_assignments
      WHERE assignment_id = $1
      LIMIT 1
      `,
      [Number(assignment_id)]
    );

    if (assignmentResult.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Assignment with ID ${assignment_id} not found`
      );
    }

    const result = await pool.query(
      `
      INSERT INTO tbl_assignment_attachments (
        assignment_id,
        file_name,
        file_url,
        file_type,
        file_size
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING
        attachment_id,
        assignment_id,
        file_name,
        file_url,
        file_type,
        file_size,
        created_at
      `,
      [
        Number(assignment_id),
        file_name,
        file_url,
        file_type || null,
        file_size || null,
      ]
    );

    return sendSuccessResponse(
      res,
      201,
      "Assignment attachment created successfully",
      result.rows[0]
    );
  } catch (error) {
    console.error("createAssignmentAttachment error:", {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });

    if (error.code === "23503") {
      return sendErrorResponse(
        res,
        400,
        "Invalid assignment reference"
      );
    }

    const message =
      process.env.NODE_ENV === "development"
        ? error.message
        : "Failed to create assignment attachment";

    return sendErrorResponse(res, 500, message);
  }
};

export const getAssignmentAttachments = async (req, res) => {
  try {
    const { assignment_id } = req.params;

    if (!isValidId(assignment_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid assignment ID is required"
      );
    }

    const assignmentResult = await pool.query(
      `
      SELECT assignment_id
      FROM tbl_assignments
      WHERE assignment_id = $1
      LIMIT 1
      `,
      [Number(assignment_id)]
    );

    if (assignmentResult.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Assignment with ID ${assignment_id} not found`
      );
    }

    const result = await pool.query(
      `
      SELECT
        attachment_id,
        assignment_id,
        file_name,
        file_url,
        file_type,
        file_size,
        created_at
      FROM tbl_assignment_attachments
      WHERE assignment_id = $1
      ORDER BY created_at DESC
      `,
      [Number(assignment_id)]
    );

    return sendSuccessResponse(
      res,
      200,
      "Assignment attachments fetched successfully",
      {
        assignment_id: Number(assignment_id),
        attachments: result.rows,
      }
    );
  } catch (error) {
    console.error("getAssignmentAttachments error:", {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });

    const message =
      process.env.NODE_ENV === "development"
        ? error.message
        : "Failed to fetch assignment attachments";

    return sendErrorResponse(res, 500, message);
  }
};

export const deleteAssignmentAttachment = async (req, res) => {
  try {
    const { attachment_id } = req.params;

    if (!isValidId(attachment_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid attachment ID is required"
      );
    }

    const result = await pool.query(
      `
      DELETE FROM tbl_assignment_attachments
      WHERE attachment_id = $1
      RETURNING attachment_id
      `,
      [Number(attachment_id)]
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Attachment with ID ${attachment_id} not found`
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Assignment attachment deleted successfully"
    );
  } catch (error) {
    console.error("deleteAssignmentAttachment error:", {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });

    const message =
      process.env.NODE_ENV === "development"
        ? error.message
        : "Failed to delete assignment attachment";

    return sendErrorResponse(res, 500, message);
  }
};