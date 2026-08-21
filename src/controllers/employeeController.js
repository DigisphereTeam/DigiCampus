import bcrypt from "bcryptjs";
import pool from "../config/database.js";
import {
  sendErrorResponse,
  sendSuccessResponse,
} from "../utils/response.js";

const EMPLOYEE_TYPES = ["TEACHER", "STAFF"];

const GENDERS = [
  "MALE",
  "FEMALE",
  "OTHER",
];

const EMPLOYMENT_TYPES = [
  "FULL_TIME",
  "PART_TIME",
  "CONTRACT",
];

const validateDate = (value) => {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const date = new Date(`${value}T00:00:00`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
};

export async function createEmployee(req, res) {
  const client = await pool.connect();

  try {
    const {
      employee_type,
      full_name,
      email,
      password,
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
    } = req.body || {};

    const errors = {};

    if (
      !employee_type ||
      typeof employee_type !== "string" ||
      !employee_type.trim()
    ) {
      errors.employee_type =
        "Employee type is required";
    } else if (
      !EMPLOYEE_TYPES.includes(
        employee_type.trim().toUpperCase()
      )
    ) {
      errors.employee_type =
        "Employee type must be TEACHER or STAFF";
    }

    if (
      !full_name ||
      typeof full_name !== "string" ||
      !full_name.trim()
    ) {
      errors.full_name =
        "Full name is required";
    } else if (
      full_name.trim().length < 2
    ) {
      errors.full_name =
        "Full name must be at least 2 characters";
    }

    if (
      !email ||
      typeof email !== "string" ||
      !email.trim()
    ) {
      errors.email = "Email is required";
    } else if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        email.trim().toLowerCase()
      )
    ) {
      errors.email =
        "Invalid email address";
    }

    if (
      !password ||
      typeof password !== "string"
    ) {
      errors.password =
        "Password is required";
    } else if (password.length < 6) {
      errors.password =
        "Password must be at least 6 characters";
    }

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

    if (
      employment_type !== undefined &&
      employment_type !== null
    ) {
      if (
        typeof employment_type !== "string" ||
        !employment_type.trim()
      ) {
        errors.employment_type =
          "Employment type cannot be empty";
      } else if (
        !EMPLOYMENT_TYPES.includes(
          employment_type.trim().toUpperCase()
        )
      ) {
        errors.employment_type =
          "Employment type must be FULL_TIME, PART_TIME or CONTRACT";
      }
    }

    if (
      phone !== undefined &&
      phone !== null
    ) {
      const cleanPhone =
        phone.toString().trim();

      if (
        cleanPhone &&
        !/^[6-9]\d{9}$/.test(cleanPhone)
      ) {
        errors.phone =
          "Phone number must be a valid 10-digit Indian mobile number";
      }
    }

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
          date_of_birth.split("-").map(Number);

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
        } else if (dob > new Date()) {
          errors.date_of_birth =
            "Date of birth cannot be in the future";
        }
      }
    }

    if (
      joining_date !== undefined &&
      joining_date !== null &&
      joining_date !== ""
    ) {
      if (
        typeof joining_date !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(
          joining_date
        )
      ) {
        errors.joining_date =
          "Joining date must be in YYYY-MM-DD format";
      } else {
        const [year, month, day] =
          joining_date.split("-").map(Number);

        const joiningDate = new Date(
          year,
          month - 1,
          day
        );

        if (
          joiningDate.getFullYear() !== year ||
          joiningDate.getMonth() !== month - 1 ||
          joiningDate.getDate() !== day
        ) {
          errors.joining_date =
            "Joining date must be a valid date";
        }
      }
    }

    if (
      department_id !== undefined &&
      department_id !== null &&
      department_id !== ""
    ) {
      if (
        !Number.isInteger(
          Number(department_id)
        ) ||
        Number(department_id) <= 0
      ) {
        errors.department_id =
          "Department ID must be a valid positive integer";
      }
    }

    if (
      designation_id !== undefined &&
      designation_id !== null &&
      designation_id !== ""
    ) {
      if (
        !Number.isInteger(
          Number(designation_id)
        ) ||
        Number(designation_id) <= 0
      ) {
        errors.designation_id =
          "Designation ID must be a valid positive integer";
      }
    }

    if (
      address !== undefined &&
      address !== null &&
      typeof address !== "string"
    ) {
      errors.address =
        "Address must be a string";
    }

    if (
      qualification !== undefined &&
      qualification !== null &&
      typeof qualification !== "string"
    ) {
      errors.qualification =
        "Qualification must be a string";
    }

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

    const cleanEmployeeType =
      employee_type.trim().toUpperCase();

    const cleanName =
      full_name.trim();

    const cleanEmail =
      email.trim().toLowerCase();

    const cleanGender =
      gender !== undefined &&
        gender !== null &&
        gender !== ""
        ? gender.trim().toUpperCase()
        : null;

    const cleanEmploymentType =
      employment_type !== undefined &&
        employment_type !== null &&
        employment_type !== ""
        ? employment_type.trim().toUpperCase()
        : null;

    const cleanPhone =
      phone !== undefined &&
        phone !== null &&
        phone !== ""
        ? phone.toString().trim()
        : null;

    await client.query("BEGIN");

    const existingUser =
      await client.query(
        `
          SELECT user_id
          FROM tbl_users
          WHERE LOWER(email) = LOWER($1)
          LIMIT 1
        `,
        [cleanEmail]
      );

    if (existingUser.rows.length > 0) {
      await client.query("ROLLBACK");

      return sendErrorResponse(
        res,
        409,
        "Email already exists"
      );
    }

    const passwordHash =
      await bcrypt.hash(
        password,
        10
      );

    const userResult =
      await client.query(
        `
          INSERT INTO tbl_users (
            full_name,
            email,
            password_hash,
            role
          )
          VALUES ($1, $2, $3, $4)
          RETURNING
            user_id,
            full_name,
            email,
            role,
            is_active,
            created_at
        `,
        [
          cleanName,
          cleanEmail,
          passwordHash,
          cleanEmployeeType,
        ]
      );

    const user =
      userResult.rows[0];

    const currentYear =
      new Date().getFullYear();

    await client.query(
      `SELECT pg_advisory_xact_lock($1)`,
      [currentYear]
    );

    const employeeCodeResult =
      await client.query(
        `
      SELECT COALESCE(
        MAX(
          CAST(
            SUBSTRING(employee_code FROM 8) AS INTEGER
          )
        ),
        0
      ) AS last_number
      FROM tbl_employees
      WHERE employee_code LIKE $1
    `,
        [`EMP${currentYear}%`]
      );

    const nextNumber =
      Number(employeeCodeResult.rows[0].last_number) + 1;

    const employeeCode =
      `EMP${currentYear}${String(nextNumber).padStart(4, "0")}`;

    const employeeResult =
      await client.query(
        `
          INSERT INTO tbl_employees (
            user_id,
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
            employment_type
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            $11,
            COALESCE($12, CURRENT_DATE),
            $13
          )
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
          user.user_id,
          employeeCode,
          cleanEmployeeType,
          department_id ?? null,
          designation_id ?? null,
          cleanGender,
          date_of_birth ?? null,
          cleanPhone,
          address?.trim() || null,
          qualification?.trim() || null,
          specialization?.trim() || null,
          joining_date || null,
          cleanEmploymentType,
        ]
      );

    await client.query("COMMIT");

    return sendSuccessResponse(
      res,
      201,
      `${cleanEmployeeType === "TEACHER"
        ? "Teacher"
        : "Staff"
      } created successfully`,
      {
        user,
        employee:
          employeeResult.rows[0],
      }
    );

  } catch (error) {
    await client.query("ROLLBACK");

    console.error(
      "Create employee error:",
      error
    );

    const message =
      process.env.NODE_ENV === "development"
        ? error.message
        : "Failed to create employee";

    return sendErrorResponse(
      res,
      500,
      message
    );

  } finally {
    client.release();
  }
}

export async function getAllEmployees(req, res) {
  try {
    const { employee_type } = req.query;

    let employeeType = null;

    if (employee_type !== undefined) {
      if (
        typeof employee_type !== "string" ||
        !employee_type.trim()
      ) {
        return sendErrorResponse(
          res,
          400,
          "Invalid employee type"
        );
      }

      employeeType =
        employee_type.trim().toUpperCase();

      if (!EMPLOYEE_TYPES.includes(employeeType)) {
        return sendErrorResponse(
          res,
          400,
          "Employee type must be TEACHER or STAFF"
        );
      }
    }

    const values = [];
    let typeCondition = "";

    if (employeeType) {
      values.push(employeeType);

      typeCondition =
        `AND e.employee_type = $1`;
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

        WHERE 1 = 1
        ${typeCondition}

        ORDER BY e.employee_id DESC
      `,
      values
    );

    return sendSuccessResponse(
      res,
      200,
      employeeType
        ? `${employeeType === "TEACHER"
          ? "Teachers"
          : "Staff"
        } fetched successfully`
        : "Employees fetched successfully",
      result.rows
    );

  } catch (error) {
    console.error(
      "Get employees error:",
      error
    );

    const message =
      process.env.NODE_ENV === "development"
        ? error.message
        : "Failed to fetch employees";

    return sendErrorResponse(
      res,
      500,
      message
    );
  }
}

