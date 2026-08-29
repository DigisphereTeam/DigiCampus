import pool from "../config/database.js";
import {
  sendErrorResponse,
  sendSuccessResponse
} from "../utils/response.js";

export async function getTeacherProfile(req, res) {
  try {
    const userId = req.user?.user_id;

    if (!userId) {
      return sendErrorResponse(
        res,
        401,
        "Unauthorized"
      );
    }

    const result = await pool.query(
      `
        SELECT
          e.employee_id,
          e.employee_code,

          u.user_id,
          u.full_name,
          u.email,
          u.role,
          u.is_active AS user_is_active,

          e.employee_type,

          e.department_id,
          d.department_name,

          e.designation_id,
          des.designation_name,

          e.gender,
          e.date_of_birth,
          e.phone,
          e.address,
          e.qualification,
          e.specialization,
          e.joining_date,
          e.employment_type,
          e.is_active,

          e.created_at,
          e.updated_at

        FROM tbl_employees e

        INNER JOIN tbl_users u
          ON u.user_id = e.user_id

        LEFT JOIN tbl_departments d
          ON d.department_id = e.department_id

        LEFT JOIN tbl_designations des
          ON des.designation_id = e.designation_id

        WHERE e.user_id = $1
          AND e.employee_type = 'TEACHER'
        LIMIT 1
      `,
      [userId]
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Teacher profile not found for user ID ${userId}`
      );
    }

    const teacher = result.rows[0];

    return sendSuccessResponse(
      res,
      200,
      "Teacher profile fetched successfully",
      teacher
    );

  } catch (error) {
    console.error(
      "Get teacher profile error:",
      error
    );

    const message =
      process.env.NODE_ENV === "development"
        ? error.message
        : "Failed to fetch teacher profile";

    return sendErrorResponse(
      res,
      500,
      message
    );
  }
}


export async function updateTeacherProfile(req, res) {
  try {
    const userId = req.user?.user_id;

    if (!userId) {
      return sendErrorResponse(
        res,
        401,
        "Unauthorized"
      );
    }

    const {
      full_name,
      phone,
      gender,
      date_of_birth,
      address,
      qualification,
      specialization
    } = req.body || {};

    const errors = {};

    // Full name
    if (full_name !== undefined) {
      if (
        typeof full_name !== "string" ||
        !full_name.trim()
      ) {
        errors.full_name =
          "Full name cannot be empty";
      } else if (
        full_name.trim().length < 2
      ) {
        errors.full_name =
          "Full name must be at least 2 characters";
      }
    }

    // Phone
    if (
      phone !== undefined &&
      phone !== null &&
      phone !== ""
    ) {
      const cleanPhone =
        phone.toString().trim();

      if (
        !/^[6-9]\d{9}$/.test(cleanPhone)
      ) {
        errors.phone =
          "Phone number must be a valid 10-digit Indian mobile number";
      }
    }

    // Gender
    if (
      gender !== undefined &&
      gender !== null
    ) {
      if (
        typeof gender !== "string" ||
        !gender.trim()
      ) {
        errors.gender =
          "Gender cannot be empty";
      } else if (
        !GENDERS.includes(
          gender.trim().toUpperCase()
        )
      ) {
        errors.gender =
          "Gender must be MALE, FEMALE or OTHER";
      }
    }

    // Date of birth
    if (
      date_of_birth !== undefined &&
      date_of_birth !== null &&
      date_of_birth !== ""
    ) {
      if (
        typeof date_of_birth !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(
          date_of_birth
        )
      ) {
        errors.date_of_birth =
          "Date of birth must be in YYYY-MM-DD format";
      } else {
        const [year, month, day] =
          date_of_birth
            .split("-")
            .map(Number);

        const dob = new Date(
          year,
          month - 1,
          day
        );

        if (
          dob.getFullYear() !== year ||
          dob.getMonth() !== month - 1 ||
          dob.getDate() !== day
        ) {
          errors.date_of_birth =
            "Date of birth must be a valid date";
        } else if (
          dob > new Date()
        ) {
          errors.date_of_birth =
            "Date of birth cannot be in the future";
        }
      }
    }

    // Address
    if (
      address !== undefined &&
      address !== null &&
      typeof address !== "string"
    ) {
      errors.address =
        "Address must be a string";
    }

    // Qualification
    if (
      qualification !== undefined &&
      qualification !== null &&
      typeof qualification !== "string"
    ) {
      errors.qualification =
        "Qualification must be a string";
    }

    // Specialization
    if (
      specialization !== undefined &&
      specialization !== null &&
      typeof specialization !== "string"
    ) {
      errors.specialization =
        "Specialization must be a string";
    }

    if (Object.keys(errors).length > 0) {
      return sendErrorResponse(
        res,
        400,
        "Validation failed",
        errors
      );
    }

    // Check if at least one field is provided
    if (
      full_name === undefined &&
      phone === undefined &&
      gender === undefined &&
      date_of_birth === undefined &&
      address === undefined &&
      qualification === undefined &&
      specialization === undefined
    ) {
      return sendErrorResponse(
        res,
        400,
        "At least one field is required"
      );
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Check teacher
      const teacherResult =
        await client.query(
          `
            SELECT
              e.employee_id,
              e.user_id
            FROM tbl_employees e
            WHERE e.user_id = $1
              AND e.employee_type = 'TEACHER'
            LIMIT 1
          `,
          [userId]
        );

      if (
        teacherResult.rows.length === 0
      ) {
        await client.query("ROLLBACK");

        return sendErrorResponse(
          res,
          404,
          `Teacher profile not found for user ID ${userId}`
        );
      }

      // Update user table
      if (full_name !== undefined) {
        await client.query(
          `
            UPDATE tbl_users
            SET
              full_name = $1,
              updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $2
          `,
          [
            full_name.trim(),
            userId
          ]
        );
      }

      // Update employee table
      await client.query(
        `
            UPDATE tbl_employees
            SET
              phone = COALESCE($1, phone),
              gender = COALESCE($2, gender),
              date_of_birth = COALESCE($3, date_of_birth),
              address = COALESCE($4, address),
              qualification = COALESCE($5, qualification),
              specialization = COALESCE($6, specialization),
              updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $7
              AND employee_type = 'TEACHER'
            RETURNING
              employee_id,
              employee_code,
              employee_type,
              department_id,
              designation_id,
              gender,
              date_of_birth,
              phone,
              address,
              qualification,
              specialization,
              joining_date,
              employment_type,
              is_active,
              created_at,
              updated_at
          `,
        [
          phone !== undefined
            ? phone.toString().trim()
            : null,

          gender !== undefined
            ? gender.trim().toUpperCase()
            : null,

          date_of_birth !== undefined
            ? date_of_birth
            : null,

          address !== undefined
            ? address.trim()
            : null,

          qualification !== undefined
            ? qualification.trim()
            : null,

          specialization !== undefined
            ? specialization.trim()
            : null,

          userId
        ]
      );

      await client.query("COMMIT");

      // Get updated profile
      const profileResult =
        await pool.query(
          `
            SELECT
              e.employee_id,
              e.employee_code,

              u.user_id,
              u.full_name,
              u.email,
              u.role,
              u.is_active AS user_is_active,

              e.employee_type,

              e.department_id,
              d.department_name,

              e.designation_id,
              des.designation_name,

              e.gender,
              e.date_of_birth,
              e.phone,
              e.address,
              e.qualification,
              e.specialization,
              e.joining_date,
              e.employment_type,
              e.is_active,

              e.created_at,
              e.updated_at

            FROM tbl_employees e

            INNER JOIN tbl_users u
              ON u.user_id = e.user_id

            LEFT JOIN tbl_departments d
              ON d.department_id =
                e.department_id

            LEFT JOIN tbl_designations des
              ON des.designation_id =
                e.designation_id

            WHERE e.user_id = $1
              AND e.employee_type = 'TEACHER'
            LIMIT 1
          `,
          [userId]
        );

      return sendSuccessResponse(
        res,
        200,
        "Teacher profile updated successfully",
        profileResult.rows[0]
      );

    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error(
      "Update teacher profile error:",
      error
    );

    const message =
      process.env.NODE_ENV === "development"
        ? error.message
        : "Failed to update teacher profile";

    return sendErrorResponse(
      res,
      500,
      message
    );
  }
}

export async function changeTeacherPassword(req, res) {
  try {
    const userId = req.user?.user_id;

    if (!userId) {
      return sendErrorResponse(
        res,
        401,
        "Unauthorized"
      );
    }

    const {
      current_password,
      new_password,
      confirm_password
    } = req.body || {};

    const errors = {};

    if (
      !current_password ||
      typeof current_password !== "string"
    ) {
      errors.current_password =
        "Current password is required";
    }

    if (
      !new_password ||
      typeof new_password !== "string"
    ) {
      errors.new_password =
        "New password is required";
    } else if (new_password.length < 6) {
      errors.new_password =
        "New password must be at least 6 characters";
    }

    if (
      !confirm_password ||
      typeof confirm_password !== "string"
    ) {
      errors.confirm_password =
        "Confirm password is required";
    }

    if (
      new_password &&
      confirm_password &&
      new_password !== confirm_password
    ) {
      errors.confirm_password =
        "Passwords do not match";
    }

    if (
      current_password &&
      new_password &&
      current_password === new_password
    ) {
      errors.new_password =
        "New password must be different from current password";
    }

    if (Object.keys(errors).length > 0) {
      return sendErrorResponse(
        res,
        400,
        "Validation failed",
        errors
      );
    }

    const result = await pool.query(
      `
        SELECT
          u.user_id,
          u.password_hash,
          u.is_active,
          e.employee_type
        FROM tbl_users u
        INNER JOIN tbl_employees e
          ON e.user_id = u.user_id
        WHERE u.user_id = $1
          AND e.employee_type = 'TEACHER'
        LIMIT 1
      `,
      [userId]
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Teacher profile not found for user ID ${userId}`
      );
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return sendErrorResponse(
        res,
        403,
        "Teacher account is inactive"
      );
    }

    const passwordMatch =
      await bcrypt.compare(
        current_password,
        user.password_hash
      );

    if (!passwordMatch) {
      return sendErrorResponse(
        res,
        400,
        "Current password is incorrect"
      );
    }

    const passwordHash =
      await bcrypt.hash(
        new_password,
        10
      );

    await pool.query(
      `
        UPDATE tbl_users
        SET
          password_hash = $1,
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $2
      `,
      [
        passwordHash,
        userId
      ]
    );

    return sendSuccessResponse(
      res,
      200,
      "Password changed successfully"
    );

  } catch (error) {
    console.error(
      "Change teacher password error:",
      error
    );

    const message =
      process.env.NODE_ENV === "development"
        ? error.message
        : "Failed to change password";

    return sendErrorResponse(
      res,
      500,
      message
    );
  }
}

export async function getTeacherClasses(req, res) {
  try {
    const userId = req.user?.user_id;

    if (!userId) {
      return sendErrorResponse(
        res,
        401,
        "Unauthorized"
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

          cs.class_teacher_id,

          e.employee_code,
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

        INNER JOIN tbl_employees e
          ON e.employee_id =
             cs.class_teacher_id

        INNER JOIN tbl_users u
          ON u.user_id = e.user_id

        WHERE e.user_id = $1
          AND e.employee_type = 'TEACHER'
          AND e.is_active = TRUE
          AND u.is_active = TRUE
          AND cs.is_active = TRUE

        ORDER BY
          c.class_id ASC,
          s.section_name ASC
      `,
      [userId]
    );

    return sendSuccessResponse(
      res,
      200,
      "Teacher classes fetched successfully",
      result.rows
    );

  } catch (error) {
    console.error(
      "Get teacher classes error:",
      error
    );

    const message =
      process.env.NODE_ENV === "development"
        ? error.message
        : "Failed to fetch teacher classes";

    return sendErrorResponse(
      res,
      500,
      message
    );
  }
}