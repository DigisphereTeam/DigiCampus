import pool from "../config/database.js";
import { sendErrorResponse, sendSuccessResponse } from "../utils/response.js";
import { isValidId } from "../utils/validation.js";

export const createLead = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const {
      student_name,
      date_of_birth,
      gender,
      blood_group,
      phone_number,
      email,
      address,
      father_name,
      father_phone,
      father_email,
      father_occupation,
      mother_name,
      mother_phone,
      mother_email,
      mother_occupation,
      guardian_name,
      guardian_phone,
      guardian_email,
      guardian_relationship,
      academic_year_id,
      lead_source,
      follow_up_date,
      remarks,
    } = req.body;

    const currentYear = new Date().getFullYear();

    const leadNumberResult = await client.query(
      `
      SELECT COALESCE(
        MAX(
          CAST(
            SUBSTRING(lead_number FROM 7)
            AS INTEGER
          )
        ),
        0
      ) + 1 AS next_number
      FROM tbl_leads
      WHERE lead_number LIKE $1
      `,
      [`LD${currentYear}%`],
    );

    const nextNumber = leadNumberResult.rows[0].next_number;

    const leadNumber = `LD${currentYear}${String(nextNumber).padStart(4, "0")}`;

    const result = await client.query(
      `
      INSERT INTO tbl_leads (
        lead_number,
        student_name,
        date_of_birth,
        gender,
        blood_group,
        phone_number,
        email,
        address,
        father_name,
        father_phone,
        father_email,
        father_occupation,
        mother_name,
        mother_phone,
        mother_email,
        mother_occupation,
        guardian_name,
        guardian_phone,
        guardian_email,
        guardian_relationship,
        academic_year_id,
        lead_source,
        follow_up_date,
        remarks
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24
      )
      RETURNING *
      `,
      [
        leadNumber,
        student_name,
        date_of_birth,
        gender,
        blood_group,
        phone_number,
        email,
        address,
        father_name,
        father_phone,
        father_email,
        father_occupation,
        mother_name,
        mother_phone,
        mother_email,
        mother_occupation,
        guardian_name,
        guardian_phone,
        guardian_email,
        guardian_relationship,
        academic_year_id,
        lead_source,
        follow_up_date,
        remarks,
      ],
    );

    await client.query("COMMIT");

    return sendSuccessResponse(
      res,
      201,
      "Lead created successfully",
      result.rows[0],
    );
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Create Lead Error:", error);

    if (error.code === "23505") {
      return sendErrorResponse(
        res,
        409,
        "A lead with the provided details already exists",
      );
    }

    if (error.code === "23503") {
      return sendErrorResponse(
        res,
        400,
        "Invalid academic year ID",
      );
    }

    return sendErrorResponse(
      res,
      500,
      process.env.NODE_ENV === "development"
        ? error.message
        : "Internal server error",
    );
  } finally {
    client.release();
  }
};

