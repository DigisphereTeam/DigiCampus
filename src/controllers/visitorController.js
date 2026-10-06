import pool from "../config/database.js";
import { handleControllerError } from "../utils/errorHandler.js";
import {
  sendErrorResponse,
  sendSuccessResponse
} from "../utils/response.js";

import { isValidId } from "../utils/validation.js";

const phoneRegex = /^[0-9]{10}$/;

const emailRegex =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const allowedStatuses = [
  "IN",
  "OUT"
];

const allowedIdProofTypes = [
  "AADHAAR",
  "PASSPORT",
  "DRIVING_LICENSE",
  "VOTER_ID",
  "OTHER"
];

export const createVisitor = async (req, res) => {
  try {
    const {
      visitor_name,
      phone_number,
      email,
      address,
      purpose,
      person_to_meet,
      department,
      visit_date,
      id_proof_type,
      id_proof_number,
      vehicle_number,
      remarks,
      visitor_status
    } = req.body || {};

    if (
      !visitor_name ||
      !phone_number ||
      !purpose ||
      !person_to_meet
    ) {
      return sendErrorResponse(
        res,
        400,
        "visitor_name, phone_number, purpose and person_to_meet are required"
      );
    }

    if (visitor_name.trim().length < 2) {
      return sendErrorResponse(
        res,
        400,
        "visitor_name must contain at least 2 characters"
      );
    }

    if (
      !phoneRegex.test(
        phone_number.toString().trim()
      )
    ) {
      return sendErrorResponse(
        res,
        400,
        "Invalid visitor phone number"
      );
    }

    if (
      email &&
      !emailRegex.test(
        email.toString().trim()
      )
    ) {
      return sendErrorResponse(
        res,
        400,
        "Invalid visitor email address"
      );
    }

    const finalStatus = visitor_status
      ? visitor_status.toString().trim().toUpperCase()
      : "IN";

    if (!allowedStatuses.includes(finalStatus)) {
      return sendErrorResponse(
        res,
        400,
        `visitor_status must be one of: ${allowedStatuses.join(", ")}`
      );
    }

    let finalIdProofType = null;

    if (id_proof_type) {
      finalIdProofType = id_proof_type
        .toString()
        .trim()
        .toUpperCase();

      if (!allowedIdProofTypes.includes(finalIdProofType)) {
        return sendErrorResponse(
          res,
          400,
          `id_proof_type must be one of: ${allowedIdProofTypes.join(", ")}`
        );
      }
    }

    const result = await pool.query(
      `
      INSERT INTO tbl_visitors (
        visitor_name,
        phone_number,
        email,
        address,
        purpose,
        person_to_meet,
        department,
        visit_date,
        id_proof_type,
        id_proof_number,
        vehicle_number,
        check_in_time,
        check_out_time,
        visitor_status,
        remarks
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        COALESCE($8, CURRENT_DATE),
        $9,
        $10,
        $11,
        CURRENT_TIMESTAMP,
        NULL,
        $12,
        $13
      )
      RETURNING
        visitor_id,
        visitor_name,
        phone_number,
        visitor_status,
        check_in_time
      `,
      [
        visitor_name.trim(),
        phone_number.trim(),
        email?.trim() || null,
        address?.trim() || null,
        purpose.trim(),
        person_to_meet.trim(),
        department?.trim() || null,
        visit_date || null,
        finalIdProofType,
        id_proof_number?.trim() || null,
        vehicle_number?.trim() || null,
        finalStatus,
        remarks?.trim() || null
      ]
    );

    return sendSuccessResponse(
      res,
      201,
      "Visitor created successfully",
      result.rows[0]
    );
  } catch (error) {
    console.error(
      "Create visitor error:",
      error
    );

    return sendErrorResponse(
      res,
      500,
      "Failed to create visitor"
    );
  }
};

