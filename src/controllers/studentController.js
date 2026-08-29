import pool from "../config/database.js";

import {
  sendSuccessResponse,
  sendErrorResponse,
} from "../utils/response.js";

export const createStudent = async (req, res) => {
  const {
    admission_number,
    full_name,
    gender,
    date_of_birth,
    phone,
    email,
    address,
    blood_group,
    admission_date,

    // Parent details
    parent_full_name,
    parent_phone,
    parent_email,
    parent_occupation,
    parent_address,
    relationship,
    is_primary,
  } = req.body;

  if (
    !admission_number ||
    !full_name ||
    !gender ||
    !parent_full_name ||
    !parent_phone ||
    !relationship
  ) {
    return sendErrorResponse(
      res,
      400,
      "Student and required parent details are required."
    );
  }

  const allowedGender = ["MALE", "FEMALE", "OTHER"];

  if (!allowedGender.includes(gender)) {
    return sendErrorResponse(
      res,
      400,
      "Gender must be MALE, FEMALE or OTHER."
    );
  }

  const allowedRelationships = [
    "FATHER",
    "MOTHER",
    "GUARDIAN",
  ];

  if (!allowedRelationships.includes(relationship)) {
    return sendErrorResponse(
      res,
      400,
      "Relationship must be FATHER, MOTHER or GUARDIAN."
    );
  }

  if (!/^[6-9]\d{9}$/.test(parent_phone)) {
    return sendErrorResponse(
      res,
      400,
      "Invalid parent phone number."
    );
  }

  if (phone && !/^[6-9]\d{9}$/.test(phone)) {
    return sendErrorResponse(
      res,
      400,
      "Invalid student phone number."
    );
  }

  if (
    email &&
    !/^\S+@\S+\.\S+$/.test(email)
  ) {
    return sendErrorResponse(
      res,
      400,
      "Invalid student email address."
    );
  }

  if (
    parent_email &&
    !/^\S+@\S+\.\S+$/.test(parent_email)
  ) {
    return sendErrorResponse(
      res,
      400,
      "Invalid parent email address."
    );
  }

  let client;

  try {
    client = await pool.connect();

    await client.query("BEGIN");

    // Check duplicate admission number
    const existingStudent = await client.query(
      `
      SELECT student_id
      FROM tbl_students
      WHERE admission_number = $1
      `,
      [admission_number.trim()]
    );

    if (existingStudent.rowCount > 0) {
      await client.query("ROLLBACK");

      return sendErrorResponse(
        res,
        409,
        "Admission number already exists."
      );
    }

    // Check whether parent already exists by phone
    let parentResult = await client.query(
      `
      SELECT parent_id
      FROM tbl_parents
      WHERE phone = $1
      LIMIT 1
      `,
      [parent_phone.trim()]
    );

    let parent_id;

    /*
     * If parent already exists,
     * use the existing parent.
     */
    if (parentResult.rowCount > 0) {
      parent_id = parentResult.rows[0].parent_id;
    } else {
      /*
       * Create new parent
       */
      const newParent = await client.query(
        `
        INSERT INTO tbl_parents
        (
          full_name,
          phone,
          email,
          occupation,
          address
        )
        VALUES
        ($1, $2, $3, $4, $5)
        RETURNING parent_id,
                  full_name,
                  phone,
                  email,
                  occupation,
                  address
        `,
        [
          parent_full_name.trim(),
          parent_phone.trim(),
          parent_email
            ? parent_email.trim().toLowerCase()
            : null,
          parent_occupation?.trim() || null,
          parent_address?.trim() || null,
        ]
      );

      parent_id = newParent.rows[0].parent_id;
    }

    // Create student
    const studentResult = await client.query(
      `
      INSERT INTO tbl_students
      (
        admission_number,
        full_name,
        gender,
        date_of_birth,
        phone,
        email,
        address,
        blood_group,
        admission_date
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8,
        COALESCE($9::date, CURRENT_DATE)
      )
      RETURNING *
      `,
      [
        admission_number.trim(),
        full_name.trim(),
        gender,
        date_of_birth || null,
        phone?.trim() || null,
        email
          ? email.trim().toLowerCase()
          : null,
        address?.trim() || null,
        blood_group?.trim() || null,
        admission_date || null,
      ]
    );

    const student = studentResult.rows[0];

    // Create student-parent relationship
    const relationResult = await client.query(
      `
      INSERT INTO tbl_student_parents
      (
        student_id,
        parent_id,
        relationship,
        is_primary
      )
      VALUES
      ($1, $2, $3, $4)
      RETURNING *
      `,
      [
        student.student_id,
        parent_id,
        relationship,
        is_primary ?? true,
      ]
    );

    await client.query("COMMIT");

    return sendSuccessResponse(
      res,
      201,
      "Student created successfully.",
      {
        student,
        parent_id,
        relationship: relationResult.rows[0],
      }
    );
  } catch (error) {
    if (client) {
      await client.query("ROLLBACK");
    }

    console.error(
      "Create Student Error:",
      error
    );

    return sendErrorResponse(
      res,
      500,
      error.message ||
        "Failed to create student."
    );
  } finally {
    if (client) {
      client.release();
    }
  }
};