export async function getEmployeeById(
  req,
  res
) {
  try {
    const { employee_id } =
      req.params;

    if (
      !employee_id ||
      !/^\d+$/.test(employee_id)
    ) {
      return sendErrorResponse(
        res,
        400,
        "Invalid employee ID"
      );
    }

    const result =
      await pool.query(
        `
          SELECT
            e.employee_id,
            e.employee_code,
            u.user_id,
            u.full_name,
            u.email,
            u.role,
            e.employee_type,
            e.department_id,
            e.designation_id,
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
          WHERE e.employee_id = $1
          LIMIT 1
        `,
        [employee_id]
      );

    if (
      result.rows.length === 0
    ) {
      return sendErrorResponse(
        res,
        404,
        "Employee not found"
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Employee fetched successfully",
      result.rows[0]
    );
  } catch (error) {
    console.error(
      "Get employee error:",
      error
    );

    return sendErrorResponse(
      res,
      500,
      "Failed to fetch employee"
    );
  }
}

export async function updateEmployee(
  req,
  res
) {
  const client =
    await pool.connect();

  try {
    const { employee_id } =
      req.params;

    if (
      !employee_id ||
      !/^\d+$/.test(employee_id)
    ) {
      return sendErrorResponse(
        res,
        400,
        "Invalid employee ID"
      );
    }

    const existingResult =
      await client.query(
        `
          SELECT
            employee_id,
            user_id,
            employee_type
          FROM tbl_employees
          WHERE employee_id = $1
          LIMIT 1
        `,
        [employee_id]
      );

    if (
      existingResult.rows.length === 0
    ) {
      return sendErrorResponse(
        res,
        404,
        "Employee not found"
      );
    }

    const employee =
      existingResult.rows[0];

    const {
      employee_type,
      full_name,
      email,
      password,
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
    } = req.body || {};

    const errors = {};

    if (
      employee_type !== undefined
    ) {
      if (
        typeof employee_type !==
        "string" ||
        !employee_type.trim()
      ) {
        errors.employee_type =
          "Employee type cannot be empty";
      } else if (
        !EMPLOYEE_TYPES.includes(
          employee_type
            .trim()
            .toUpperCase()
        )
      ) {
        errors.employee_type =
          "Employee type must be TEACHER or STAFF";
      }
    }

    if (
      full_name !== undefined
    ) {
      if (
        typeof full_name !==
        "string" ||
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

    if (email !== undefined) {
      if (
        typeof email !== "string" ||
        !email.trim()
      ) {
        errors.email =
          "Email cannot be empty";
      } else if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
          email.trim().toLowerCase()
        )
      ) {
        errors.email =
          "Invalid email address";
      }
    }

    if (password !== undefined) {
      if (
        typeof password !== "string" ||
        !password
      ) {
        errors.password =
          "Password cannot be empty";
      } else if (
        password.length < 6
      ) {
        errors.password =
          "Password must be at least 6 characters";
      }
    }

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
          gender
            .trim()
            .toUpperCase()
        )
      ) {
        errors.gender =
          "Gender must be MALE, FEMALE or OTHER";
      }
    }

    if (
      employment_type !== undefined &&
      employment_type !== null
    ) {
      if (
        typeof employment_type !==
        "string" ||
        !employment_type.trim()
      ) {
        errors.employment_type =
          "Employment type cannot be empty";
      } else if (
        !EMPLOYMENT_TYPES.includes(
          employment_type
            .trim()
            .toUpperCase()
        )
      ) {
        errors.employment_type =
          "Employment type must be FULL_TIME, PART_TIME or CONTRACT";
      }
    }

    if (
      phone !== undefined &&
      phone !== null
    ) {
      const cleanPhone =
        phone.toString().trim();

      if (
        cleanPhone &&
        !/^[6-9]\d{9}$/.test(
          cleanPhone
        )
      ) {
        errors.phone =
          "Phone number must be a valid 10-digit Indian mobile number";
      }
    }

    if (
      date_of_birth !== undefined &&
      date_of_birth !== null &&
      date_of_birth !== ""
    ) {
      if (
        !validateDate(date_of_birth)
      ) {
        errors.date_of_birth =
          "Date of birth must be in YYYY-MM-DD format";
      }
    }

    if (
      joining_date !== undefined &&
      joining_date !== null &&
      joining_date !== ""
    ) {
      if (
        !validateDate(joining_date)
      ) {
        errors.joining_date =
          "Joining date must be in YYYY-MM-DD format";
      }
    }

    if (
      department_id !== undefined &&
      department_id !== null &&
      department_id !== ""
    ) {
      if (
        !Number.isInteger(
          Number(department_id)
        ) ||
        Number(department_id) <= 0
      ) {
        errors.department_id =
          "Department ID must be a valid positive integer";
      }
    }

    if (
      designation_id !== undefined &&
      designation_id !== null &&
      designation_id !== ""
    ) {
      if (
        !Number.isInteger(
          Number(designation_id)
        ) ||
        Number(designation_id) <= 0
      ) {
        errors.designation_id =
          "Designation ID must be a valid positive integer";
      }
    }

    if (
      address !== undefined &&
      address !== null &&
      typeof address !== "string"
    ) {
      errors.address =
        "Address must be a string";
    }

    if (
      qualification !== undefined &&
      qualification !== null &&
      typeof qualification !== "string"
    ) {
      errors.qualification =
        "Qualification must be a string";
    }

    if (
      specialization !== undefined &&
      specialization !== null &&
      typeof specialization !== "string"
    ) {
      errors.specialization =
        "Specialization must be a string";
    }

    if (
      is_active !== undefined &&
      typeof is_active !== "boolean"
    ) {
      errors.is_active =
        "is_active must be true or false";
    }

    if (
      Object.keys(errors).length > 0
    ) {
      return sendErrorResponse(
        res,
        400,
        "Validation failed",
        errors
      );
    }

    const userUpdates = [];
    const userValues = [];

    const employeeUpdates = [];
    const employeeValues = [];

    if (
      employee_type !== undefined
    ) {
      userValues.push(
        employee_type
          .trim()
          .toUpperCase()
      );

      userUpdates.push(
        `role = $${userValues.length}`
      );

      employeeValues.push(
        employee_type
          .trim()
          .toUpperCase()
      );

      employeeUpdates.push(
        `employee_type = $${employeeValues.length}`
      );
    }

    if (
      full_name !== undefined
    ) {
      userValues.push(
        full_name.trim()
      );

      userUpdates.push(
        `full_name = $${userValues.length}`
      );
    }

    if (email !== undefined) {
      const cleanEmail =
        email
          .trim()
          .toLowerCase();

      const emailExists =
        await client.query(
          `
            SELECT user_id
            FROM tbl_users
            WHERE LOWER(email) = LOWER($1)
              AND user_id != $2
            LIMIT 1
          `,
          [
            cleanEmail,
            employee.user_id,
          ]
        );

      if (
        emailExists.rows.length > 0
      ) {
        return sendErrorResponse(
          res,
          409,
          "Email already exists"
        );
      }

      userValues.push(cleanEmail);

      userUpdates.push(
        `email = $${userValues.length}`
      );
    }

    if (password !== undefined) {
      const passwordHash =
        await bcrypt.hash(
          password,
          10
        );

      userValues.push(
        passwordHash
      );

      userUpdates.push(
        `password_hash = $${userValues.length}`
      );
    }

    if (
      is_active !== undefined
    ) {
      userValues.push(is_active);

      userUpdates.push(
        `is_active = $${userValues.length}`
      );

      employeeValues.push(is_active);

      employeeUpdates.push(
        `is_active = $${employeeValues.length}`
      );
    }

    if (
      department_id !== undefined
    ) {
      employeeValues.push(
        department_id || null
      );

      employeeUpdates.push(
        `department_id = $${employeeValues.length}`
      );
    }

    if (
      designation_id !== undefined
    ) {
      employeeValues.push(
        designation_id || null
      );

      employeeUpdates.push(
        `designation_id = $${employeeValues.length}`
      );
    }

    if (gender !== undefined) {
      employeeValues.push(
        gender === null
          ? null
          : gender
            .trim()
            .toUpperCase()
      );

      employeeUpdates.push(
        `gender = $${employeeValues.length}`
      );
    }

    if (
      date_of_birth !== undefined
    ) {
      employeeValues.push(
        date_of_birth || null
      );

      employeeUpdates.push(
        `date_of_birth = $${employeeValues.length}`
      );
    }

    if (phone !== undefined) {
      employeeValues.push(
        phone === null
          ? null
          : phone
            .toString()
            .trim()
      );

      employeeUpdates.push(
        `phone = $${employeeValues.length}`
      );
    }

    if (address !== undefined) {
      employeeValues.push(
        address === null
          ? null
          : address.trim()
      );

      employeeUpdates.push(
        `address = $${employeeValues.length}`
      );
    }

    if (
      qualification !== undefined
    ) {
      employeeValues.push(
        qualification === null
          ? null
          : qualification.trim()
      );

      employeeUpdates.push(
        `qualification = $${employeeValues.length}`
      );
    }

    if (
      specialization !== undefined
    ) {
      employeeValues.push(
        specialization === null
          ? null
          : specialization.trim()
      );

      employeeUpdates.push(
        `specialization = $${employeeValues.length}`
      );
    }

    if (
      joining_date !== undefined
    ) {
      employeeValues.push(
        joining_date || null
      );

      employeeUpdates.push(
        `joining_date = $${employeeValues.length}`
      );
    }

    if (
      employment_type !== undefined
    ) {
      employeeValues.push(
        employment_type === null
          ? null
          : employment_type
            .trim()
            .toUpperCase()
      );

      employeeUpdates.push(
        `employment_type = $${employeeValues.length}`
      );
    }

    if (
      userUpdates.length === 0 &&
      employeeUpdates.length === 0
    ) {
      return sendErrorResponse(
        res,
        400,
        "At least one field is required to update"
      );
    }

    await client.query("BEGIN");

    if (userUpdates.length > 0) {
      userUpdates.push(
        "updated_at = CURRENT_TIMESTAMP"
      );

      userValues.push(
        employee.user_id
      );

      await client.query(
        `
          UPDATE tbl_users
          SET ${userUpdates.join(", ")}
          WHERE user_id = $${userValues.length}
        `,
        userValues
      );
    }

    if (
      employeeUpdates.length > 0
    ) {
      employeeUpdates.push(
        "updated_at = CURRENT_TIMESTAMP"
      );

      employeeValues.push(
        employee_id
      );

      await client.query(
        `
          UPDATE tbl_employees
          SET ${employeeUpdates.join(", ")}
          WHERE employee_id = $${employeeValues.length}
        `,
        employeeValues
      );
    }

    await client.query("COMMIT");

    const result =
      await pool.query(
        `
          SELECT
            e.employee_id,
            e.employee_code,
            u.user_id,
            u.full_name,
            u.email,
            u.role,
            e.employee_type,
            e.department_id,
            e.designation_id,
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
          WHERE e.employee_id = $1
          LIMIT 1
        `,
        [employee_id]
      );

    return sendSuccessResponse(
      res,
      200,
      "Employee updated successfully",
      result.rows[0]
    );
  } catch (error) {
    await client.query("ROLLBACK");

    console.error(
      "Update employee error:",
      error
    );

    return sendErrorResponse(
      res,
      500,
      "Failed to update employee"
    );
  } finally {
    client.release();
  }
}

