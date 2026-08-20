import pool from "../config/database.js";


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
  } = req.body;

  try {
    if (!admission_number || !full_name) {
      return sendErrorResponse(
        res,
        400,
        "Admission number and full name are required."
      );
    }

    if (
      gender &&
      !["MALE", "FEMALE", "OTHER"].includes(gender.toUpperCase())
    ) {
      return sendErrorResponse(
        res,
        400,
        "Gender must be MALE, FEMALE or OTHER."
      );
    }

    const existingStudent = await pool.query(
      `
      SELECT student_id
      FROM tbl_students
      WHERE admission_number = $1
      `,
      [admission_number.trim()]
    );

    if (existingStudent.rowCount > 0) {
      return sendErrorResponse(
        res,
        409,
        "Admission number already exists."
      );
    }

    if (email) {
      const existingEmail = await pool.query(
        `
        SELECT student_id
        FROM tbl_students
        WHERE LOWER(email) = LOWER($1)
        `,
        [email.trim()]
      );

      if (existingEmail.rowCount > 0) {
        return sendErrorResponse(
          res,
          409,
          "Email already exists."
        );
      }
    }

    const result = await pool.query(
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
      ($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9::date,CURRENT_DATE))
      RETURNING *;
      `,
      [
        admission_number.trim(),
        full_name.trim(),
        gender ? gender.toUpperCase() : null,
        date_of_birth || null,
        phone?.trim() || null,
        email?.trim().toLowerCase() || null,
        address?.trim() || null,
        blood_group?.trim() || null,
        admission_date || null,
      ]
    );

    return sendSuccessResponse(
      res,
      201,
      "Student created successfully.",
      result.rows[0]
    );
  } catch (error) {
    console.error("Create Student Error:", error);

    return sendErrorResponse(
      res,
      500,
      error.message || "Internal Server Error"
    );
  }
};

export const getAllStudents = async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        student_id,
        user_id,
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
        created_at,
        updated_at
      FROM tbl_students
      ORDER BY student_id DESC;
      `
    );

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
      error.message || "Internal Server Error"
    );
  }
};

export const getStudentById = async (req, res) => {
  const { student_id } = req.params;

  if (!student_id || isNaN(student_id)) {
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
        student_id,
        user_id,
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
        created_at,
        updated_at
      FROM tbl_students
      WHERE student_id = $1;
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
    console.error("Get Student Error:", error);

    return sendErrorResponse(
      res,
      500,
      error.message || "Internal Server Error"
    );
  }
};

export const updateStudent = async (req, res) => {
  const { student_id } = req.params;

  if (!student_id || isNaN(student_id)) {
    return sendErrorResponse(
      res,
      400,
      "Valid student ID is required."
    );
  }

  try {
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
    ];

    const updates = [];
    const values = [];
    let index = 1;

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (field === "gender" && req.body[field]) {
          const gender = req.body[field].toUpperCase();

          if (!["MALE", "FEMALE", "OTHER"].includes(gender)) {
            return sendErrorResponse(
              res,
              400,
              "Gender must be MALE, FEMALE or OTHER."
            );
          }

          updates.push(`${field} = $${index}`);
          values.push(gender);
        } else if (field === "email" && req.body[field]) {
          updates.push(`${field} = $${index}`);
          values.push(req.body[field].trim().toLowerCase());
        } else if (
          typeof req.body[field] === "string"
        ) {
          updates.push(`${field} = $${index}`);
          values.push(req.body[field].trim());
        } else {
          updates.push(`${field} = $${index}`);
          values.push(req.body[field]);
        }

        index++;
      }
    }

    if (updates.length === 0) {
      return sendErrorResponse(
        res,
        400,
        "No fields provided to update."
      );
    }

    if (req.body.admission_number) {
      const existingAdmission = await pool.query(
        `
        SELECT student_id
        FROM tbl_students
        WHERE admission_number = $1
        AND student_id <> $2
        `,
        [
          req.body.admission_number.trim(),
          student_id,
        ]
      );

      if (existingAdmission.rowCount > 0) {
        return sendErrorResponse(
          res,
          409,
          "Admission number already exists."
        );
      }
    }

    if (req.body.email) {
      const existingEmail = await pool.query(
        `
        SELECT student_id
        FROM tbl_students
        WHERE LOWER(email) = LOWER($1)
        AND student_id <> $2
        `,
        [
          req.body.email.trim(),
          student_id,
        ]
      );

      if (existingEmail.rowCount > 0) {
        return sendErrorResponse(
          res,
          409,
          "Email already exists."
        );
      }
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    values.push(student_id);

    const result = await pool.query(
      `
      UPDATE tbl_students
      SET ${updates.join(", ")}
      WHERE student_id = $${index}
      RETURNING *;
      `,
      values
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
      "Student updated successfully.",
      result.rows[0]
    );
  } catch (error) {
    console.error("Update Student Error:", error);

    return sendErrorResponse(
      res,
      500,
      error.message || "Internal Server Error"
    );
  }
};

export const deleteStudent = async (req, res) => {
  const { student_id } = req.params;

  if (!student_id || isNaN(student_id)) {
    return sendErrorResponse(
      res,
      400,
      "Valid student ID is required."
    );
  }

  try {
    const result = await pool.query(
      `
      UPDATE tbl_students
      SET
        is_active = FALSE,
        updated_at = CURRENT_TIMESTAMP
      WHERE student_id = $1
      AND is_active = TRUE
      RETURNING *;
      `,
      [student_id]
    );

    if (result.rowCount === 0) {
      return sendErrorResponse(
        res,
        404,
        "Active student not found."
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Student deactivated successfully.",
      result.rows[0]
    );
  } catch (error) {
    console.error("Delete Student Error:", error);

    return sendErrorResponse(
      res,
      500,
      error.message || "Internal Server Error"
    );
  }
};