export const getAllLeads = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      lead_status,
    } = req.query;

    const pageNumber = Number(page);
    const limitNumber = Number(limit);

    if (
      !Number.isInteger(pageNumber) ||
      pageNumber <= 0
    ) {
      return sendErrorResponse(
        res,
        400,
        "Invalid page"
      );
    }

    if (
      !Number.isInteger(limitNumber) ||
      limitNumber <= 0 ||
      limitNumber > 100
    ) {
      return sendErrorResponse(
        res,
        400,
        "Invalid limit. Maximum limit is 100"
      );
    }

    const conditions = [];
    const values = [];

    if (search !== undefined && search !== null) {
      if (typeof search !== "string") {
        return sendErrorResponse(
          res,
          400,
          "Invalid search"
        );
      }

      const cleanSearch = search.trim();

      if (cleanSearch) {
        values.push(`%${cleanSearch}%`);

        conditions.push(`
          (
            l.student_name ILIKE $${values.length}
            OR l.lead_number ILIKE $${values.length}
            OR l.phone_number ILIKE $${values.length}
            OR l.email ILIKE $${values.length}
          )
        `);
      }
    }

    if (
      lead_status !== undefined &&
      lead_status !== null
    ) {
      if (typeof lead_status !== "string") {
        return sendErrorResponse(
          res,
          400,
          "Invalid lead status"
        );
      }

      const normalizedStatus = lead_status
        .trim()
        .toUpperCase();

      if (!LEAD_STATUSES.includes(normalizedStatus)) {
        return sendErrorResponse(
          res,
          400,
          "Invalid lead status"
        );
      }

      values.push(normalizedStatus);

      conditions.push(
        `l.lead_status = $${values.length}`
      );
    }

    const whereClause =
      conditions.length > 0
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

    const countResult = await pool.query(
      `
        SELECT COUNT(*) AS total
        FROM tbl_leads l
        ${whereClause}
      `,
      values
    );

    const total = Number(
      countResult.rows[0].total
    );

    const statisticsResult = await pool.query(`
      SELECT
        COUNT(*) AS total_leads,
        COUNT(*) FILTER (
          WHERE lead_status = 'NEW'
        ) AS new_leads,
        COUNT(*) FILTER (
          WHERE lead_status = 'CONTACTED'
        ) AS contacted_leads,
        COUNT(*) FILTER (
          WHERE lead_status = 'FOLLOW_UP'
        ) AS follow_up_leads,
        COUNT(*) FILTER (
          WHERE lead_status = 'CONVERTED'
        ) AS converted_leads,
        COUNT(*) FILTER (
          WHERE lead_status = 'LOST'
        ) AS lost_leads
      FROM tbl_leads
    `);

    const statisticsRow =
      statisticsResult.rows[0];

    const dataValues = [...values];

    dataValues.push(limitNumber);
    const limitIndex = dataValues.length;

    dataValues.push(
      (pageNumber - 1) * limitNumber
    );
    const offsetIndex = dataValues.length;

    const result = await pool.query(
      `
        SELECT
          l.lead_id,
          l.lead_number,
          l.student_name,
          l.date_of_birth,
          l.gender,
          l.blood_group,
          l.phone_number,
          l.email,
          l.address,
          l.father_name,
          l.father_phone,
          l.father_email,
          l.father_occupation,
          l.mother_name,
          l.mother_phone,
          l.mother_email,
          l.mother_occupation,
          l.guardian_name,
          l.guardian_phone,
          l.guardian_email,
          l.guardian_relationship,
          l.academic_year_id,
          l.lead_source,
          l.lead_status,
          l.follow_up_date,
          l.remarks,
          l.converted_student_id,
          l.created_at,
          l.updated_at
        FROM tbl_leads l
        ${whereClause}
        ORDER BY l.lead_id DESC
        LIMIT $${limitIndex}
        OFFSET $${offsetIndex}
      `,
      dataValues
    );

    const totalPages = Math.ceil(
      total / limitNumber
    );

    return sendSuccessResponse(
      res,
      200,
      "Leads fetched successfully",
      {
        pagination_info: {
          page: pageNumber,
          limit: limitNumber,
          prev_page:
            pageNumber > 1
              ? pageNumber - 1
              : null,
          next_page:
            pageNumber < totalPages
              ? pageNumber + 1
              : null,
          total,
          total_pages: totalPages,
        },
        statistics: {
          total_leads: Number(
            statisticsRow.total_leads
          ),
          new_leads: Number(
            statisticsRow.new_leads
          ),
          contacted_leads: Number(
            statisticsRow.contacted_leads
          ),
          follow_up_leads: Number(
            statisticsRow.follow_up_leads
          ),
          converted_leads: Number(
            statisticsRow.converted_leads
          ),
          lost_leads: Number(
            statisticsRow.lost_leads
          ),
        },
        leads: result.rows,
      }
    );
  } catch (error) {
    console.error(
      "Get all leads error:",
      error
    );

    return sendErrorResponse(
      res,
      500,
      "Failed to fetch leads"
    );
  }
};

