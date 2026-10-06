import pool from "../config/database.js";
import {
  sendErrorResponse,
  sendSuccessResponse
} from "../utils/response.js";
import { isValidId } from "../utils/validation.js";

export const getTransportDashboard = async (req, res) => {
  try {
    const vehicleResult = await pool.query(`
      SELECT
        COUNT(*) AS total_vehicles,
        COUNT(*) FILTER (WHERE status = 'ACTIVE') AS active_vehicles
      FROM tbl_transport_vehicles
      WHERE is_active = true
    `);

    const driverResult = await pool.query(`
      SELECT COUNT(DISTINCT driver_id) AS total_drivers
      FROM tbl_transport_vehicles
      WHERE driver_id IS NOT NULL
      AND is_active = true
    `);

    const studentResult = await pool.query(`
      SELECT COUNT(*) AS total_students
      FROM tbl_students
      WHERE vehicle_id IS NOT NULL
      AND transport_status = 'ACTIVE'
      AND is_active = true
    `);

    const vehicleResultList = await pool.query(`
      SELECT
        v.vehicle_id,
        v.vehicle_number,
        v.seating_capacity,
        v.route_name,
        v.status,
        v.driver_id,
        u.full_name AS driver_name,
        COUNT(s.student_id) FILTER (
          WHERE s.transport_status = 'ACTIVE'
          AND s.is_active = true
        ) AS students_count
      FROM tbl_transport_vehicles v
      LEFT JOIN tbl_users u
        ON u.user_id = v.driver_id
      LEFT JOIN tbl_students s
        ON s.vehicle_id = v.vehicle_id
      WHERE v.is_active = true
      GROUP BY
        v.vehicle_id,
        u.full_name
      ORDER BY v.vehicle_id DESC
    `);

    return sendSuccessResponse(
      res,
      200,
      "Transport dashboard fetched successfully",
      {
        statistics: {
          total_vehicles: Number(vehicleResult.rows[0].total_vehicles),
          active_vehicles: Number(vehicleResult.rows[0].active_vehicles),
          drivers: Number(driverResult.rows[0].total_drivers),
          students: Number(studentResult.rows[0].total_students)
        },
        vehicles: vehicleResultList.rows
      }
    );
  } catch (error) {
    console.log("Get transport dashboard error:", error);
    return sendErrorResponse(
      res,
      500,
      "Failed to fetch transport dashboard"
    );
  }
};

export const createVehicle = async (req, res) => {
  try {
    const {
      vehicle_number,
      seating_capacity,
      driver_id,
      route_name,
      status
    } = req.body;

    const driverResult = await pool.query(
      `
        SELECT user_id
        FROM tbl_users
        WHERE user_id = $1
        AND is_active = true
      `,
      [driver_id]
    );

    if (driverResult.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Driver with ID ${driver_id} not found`
      );
    }

    const driverVehicleResult = await pool.query(
      `
        SELECT vehicle_id
        FROM tbl_transport_vehicles
        WHERE driver_id = $1
        AND is_active = true
      `,
      [driver_id]
    );

    if (driverVehicleResult.rows.length > 0) {
      return sendErrorResponse(
        res,
        400,
        `Driver with ID ${driver_id} is already assigned to a vehicle`
      );
    }

    const duplicateResult = await pool.query(
      `
        SELECT vehicle_id
        FROM tbl_transport_vehicles
        WHERE LOWER(vehicle_number) = LOWER($1)
        AND is_active = true
      `,
      [vehicle_number]
    );

    if (duplicateResult.rows.length > 0) {
      return sendErrorResponse(
        res,
        400,
        "Vehicle number already exists"
      );
    }

    const result = await pool.query(
      `
        INSERT INTO tbl_transport_vehicles (
          vehicle_number,
          seating_capacity,
          driver_id,
          route_name,
          status,
          is_active
        )
        VALUES ($1, $2, $3, $4, $5, true)
        RETURNING *
      `,
      [
        vehicle_number,
        seating_capacity,
        driver_id,
        route_name,
        status
      ]
    );

    return sendSuccessResponse(
      res,
      201,
      "Vehicle created successfully",
      result.rows[0]
    );
  } catch (error) {
    console.log("Create vehicle error:", error);

    return sendErrorResponse(
      res,
      500,
      "Failed to create vehicle"
    );
  }
};

export const getVehicles = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        vehicle_id,
        vehicle_number,
        seating_capacity,
        driver_id,
        route_name,
        status,
        is_active,
        created_at,
        updated_at
      FROM tbl_transport_vehicles
      WHERE is_active = true
      ORDER BY vehicle_id DESC
    `);

    const statisticsResult = await pool.query(`
      SELECT
        COUNT(DISTINCT v.vehicle_id) AS total_vehicles,
        COUNT(DISTINCT v.driver_id) AS total_drivers,
        COUNT(DISTINCT s.student_id) AS total_students,
        COUNT(DISTINCT v.vehicle_id) FILTER (
          WHERE v.status = 'ACTIVE'
        ) AS active_vehicles,
        COUNT(DISTINCT v.vehicle_id) FILTER (
          WHERE v.status = 'INACTIVE'
        ) AS inactive_vehicles,
        COUNT(DISTINCT v.vehicle_id) FILTER (
          WHERE v.status = 'MAINTENANCE'
        ) AS maintenance_vehicles
      FROM tbl_transport_vehicles v
      LEFT JOIN tbl_students s
        ON s.vehicle_id = v.vehicle_id
        AND s.transport_status = 'ACTIVE'
        AND s.is_active = true
      WHERE v.is_active = true
    `);

    const statistics = {
      total_vehicles: Number(statisticsResult.rows[0].total_vehicles),
      total_drivers: Number(statisticsResult.rows[0].total_drivers),
      total_students: Number(statisticsResult.rows[0].total_students),
      active_vehicles: Number(statisticsResult.rows[0].active_vehicles),
      inactive_vehicles: Number(statisticsResult.rows[0].inactive_vehicles),
      maintenance_vehicles: Number(
        statisticsResult.rows[0].maintenance_vehicles
      )
    };

    return sendSuccessResponse(
      res,
      200,
      "Vehicles fetched successfully",
      {
        statistics,
        vehicles: result.rows
      }
    );
  } catch (error) {
    console.log("Get vehicles error:", error);

    return sendErrorResponse(
      res,
      500,
      "Failed to fetch vehicles"
    );
  }
};