export const getVisitors = async (req, res) => {
  try {
    const {
      search,
      visitor_status,
      department,
      from_date,
      to_date
    } = req.query || {};

    const values = [];
    const conditions = [];

    let query = `
      SELECT
        visitor_id,
        visitor_name,
        phone_number,
        email,
        address,
        purpose,
        person_to_meet,
        department,
        visit_date,
        id_proof_type,
        id_proof_number,
        vehicle_number,
        check_in_time,
        check_out_time,
        visitor_status,
        remarks,
        created_at,
        updated_at
      FROM tbl_visitors
    `;

    if (search) {
      values.push(`%${search.trim()}%`);

      conditions.push(`
        (
          visitor_name ILIKE $${values.length}
          OR phone_number ILIKE $${values.length}
          OR person_to_meet ILIKE $${values.length}
          OR purpose ILIKE $${values.length}
        )
      `);
    }

    if (visitor_status) {
      const finalStatus = visitor_status
        .toString()
        .trim()
        .toUpperCase();

      if (!allowedStatuses.includes(finalStatus)) {
        return sendErrorResponse(
          res,
          400,
          `visitor_status must be one of: ${allowedStatuses.join(", ")}`
        );
      }

      values.push(finalStatus);

      conditions.push(
        `visitor_status = $${values.length}`
      );
    }

    if (department) {
      values.push(department.trim());

      conditions.push(
        `department ILIKE $${values.length}`
      );
    }

    if (from_date) {
      values.push(from_date);

      conditions.push(
        `visit_date >= $${values.length}`
      );
    }

    if (to_date) {
      values.push(to_date);

      conditions.push(
        `visit_date <= $${values.length}`
      );
    }

    if (conditions.length > 0) {
      query += `
        WHERE ${conditions.join(" AND ")}
      `;
    }

    query += `
      ORDER BY created_at DESC
    `;

    const result = await pool.query(
      query,
      values
    );

    return sendSuccessResponse(
      res,
      200,
      "Visitors fetched successfully",
      {
        count: result.rows.length,
        visitors: result.rows
      }
    );
  } catch (error) {
    console.error(
      "Get visitors error:",
      error
    );

    return sendErrorResponse(
      res,
      500,
      "Failed to fetch visitors"
    );
  }
};