export async function updateEmployeeStatus(req, res) {
  const client = await pool.connect();

  try {
    const { employee_id } = req.params;
    const { is_active } = req.body || {};

    const errors = {};

    if (
      !employee_id ||
      !/^\d+$/.test(employee_id) ||
      Number(employee_id) <= 0
    ) {
      errors.employee_id =
        "Valid employee ID is required";
    }

    if (
      is_active === undefined ||
      is_active === null
    ) {
      errors.is_active =
        "is_active is required";
    } else if (
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

    await client.query("BEGIN");

    const result = await client.query(
      `
        UPDATE tbl_employees
        SET
          is_active = $1,
          updated_at = CURRENT_TIMESTAMP
        WHERE employee_id = $2
        RETURNING
          employee_id,
          employee_code,
          employee_type,
          user_id,
          is_active
      `,
      [
        is_active,
        Number(employee_id)
      ]
    );

    if (result.rows.length === 0) {
      await client.query("ROLLBACK");

      return sendErrorResponse(
        res,
        404,
        `Employee with ID ${employee_id} not found`
      );
    }

    const employee = result.rows[0];

    await client.query(
      `
        UPDATE tbl_users
        SET
          is_active = $1,
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $2
      `,
      [
        is_active,
        employee.user_id
      ]
    );

    await client.query("COMMIT");

    return sendSuccessResponse(
      res,
      200,
      is_active
        ? `${employee.employee_type === "TEACHER"
          ? "Teacher"
          : "Staff"
        } activated successfully`
        : `${employee.employee_type === "TEACHER"
          ? "Teacher"
          : "Staff"
        } deactivated successfully`,
      {
        employee_id:
          employee.employee_id,
        employee_code:
          employee.employee_code,
        employee_type:
          employee.employee_type,
        is_active:
          employee.is_active
      }
    );

  } catch (error) {
    await client.query("ROLLBACK");

    console.error(
      "Update employee status error:",
      error
    );

    const message =
      process.env.NODE_ENV === "development"
        ? error.message
        : "Failed to update employee status";

    return sendErrorResponse(
      res,
      500,
      message
    );

  } finally {
    client.release();
  }
}