export const getVehicleById = async (req, res) => {
  try {
    const { vehicle_id } = req.params;

    if (!isValidId(vehicle_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid vehicle ID is required"
      );
    }

    const vehicleResult = await pool.query(
      `
        SELECT
          v.vehicle_id,
          v.vehicle_number,
          v.seating_capacity,
          v.driver_id,
          u.full_name AS driver_name,
          v.route_name,
          v.status
        FROM tbl_transport_vehicles v
        LEFT JOIN tbl_users u
          ON u.user_id = v.driver_id
        WHERE v.vehicle_id = $1
        AND v.is_active = true
      `,
      [vehicle_id]
    );

    if (vehicleResult.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Vehicle with ID ${vehicle_id} not found`
      );
    }

    const studentsResult = await pool.query(
      `
        SELECT
          s.student_id,
          s.full_name AS student_name,
          s.pickup_stop,
          s.pickup_time,
          s.transport_status,
          c.class_name,
          sec.section_name
        FROM tbl_students s
        LEFT JOIN tbl_student_class_sections scs
          ON scs.student_id = s.student_id
          AND scs.is_active = true
        LEFT JOIN tbl_class_sections cs
          ON cs.class_section_id = scs.class_section_id
        LEFT JOIN tbl_classes c
          ON c.class_id = cs.class_id
        LEFT JOIN tbl_sections sec
          ON sec.section_id = cs.section_id
        WHERE s.vehicle_id = $1
        AND s.transport_status = 'ACTIVE'
        AND s.is_active = true
        ORDER BY s.full_name
      `,
      [vehicle_id]
    );

    return sendSuccessResponse(
      res,
      200,
      "Vehicle fetched successfully",
      {
        ...vehicleResult.rows[0],
        students_count: studentsResult.rows.length,
        students: studentsResult.rows
      }
    );
  } catch (error) {
    console.log("Get vehicle error:", error);
    return sendErrorResponse(
      res,
      500,
      "Failed to fetch vehicle"
    );
  }
};

export const updateVehicle = async (req, res) => {
  try {
    const { vehicle_id } = req.params;

    const {
      vehicle_number,
      seating_capacity,
      driver_id,
      route_name,
      status
    } = req.body;

    if (!isValidId(vehicle_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid vehicle ID is required"
      );
    }

    const existingResult = await pool.query(
      `
      SELECT vehicle_id
      FROM tbl_transport_vehicles
      WHERE vehicle_id = $1
        AND is_active = true
      `,
      [vehicle_id]
    );

    if (existingResult.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Vehicle with ID ${vehicle_id} not found`
      );
    }

    if (driver_id !== undefined && driver_id !== null) {
      const driverResult = await pool.query(
        `
        SELECT user_id
        FROM tbl_users
        WHERE user_id = $1
          AND is_active = true
        `,
        [driver_id]
      );

      if (driverResult.rows.length === 0) {
        return sendErrorResponse(
          res,
          404,
          `Driver with ID ${driver_id} not found`
        );
      }
    }

    const fields = [];
    const values = [];

    if (vehicle_number !== undefined) {
      fields.push(`vehicle_number = $${values.length + 1}`);
      values.push(vehicle_number);
    }

    if (seating_capacity !== undefined) {
      fields.push(`seating_capacity = $${values.length + 1}`);
      values.push(seating_capacity);
    }

    if (driver_id !== undefined) {
      fields.push(`driver_id = $${values.length + 1}`);
      values.push(driver_id);
    }

    if (route_name !== undefined) {
      fields.push(`route_name = $${values.length + 1}`);
      values.push(route_name);
    }

    if (status !== undefined) {
      fields.push(`status = $${values.length + 1}`);
      values.push(status);
    }

    fields.push("updated_at = CURRENT_TIMESTAMP");

    values.push(vehicle_id);

    const result = await pool.query(
      `
      UPDATE tbl_transport_vehicles
      SET ${fields.join(", ")}
      WHERE vehicle_id = $${values.length}
      RETURNING *
      `,
      values
    );

    return sendSuccessResponse(
      res,
      200,
      "Vehicle updated successfully",
      result.rows[0]
    );
  } catch (error) {
    console.log("Update vehicle error:", error);

    if (error.code === "23505") {
      return sendErrorResponse(
        res,
        409,
        "Vehicle number already exists"
      );
    }

    if (error.code === "23503") {
      return sendErrorResponse(
        res,
        400,
        "Invalid reference ID"
      );
    }

    return sendErrorResponse(
      res,
      500,
      "Failed to update vehicle"
    );
  }
};