export const getVisitorById = async (req, res) => {
  try {
    const { visitor_id } = req.params;

    if (!isValidId(visitor_id)) {
      return sendErrorResponse(
        res,
        400,
        "A valid visitor ID is required"
      );
    }

    const visitorId = Number(visitor_id);

    const result = await pool.query(
      `
      SELECT *
      FROM tbl_visitors
      WHERE visitor_id = $1
      LIMIT 1
      `,
      [visitorId]
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Visitor with ID ${visitorId} was not found`
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Visitor fetched successfully",
      result.rows[0]
    );
  } catch (error) {
    console.error("Get visitor by ID error:", {
      message: error.message,
      stack: error.stack,
      visitor_id: req.params?.visitor_id,
    });

    const message =
      process.env.NODE_ENV === "development"
        ? `Failed to fetch visitor: ${error.message}`
        : "Failed to fetch visitor. Please try again later.";

    return sendErrorResponse(res, 500, message);
  }
};



export const updateVisitor = async (req, res) => {
  const client = await pool.connect();

  try {
    const { visitor_id } = req.params;

    const {
      visitor_name,
      phone_number,
      email,
      address,
      city,
      state,
      pincode,
      purpose,
      person_to_meet,
      department,
      visit_date,
      id_proof_type,
      id_proof_number,
      vehicle_number,
      remarks,
      visitor_status
    } = req.body || {};

    if (!visitor_id) {
      return sendErrorResponse(
        res,
        400,
        "visitor_id is required"
      );
    }

    if (
      !visitor_name ||
      !phone_number ||
      !purpose ||
      !person_to_meet
    ) {
      return sendErrorResponse(
        res,
        400,
        "visitor_name, phone_number, purpose and person_to_meet are required"
      );
    }

    if (visitor_name.trim().length < 2) {
      return sendErrorResponse(
        res,
        400,
        "visitor_name must contain at least 2 characters"
      );
    }

    if (
      !phoneRegex.test(
        phone_number.toString().trim()
      )
    ) {
      return sendErrorResponse(
        res,
        400,
        "Invalid visitor phone number"
      );
    }

    if (
      email &&
      !emailRegex.test(
        email.toString().trim()
      )
    ) {
      return sendErrorResponse(
        res,
        400,
        "Invalid visitor email address"
      );
    }

    const finalStatus = visitor_status
      ? visitor_status.toString().trim().toUpperCase()
      : "IN";

    if (!allowedStatuses.includes(finalStatus)) {
      return sendErrorResponse(
        res,
        400,
        `visitor_status must be one of: ${allowedStatuses.join(", ")}`
      );
    }

    let finalIdProofType = null;

    if (id_proof_type) {
      finalIdProofType = id_proof_type
        .toString()
        .trim()
        .toUpperCase();

      if (
        !allowedIdProofTypes.includes(
          finalIdProofType
        )
      ) {
        return sendErrorResponse(
          res,
          400,
          `id_proof_type must be one of: ${allowedIdProofTypes.join(", ")}`
        );
      }
    }

    await client.query("BEGIN");

    const result = await client.query(
      `
      UPDATE tbl_visitors
      SET
        visitor_name = $1,
        phone_number = $2,
        email = $3,
        address = $4,
        city = $5,
        state = $6,
        pincode = $7,
        purpose = $8,
        person_to_meet = $9,
        department = $10,
        visit_date = COALESCE($11, visit_date),
        id_proof_type = $12,
        id_proof_number = $13,
        vehicle_number = $14,
        visitor_status = $15,
        remarks = $16,
        updated_at = CURRENT_TIMESTAMP
      WHERE visitor_id = $17
      RETURNING
        visitor_id,
        visitor_name,
        visitor_status
      `,
      [
        visitor_name.trim(),
        phone_number.trim(),
        email?.trim() || null,
        address?.trim() || null,
        city?.trim() || null,
        state?.trim() || null,
        pincode?.trim() || null,
        purpose.trim(),
        person_to_meet.trim(),
        department?.trim() || null,
        visit_date || null,
        finalIdProofType,
        id_proof_number?.trim() || null,
        vehicle_number?.trim() || null,
        finalStatus,
        remarks?.trim() || null,
        visitor_id
      ]
    );

    if (result.rows.length === 0) {
      await client.query("ROLLBACK");

      return sendErrorResponse(
        res,
        404,
        "Visitor not found"
      );
    }

    await client.query("COMMIT");

    return sendSuccessResponse(
      res,
      200,
      "Visitor updated successfully",
      result.rows[0]
    );
  } catch (error) {
    await client.query("ROLLBACK");

    console.error(
      "Update visitor error:",
      error
    );

    return sendErrorResponse(
      res,
      500,
      "Failed to update visitor"
    );
  } finally {
    client.release();
  }
};


export const checkInVisitor = async (req, res) => {
  try {
    const { visitor_id } = req.params;

    if (!visitor_id) {
      return sendErrorResponse(
        res,
        400,
        "visitor_id is required"
      );
    }

    const result = await pool.query(
      `
      UPDATE tbl_visitors
      SET
        check_in_time = CURRENT_TIMESTAMP,
        check_out_time = NULL,
        visitor_status = 'IN',
        updated_at = CURRENT_TIMESTAMP
      WHERE visitor_id = $1
      RETURNING
        visitor_id,
        visitor_name,
        check_in_time,
        visitor_status
      `,
      [visitor_id]
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        "Visitor not found"
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Visitor checked in successfully",
      result.rows[0]
    );
  } catch (error) {
    console.error(
      "Check-in visitor error:",
      error
    );

    return sendErrorResponse(
      res,
      500,
      "Failed to check in visitor"
    );
  }
};

export const checkOutVisitor = async (req, res) => {
  const { visitor_id } = req.params;

  try {
    if (!isValidId(visitor_id)) {
      return sendErrorResponse(
        res,
        400,
        "A valid visitor ID is required"
      );
    }

    const visitorId = Number(visitor_id);

    const result = await pool.query(
      `
      UPDATE tbl_visitors
      SET
        check_out_time = CURRENT_TIMESTAMP,
        visitor_status = 'OUT',
        updated_at = CURRENT_TIMESTAMP
      WHERE visitor_id = $1
      RETURNING
        visitor_id,
        visitor_name,
        check_in_time,
        check_out_time,
        visitor_status
      `,
      [visitorId]
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Visitor with ID ${visitorId} was not found`
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Visitor checked out successfully",
      result.rows[0]
    );
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "Unable to check out visitor",
      { visitor_id }
    );
  }
};


export const deleteVisitor = async (req, res) => {
  try {
    const { visitor_id } = req.params;

    if (!visitor_id) {
      return sendErrorResponse(
        res,
        400,
        "visitor_id is required"
      );
    }

    const result = await pool.query(
      `
      DELETE FROM tbl_visitors
      WHERE visitor_id = $1
      RETURNING visitor_id
      `,
      [visitor_id]
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        "Visitor not found"
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Visitor deleted successfully",
      {
        visitor_id:
          result.rows[0].visitor_id
      }
    );
  } catch (error) {
    console.error(
      "Delete visitor error:",
      error
    );

    return sendErrorResponse(
      res,
      500,
      "Failed to delete visitor"
    );
  }
};