export const getLeadById = async (req, res) => {
  try {
    const { lead_id } = req.params;

    if (!isValidId(lead_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid lead ID is required",
      );
    }

    const result = await pool.query(
      `
      SELECT *
      FROM tbl_leads
      WHERE lead_id = $1
      `,
      [Number(lead_id)],
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Lead with ID ${lead_id} not found`,
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Lead fetched successfully",
      result.rows[0],
    );
  } catch (error) {
    console.error("Get Lead Error:", error);

    return sendErrorResponse(
      res,
      500,
      process.env.NODE_ENV === "development"
        ? error.message
        : "Internal server error",
    );
  }
};

export const updateLead = async (req, res) => {
  try {
    const { lead_id } = req.params;

    if (!isValidId(lead_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid lead ID is required",
      );
    }

    const existingLead = await pool.query(
      `
      SELECT lead_id
      FROM tbl_leads
      WHERE lead_id = $1
      `,
      [Number(lead_id)],
    );

    if (existingLead.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Lead with ID ${lead_id} not found`,
      );
    }

    const {
      student_name,
      date_of_birth,
      gender,
      blood_group,
      phone_number,
      email,
      address,
      father_name,
      father_phone,
      father_email,
      father_occupation,
      mother_name,
      mother_phone,
      mother_email,
      mother_occupation,
      guardian_name,
      guardian_phone,
      guardian_email,
      guardian_relationship,
      academic_year_id,
      lead_source,
      follow_up_date,
      remarks,
    } = req.body;

    const fields = [];
    const values = [];

    const updates = {
      student_name,
      date_of_birth,
      gender,
      blood_group,
      phone_number,
      email,
      address,
      father_name,
      father_phone,
      father_email,
      father_occupation,
      mother_name,
      mother_phone,
      mother_email,
      mother_occupation,
      guardian_name,
      guardian_phone,
      guardian_email,
      guardian_relationship,
      academic_year_id,
      lead_source,
      follow_up_date,
      remarks,
    };

    Object.entries(updates).forEach(([field, value]) => {
      if (value !== undefined) {
        fields.push(`${field} = $${values.length + 1}`);
        values.push(value);
      }
    });

    fields.push("updated_at = CURRENT_TIMESTAMP");
    values.push(Number(lead_id));

    const result = await pool.query(
      `
      UPDATE tbl_leads
      SET ${fields.join(", ")}
      WHERE lead_id = $${values.length}
      RETURNING *
      `,
      values,
    );

    return sendSuccessResponse(
      res,
      200,
      "Lead updated successfully",
      result.rows[0],
    );
  } catch (error) {
    console.error("Update Lead Error:", error);

    if (error.code === "23503") {
      return sendErrorResponse(
        res,
        400,
        "Invalid academic year ID",
      );
    }

    return sendErrorResponse(
      res,
      500,
      process.env.NODE_ENV === "development"
        ? error.message
        : "Internal server error",
    );
  }
};

export const updateLeadStatus = async (req, res) => {
  try {
    const { lead_id } = req.params;
    const { lead_status } = req.body;

    if (!isValidId(lead_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid lead ID is required",
      );
    }

    const result = await pool.query(
      `
      UPDATE tbl_leads
      SET
        lead_status = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE lead_id = $2
      RETURNING *
      `,
      [lead_status, Number(lead_id)],
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Lead with ID ${lead_id} not found`,
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Lead status updated successfully",
      result.rows[0],
    );
  } catch (error) {
    console.error("Update Lead Status Error:", error);

    return sendErrorResponse(
      res,
      500,
      process.env.NODE_ENV === "development"
        ? error.message
        : "Internal server error",
    );
  }
};

export const deleteLead = async (req, res) => {
  try {
    const { lead_id } = req.params;

    if (!isValidId(lead_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid lead ID is required",
      );
    }

    const result = await pool.query(
      `
      DELETE FROM tbl_leads
      WHERE lead_id = $1
      RETURNING lead_id
      `,
      [Number(lead_id)],
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Lead with ID ${lead_id} not found`,
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Lead deleted successfully",
      result.rows[0],
    );
  } catch (error) {
    console.error("Delete Lead Error:", error);

    return sendErrorResponse(
      res,
      500,
      process.env.NODE_ENV === "development"
        ? error.message
        : "Internal server error",
    );
  }
};