export const updateVehicleStatus = async (req, res) => {
  try {
    const { vehicle_id } = req.params;
    const { status } = req.body;

    if (!isValidId(vehicle_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid vehicle ID is required"
      );
    }

    const result = await pool.query(
      `
        UPDATE tbl_transport_vehicles
        SET
          status = $1,
          updated_at = CURRENT_TIMESTAMP
        WHERE vehicle_id = $2
        AND is_active = true
        RETURNING *
      `,
      [status, vehicle_id]
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Vehicle with ID ${vehicle_id} not found`
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Vehicle status updated successfully",
      result.rows[0]
    );
  } catch (error) {
    console.log("Update vehicle status error:", error);
    return sendErrorResponse(
      res,
      500,
      "Failed to update vehicle status"
    );
  }
};

export const addStudentsToTransport = async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      student_ids,
      vehicle_id,
      pickup_stop,
      pickup_time
    } = req.body;

    await client.query("BEGIN");

    const vehicleResult = await client.query(
      `
        SELECT
          vehicle_id,
          seating_capacity,
          status
        FROM tbl_transport_vehicles
        WHERE vehicle_id = $1
        AND is_active = true
        FOR UPDATE
      `,
      [vehicle_id]
    );

    if (vehicleResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return sendErrorResponse(
        res,
        404,
        `Vehicle with ID ${vehicle_id} not found`
      );
    }

    const vehicle = vehicleResult.rows[0];

    if (vehicle.status !== "ACTIVE") {
      await client.query("ROLLBACK");

      return sendErrorResponse(
        res,
        400,
        "Selected vehicle is not active"
      );
    }

    const studentResult = await client.query(
      `
        SELECT
          student_id,
          full_name,
          vehicle_id,
          transport_status
        FROM tbl_students
        WHERE student_id = ANY($1::int[])
        AND is_active = true
        FOR UPDATE
      `,
      [student_ids]
    );

    if (studentResult.rows.length !== student_ids.length) {
      await client.query("ROLLBACK");

      const foundStudentIds = new Set(
        studentResult.rows.map((student) => student.student_id)
      );

      const invalidStudentIds = student_ids.filter(
        (studentId) => !foundStudentIds.has(studentId)
      );

      return sendErrorResponse(
        res,
        404,
        `Student with ID ${invalidStudentIds[0]} not found`
      );
    }

    const alreadyAssignedStudent = studentResult.rows.find(
      (student) =>
        student.vehicle_id &&
        student.transport_status === "ACTIVE"
    );

    if (alreadyAssignedStudent) {
      await client.query("ROLLBACK");

      return sendErrorResponse(
        res,
        400,
        `Student with ID ${alreadyAssignedStudent.student_id} is already assigned to a vehicle`
      );
    }

    const capacityResult = await client.query(
      `
        SELECT COUNT(*) AS students_count
        FROM tbl_students
        WHERE vehicle_id = $1
        AND transport_status = 'ACTIVE'
        AND is_active = true
      `,
      [vehicle_id]
    );

    const currentStudentsCount = Number(
      capacityResult.rows[0].students_count
    );

    const requestedStudentsCount = student_ids.length;

    const availableSeats =
      Number(vehicle.seating_capacity) - currentStudentsCount;

    if (requestedStudentsCount > availableSeats) {
      await client.query("ROLLBACK");

      return sendErrorResponse(
        res,
        400,
        `Vehicle has only ${availableSeats} available seats`
      );
    }

    const result = await client.query(
      `
        UPDATE tbl_students
        SET
          vehicle_id = $1,
          pickup_stop = $2,
          pickup_time = $3,
          transport_status = 'ACTIVE',
          updated_at = CURRENT_TIMESTAMP
        WHERE student_id = ANY($4::int[])
        RETURNING
          student_id,
          full_name,
          vehicle_id,
          pickup_stop,
          pickup_time,
          transport_status
      `,
      [
        vehicle_id,
        pickup_stop,
        pickup_time,
        student_ids
      ]
    );

    await client.query("COMMIT");

    return sendSuccessResponse(
      res,
      200,
      "Students added to transport successfully",
      result.rows
    );
  } catch (error) {
    await client.query("ROLLBACK");

    console.log("Add students to transport error:", error);

    return sendErrorResponse(
      res,
      500,
      "Failed to add students to transport"
    );
  } finally {
    client.release();
  }
};

export const getVehicleStudents = async (req, res) => {
  try {
    const { vehicle_id } = req.params;

    if (!isValidId(vehicle_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid vehicle ID is required"
      );
    }

    const vehicleResult = await pool.query(
      `
        SELECT
          vehicle_id,
          vehicle_number,
          seating_capacity,
          route_name,
          status
        FROM tbl_transport_vehicles
        WHERE vehicle_id = $1
        AND is_active = true
      `,
      [vehicle_id]
    );

    if (vehicleResult.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Vehicle with ID ${vehicle_id} not found`
      );
    }

    const studentResult = await pool.query(
      `
        SELECT
          student_id,
          admission_number,
          full_name,
          date_of_birth,
          gender,
          phone_number,
          email,
          pickup_stop,
          pickup_time,
          transport_status
        FROM tbl_students
        WHERE vehicle_id = $1
        AND transport_status = 'ACTIVE'
        AND is_active = true
        ORDER BY pickup_time ASC, student_id ASC
      `,
      [vehicle_id]
    );

    return sendSuccessResponse(
      res,
      200,
      "Vehicle students fetched successfully",
      {
        vehicle: vehicleResult.rows[0],
        student_count: studentResult.rows.length,
        students: studentResult.rows
      }
    );
  } catch (error) {
    console.log("Get vehicle students error:", error);

    return sendErrorResponse(
      res,
      500,
      "Failed to fetch vehicle students"
    );
  }
};


export const removeStudentFromTransport = async (req, res) => {
  try {
    const { student_id } = req.params;

    if (!isValidId(student_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid student ID is required"
      );
    }

    const result = await pool.query(
      `
        UPDATE tbl_students
        SET
          vehicle_id = NULL,
          pickup_stop = NULL,
          pickup_time = NULL,
          transport_status = 'INACTIVE',
          updated_at = CURRENT_TIMESTAMP
        WHERE student_id = $1
        AND transport_status = 'ACTIVE'
        AND is_active = true
        RETURNING
          student_id,
          full_name,
          vehicle_id,
          pickup_stop,
          pickup_time,
          transport_status
      `,
      [student_id]
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Student with ID ${student_id} is not assigned to transport`
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Student removed from transport successfully",
      result.rows[0]
    );
  } catch (error) {
    console.log("Remove student from transport error:", error);
    return sendErrorResponse(
      res,
      500,
      "Failed to remove student from transport"
    );
  }
};