export const getAllStudents = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        s.student_id,
        s.user_id,
        s.admission_number,
        s.full_name,
        s.gender,
        s.date_of_birth,
        s.phone,
        s.email,
        s.address,
        s.blood_group,
        s.admission_date,
        s.is_active,
        s.created_at,
        s.updated_at,

        COALESCE(
          json_agg(
            json_build_object(
              'parent_id', p.parent_id,
              'parent_full_name', p.full_name,
              'parent_phone', p.phone,
              'parent_email', p.email,
              'parent_occupation', p.occupation,
              'parent_address', p.address,
              'relationship', sp.relationship,
              'is_primary', sp.is_primary
            )
            ORDER BY sp.is_primary DESC, p.parent_id
          ) FILTER (WHERE p.parent_id IS NOT NULL),
          '[]'
        ) AS parents

      FROM tbl_students s

      LEFT JOIN tbl_student_parents sp
        ON sp.student_id = s.student_id

      LEFT JOIN tbl_parents p
        ON p.parent_id = sp.parent_id

      GROUP BY s.student_id

      ORDER BY s.student_id DESC
    `);

    return sendSuccessResponse(
      res,
      200,
      "Students fetched successfully.",
      result.rows
    );
  } catch (error) {
    console.error("Get All Students Error:", error);

    return sendErrorResponse(
      res,
      500,
      error.message || "Failed to fetch students."
    );
  }
};

export const getStudentById = async (req, res) => {
  const { student_id } = req.params;

  if (
    !student_id ||
    isNaN(student_id) ||
    Number(student_id) <= 0
  ) {
    return sendErrorResponse(
      res,
      400,
      "Valid student ID is required."
    );
  }

  try {
    const result = await pool.query(
      `
      SELECT
        s.student_id,
        s.user_id,
        s.admission_number,
        s.full_name,
        s.gender,
        s.date_of_birth,
        s.phone,
        s.email,
        s.address,
        s.blood_group,
        s.admission_date,
        s.is_active,
        s.created_at,
        s.updated_at,

        COALESCE(
          json_agg(
            json_build_object(
              'parent_id', p.parent_id,
              'parent_full_name', p.full_name,
              'parent_phone', p.phone,
              'parent_email', p.email,
              'parent_occupation', p.occupation,
              'parent_address', p.address,
              'relationship', sp.relationship,
              'is_primary', sp.is_primary
            )
            ORDER BY sp.is_primary DESC, p.parent_id
          ) FILTER (WHERE p.parent_id IS NOT NULL),
          '[]'
        ) AS parents

      FROM tbl_students s

      LEFT JOIN tbl_student_parents sp
        ON sp.student_id = s.student_id

      LEFT JOIN tbl_parents p
        ON p.parent_id = sp.parent_id

      WHERE s.student_id = $1

      GROUP BY s.student_id
      `,
      [student_id]
    );

    if (result.rowCount === 0) {
      return sendErrorResponse(
        res,
        404,
        "Student not found."
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Student fetched successfully.",
      result.rows[0]
    );
  } catch (error) {
    console.error("Get Student By ID Error:", error);

    return sendErrorResponse(
      res,
      500,
      error.message || "Failed to fetch student."
    );
  }
};

export const updateStudent = async (req, res) => {
  const { student_id } = req.params;

  if (
    !student_id ||
    isNaN(student_id) ||
    Number(student_id) <= 0
  ) {
    return sendErrorResponse(
      res,
      400,
      "Valid student ID is required."
    );
  }

  const allowedFields = [
    "admission_number",
    "full_name",
    "gender",
    "date_of_birth",
    "phone",
    "email",
    "address",
    "blood_group",
    "admission_date",
    "is_active",
    "parent_full_name",
    "parent_phone",
    "parent_email",
    "parent_occupation",
    "parent_address",
    "relationship",
    "is_primary",
  ];

  const receivedFields = Object.keys(req.body);

  const unknownFields = receivedFields.filter(
    (field) => !allowedFields.includes(field)
  );

  if (unknownFields.length > 0) {
    return sendErrorResponse(
      res,
      400,
      `Unknown field(s): ${unknownFields.join(", ")}`
    );
  }

  if (receivedFields.length === 0) {
    return sendErrorResponse(
      res,
      400,
      "At least one field is required for update."
    );
  }

  const {
    admission_number,
    full_name,
    gender,
    date_of_birth,
    phone,
    email,
    address,
    blood_group,
    admission_date,
    is_active,
    parent_full_name,
    parent_phone,
    parent_email,
    parent_occupation,
    parent_address,
    relationship,
    is_primary,
  } = req.body;

  const allowedGender = [
    "MALE",
    "FEMALE",
    "OTHER",
  ];

  if (
    gender !== undefined &&
    !allowedGender.includes(gender)
  ) {
    return sendErrorResponse(
      res,
      400,
      "Gender must be MALE, FEMALE or OTHER."
    );
  }

  const allowedRelationships = [
    "FATHER",
    "MOTHER",
    "GUARDIAN",
  ];

  if (
    relationship !== undefined &&
    !allowedRelationships.includes(relationship)
  ) {
    return sendErrorResponse(
      res,
      400,
      "Relationship must be FATHER, MOTHER or GUARDIAN."
    );
  }

  if (
    phone !== undefined &&
    phone !== null &&
    phone !== "" &&
    !/^[6-9]\d{9}$/.test(phone)
  ) {
    return sendErrorResponse(
      res,
      400,
      "Invalid student phone number."
    );
  }

  if (
    parent_phone !== undefined &&
    parent_phone !== null &&
    parent_phone !== "" &&
    !/^[6-9]\d{9}$/.test(parent_phone)
  ) {
    return sendErrorResponse(
      res,
      400,
      "Invalid parent phone number."
    );
  }

  if (
    email !== undefined &&
    email !== null &&
    email !== "" &&
    !/^\S+@\S+\.\S+$/.test(email)
  ) {
    return sendErrorResponse(
      res,
      400,
      "Invalid student email address."
    );
  }

  if (
    parent_email !== undefined &&
    parent_email !== null &&
    parent_email !== "" &&
    !/^\S+@\S+\.\S+$/.test(parent_email)
  ) {
    return sendErrorResponse(
      res,
      400,
      "Invalid parent email address."
    );
  }

  if (
    is_active !== undefined &&
    typeof is_active !== "boolean"
  ) {
    return sendErrorResponse(
      res,
      400,
      "is_active must be a boolean value."
    );
  }

  if (
    is_primary !== undefined &&
    typeof is_primary !== "boolean"
  ) {
    return sendErrorResponse(
      res,
      400,
      "is_primary must be a boolean value."
    );
  }

  let client;

  try {
    client = await pool.connect();

    await client.query("BEGIN");

    const studentCheck = await client.query(
      `
      SELECT *
      FROM tbl_students
      WHERE student_id = $1
      FOR UPDATE
      `,
      [student_id]
    );

    if (studentCheck.rowCount === 0) {
      await client.query("ROLLBACK");

      return sendErrorResponse(
        res,
        404,
        "Student not found."
      );
    }

    if (admission_number !== undefined) {
      if (
        !admission_number ||
        !admission_number.trim()
      ) {
        await client.query("ROLLBACK");

        return sendErrorResponse(
          res,
          400,
          "Admission number cannot be empty."
        );
      }

      const duplicateAdmission =
        await client.query(
          `
          SELECT student_id
          FROM tbl_students
          WHERE admission_number = $1
          AND student_id != $2
          `,
          [
            admission_number.trim(),
            student_id,
          ]
        );

      if (duplicateAdmission.rowCount > 0) {
        await client.query("ROLLBACK");

        return sendErrorResponse(
          res,
          409,
          "Admission number already exists."
        );
      }
    }

    await client.query(
      `
      UPDATE tbl_students
      SET
        admission_number =
          COALESCE($1, admission_number),
        full_name =
          COALESCE($2, full_name),
        gender =
          COALESCE($3, gender),
        date_of_birth =
          COALESCE($4::date, date_of_birth),
        phone =
          COALESCE($5, phone),
        email =
          COALESCE($6, email),
        address =
          COALESCE($7, address),
        blood_group =
          COALESCE($8, blood_group),
        admission_date =
          COALESCE($9::date, admission_date),
        is_active =
          COALESCE($10, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE student_id = $11
      `,
      [
        admission_number !== undefined
          ? admission_number.trim()
          : null,
        full_name !== undefined
          ? full_name.trim()
          : null,
        gender !== undefined
          ? gender
          : null,
        date_of_birth !== undefined
          ? date_of_birth
          : null,
        phone !== undefined
          ? phone.trim()
          : null,
        email !== undefined
          ? email.trim().toLowerCase()
          : null,
        address !== undefined
          ? address.trim()
          : null,
        blood_group !== undefined
          ? blood_group.trim()
          : null,
        admission_date !== undefined
          ? admission_date
          : null,
        is_active !== undefined
          ? is_active
          : null,
        student_id,
      ]
    );

    const parentFieldsProvided =
      parent_full_name !== undefined ||
      parent_phone !== undefined ||
      parent_email !== undefined ||
      parent_occupation !== undefined ||
      parent_address !== undefined ||
      relationship !== undefined ||
      is_primary !== undefined;

    if (parentFieldsProvided) {
      const relationResult =
        await client.query(
          `
          SELECT parent_id
          FROM tbl_student_parents
          WHERE student_id = $1
          ORDER BY is_primary DESC
          LIMIT 1
          `,
          [student_id]
        );

      if (relationResult.rowCount === 0) {
        await client.query("ROLLBACK");

        return sendErrorResponse(
          res,
          404,
          "Parent relationship not found for this student."
        );
      }

      const parent_id =
        relationResult.rows[0].parent_id;

      await client.query(
        `
        UPDATE tbl_parents
        SET
          full_name =
            COALESCE($1, full_name),
          phone =
            COALESCE($2, phone),
          email =
            COALESCE($3, email),
          occupation =
            COALESCE($4, occupation),
          address =
            COALESCE($5, address),
          updated_at = CURRENT_TIMESTAMP
        WHERE parent_id = $6
        `,
        [
          parent_full_name !== undefined
            ? parent_full_name.trim()
            : null,
          parent_phone !== undefined
            ? parent_phone.trim()
            : null,
          parent_email !== undefined
            ? parent_email.trim().toLowerCase()
            : null,
          parent_occupation !== undefined
            ? parent_occupation.trim()
            : null,
          parent_address !== undefined
            ? parent_address.trim()
            : null,
          parent_id,
        ]
      );

      await client.query(
        `
        UPDATE tbl_student_parents
        SET
          relationship =
            COALESCE($1, relationship),
          is_primary =
            COALESCE($2, is_primary)
        WHERE student_id = $3
        AND parent_id = $4
        `,
        [
          relationship !== undefined
            ? relationship
            : null,
          is_primary !== undefined
            ? is_primary
            : null,
          student_id,
          parent_id,
        ]
      );
    }

    await client.query("COMMIT");

    const finalResult = await pool.query(
      `
      SELECT
        s.student_id,
        s.user_id,
        s.admission_number,
        s.full_name,
        s.gender,
        s.date_of_birth,
        s.phone,
        s.email,
        s.address,
        s.blood_group,
        s.admission_date,
        s.is_active,
        s.created_at,
        s.updated_at,

        COALESCE(
          json_agg(
            json_build_object(
              'parent_id', p.parent_id,
              'parent_full_name', p.full_name,
              'parent_phone', p.phone,
              'parent_email', p.email,
              'parent_occupation', p.occupation,
              'parent_address', p.address,
              'relationship', sp.relationship,
              'is_primary', sp.is_primary
            )
            ORDER BY sp.is_primary DESC
          ) FILTER (
            WHERE p.parent_id IS NOT NULL
          ),
          '[]'
        ) AS parents

      FROM tbl_students s

      LEFT JOIN tbl_student_parents sp
        ON sp.student_id = s.student_id

      LEFT JOIN tbl_parents p
        ON p.parent_id = sp.parent_id

      WHERE s.student_id = $1

      GROUP BY s.student_id
      `,
      [student_id]
    );

    return sendSuccessResponse(
      res,
      200,
      "Student updated successfully.",
      finalResult.rows[0]
    );
  } catch (error) {
    if (client) {
      await client.query("ROLLBACK");
    }

    console.error(
      "Update Student Error:",
      error
    );

    return sendErrorResponse(
      res,
      500,
      error.message ||
        "Failed to update student."
    );
  } finally {
    if (client) {
      client.release();
    }
  }
};

export const deleteStudent = async (req, res) => {
  const { student_id } = req.params;

  if (
    !student_id ||
    isNaN(student_id) ||
    Number(student_id) <= 0
  ) {
    return sendErrorResponse(
      res,
      400,
      "Valid student ID is required."
    );
  }

  try {
    const result = await pool.query(
      `
      DELETE FROM tbl_students
      WHERE student_id = $1
      RETURNING *
      `,
      [student_id]
    );

    if (result.rowCount === 0) {
      return sendErrorResponse(
        res,
        404,
        "Student not found."
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Student deleted successfully.",
      result.rows[0]
    );
  } catch (error) {
    console.error(
      "Delete Student Error:",
      error
    );

    return sendErrorResponse(
      res,
      500,
      error.message ||
        "Failed to delete student."
    );
  }
};