export const convertLeadToStudent = async (req, res) => {
  const client = await pool.connect();

  try {
    const { lead_id } = req.params;
    const { class_section_id, roll_number } = req.body;

    if (!isValidId(lead_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid lead ID is required",
      );
    }

    await client.query("BEGIN");

    const leadResult = await client.query(
      `
      SELECT *
      FROM tbl_leads
      WHERE lead_id = $1
      FOR UPDATE
      `,
      [Number(lead_id)],
    );

    if (leadResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return sendErrorResponse(
        res,
        404,
        `Lead with ID ${lead_id} not found`,
      );
    }

    const lead = leadResult.rows[0];

    if (lead.lead_status === "CONVERTED") {
      await client.query("ROLLBACK");

      return sendErrorResponse(
        res,
        409,
        "Lead is already converted",
      );
    }

    const classSectionResult = await client.query(
      `
      SELECT class_section_id
      FROM tbl_class_sections
      WHERE class_section_id = $1
      `,
      [Number(class_section_id)],
    );

    if (classSectionResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return sendErrorResponse(
        res,
        404,
        `Class section with ID ${class_section_id} not found`,
      );
    }

    let assignedRollNumber = roll_number;

    if (
      assignedRollNumber === undefined ||
      assignedRollNumber === null
    ) {
      const rollNumberResult = await client.query(
        `
        SELECT COALESCE(MAX(roll_number), 0) + 1 AS next_roll_number
        FROM tbl_student_class_sections
        WHERE academic_year_id = $1
          AND class_section_id = $2
        `,
        [
          lead.academic_year_id,
          Number(class_section_id),
        ],
      );

      assignedRollNumber =
        rollNumberResult.rows[0].next_roll_number;
    }

    const currentYear = new Date().getFullYear();

    const admissionNumberResult = await client.query(
      `
      SELECT COALESCE(
        MAX(
          CAST(
            SUBSTRING(admission_number FROM 7)
            AS INTEGER
          )
        ),
        0
      ) + 1 AS next_number
      FROM tbl_students
      WHERE admission_number LIKE $1
      `,
      [`DC${currentYear}%`],
    );

    const nextNumber =
      admissionNumberResult.rows[0].next_number;

    const admissionNumber = `DC${currentYear}${String(
      nextNumber,
    ).padStart(4, "0")}`;

    const studentResult = await client.query(
      `
      INSERT INTO tbl_students (
        admission_number,
        full_name,
        date_of_birth,
        gender,
        blood_group,
        phone_number,
        email,
        address
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
      `,
      [
        admissionNumber,
        lead.student_name,
        lead.date_of_birth,
        lead.gender,
        lead.blood_group,
        lead.phone_number,
        lead.email,
        lead.address,
      ],
    );

    const student = studentResult.rows[0];

    await client.query(
      `
      INSERT INTO tbl_student_parents (
        student_id,
        father_name,
        father_phone,
        father_email,
        father_occupation,
        mother_name,
        mother_phone,
        mother_email,
        mother_occupation,
        guardian_name,
        guardian_phone,
        guardian_email,
        guardian_relationship
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13
      )
      `,
      [
        student.student_id,
        lead.father_name,
        lead.father_phone,
        lead.father_email,
        lead.father_occupation,
        lead.mother_name,
        lead.mother_phone,
        lead.mother_email,
        lead.mother_occupation,
        lead.guardian_name,
        lead.guardian_phone,
        lead.guardian_email,
        lead.guardian_relationship,
      ],
    );

    await client.query(
      `
      INSERT INTO tbl_student_class_sections (
        student_id,
        academic_year_id,
        class_section_id,
        roll_number,
        start_date
      )
      VALUES ($1, $2, $3, $4, CURRENT_DATE)
      `,
      [
        student.student_id,
        lead.academic_year_id,
        Number(class_section_id),
        assignedRollNumber,
      ],
    );

    await client.query(
      `
      UPDATE tbl_leads
      SET
        lead_status = 'CONVERTED',
        converted_student_id = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE lead_id = $2
      `,
      [student.student_id, Number(lead_id)],
    );

    await client.query("COMMIT");

    return sendSuccessResponse(
      res,
      200,
      "Lead converted to student successfully",
      {
        student,
        roll_number: assignedRollNumber,
      },
    );
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Convert Lead Error:", error);

    if (error.code === "23505") {
      return sendErrorResponse(
        res,
        409,
        "Student or class assignment already exists",
      );
    }

    if (error.code === "23503") {
      return sendErrorResponse(
        res,
        400,
        "Invalid reference ID",
      );
    }

    return sendErrorResponse(
      res,
      500,
      process.env.NODE_ENV === "development"
        ? error.message
        : "Internal server error",
    );
  } finally {
    client.release();
  }
};