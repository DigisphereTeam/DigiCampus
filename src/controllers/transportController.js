import pool from "../config/database.js";

export const createVehicle = async (req, res) => {
  const {
    vehicle_number,
    vehicle_type,
    model,
    capacity,
    driver_name,
    driver_phone,
  } = req.body;

  try {
    if (
      !vehicle_number ||
      !vehicle_type ||
      capacity == null
    ) {
      return res.status(400).json({
        success: false,
        message: "Vehicle number, vehicle type and capacity are required.",
      });
    }

    if (Number(capacity) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Capacity must be greater than 0.",
      });
    }

    if (
      driver_phone &&
      !/^[6-9]\d{9}$/.test(driver_phone)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid driver phone number.",
      });
    }

    const existingVehicle = await pool.query(
      `
      SELECT vehicle_id
      FROM tbl_transport_vehicles
      WHERE LOWER(vehicle_number) = LOWER($1)
      `,
      [vehicle_number.trim()]
    );

    if (existingVehicle.rowCount > 0) {
      return res.status(409).json({
        success: false,
        message: "Vehicle number already exists.",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO tbl_transport_vehicles
      (
        vehicle_number,
        vehicle_type,
        model,
        capacity,
        driver_name,
        driver_phone
      )
      VALUES
      ($1,$2,$3,$4,$5,$6)
      RETURNING *;
      `,
      [
        vehicle_number.trim(),
        vehicle_type.trim(),
        model?.trim() || null,
        Number(capacity),
        driver_name?.trim() || null,
        driver_phone?.trim() || null,
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Vehicle created successfully.",
      data: result.rows[0],
    });

  } catch (error) {
    console.error("Create Vehicle Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};


export const getAllVehicles = async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT *
      FROM tbl_transport_vehicles
      WHERE is_active = TRUE
      ORDER BY vehicle_id DESC;
      `
    );

    return res.status(200).json({
      success: true,
      message: "Vehicles fetched successfully.",
      data: result.rows,
    });

  } catch (error) {
    console.error("Get Vehicles Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};


export const getVehicleById = async (req, res) => {
  const { vehicle_id } = req.params;

  try {
    if (
      !vehicle_id ||
      isNaN(vehicle_id) ||
      Number(vehicle_id) <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid vehicle ID is required.",
      });
    }

    const result = await pool.query(
      `
      SELECT *
      FROM tbl_transport_vehicles
      WHERE vehicle_id = $1
      AND is_active = TRUE;
      `,
      [vehicle_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Vehicle fetched successfully.",
      data: result.rows[0],
    });

  } catch (error) {
    console.error("Get Vehicle Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};


export const updateVehicle = async (req, res) => {
  const { vehicle_id } = req.params;

  const {
    vehicle_number,
    vehicle_type,
    model,
    capacity,
    driver_name,
    driver_phone,
  } = req.body;

  try {
    if (
      !vehicle_id ||
      isNaN(vehicle_id) ||
      Number(vehicle_id) <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid vehicle ID is required.",
      });
    }

    if (
      !vehicle_number ||
      !vehicle_type ||
      capacity == null
    ) {
      return res.status(400).json({
        success: false,
        message: "Vehicle number, vehicle type and capacity are required.",
      });
    }

    if (Number(capacity) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Capacity must be greater than 0.",
      });
    }

    if (
      driver_phone &&
      !/^[6-9]\d{9}$/.test(driver_phone)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid driver phone number.",
      });
    }

    const existingVehicle = await pool.query(
      `
      SELECT vehicle_id
      FROM tbl_transport_vehicles
      WHERE LOWER(vehicle_number) = LOWER($1)
      AND vehicle_id != $2
      `,
      [
        vehicle_number.trim(),
        vehicle_id,
      ]
    );

    if (existingVehicle.rowCount > 0) {
      return res.status(409).json({
        success: false,
        message: "Vehicle number already exists.",
      });
    }

    const result = await pool.query(
      `
      UPDATE tbl_transport_vehicles
      SET
        vehicle_number = $1,
        vehicle_type = $2,
        model = $3,
        capacity = $4,
        driver_name = $5,
        driver_phone = $6,
        updated_at = CURRENT_TIMESTAMP
      WHERE vehicle_id = $7
      AND is_active = TRUE
      RETURNING *;
      `,
      [
        vehicle_number.trim(),
        vehicle_type.trim(),
        model?.trim() || null,
        Number(capacity),
        driver_name?.trim() || null,
        driver_phone?.trim() || null,
        vehicle_id,
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Vehicle updated successfully.",
      data: result.rows[0],
    });

  } catch (error) {
    console.error("Update Vehicle Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};


export const deleteVehicle = async (req, res) => {
  const { vehicle_id } = req.params;

  try {
    if (
      !vehicle_id ||
      isNaN(vehicle_id) ||
      Number(vehicle_id) <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid vehicle ID is required.",
      });
    }

    const result = await pool.query(
      `
      UPDATE tbl_transport_vehicles
      SET
        is_active = FALSE,
        updated_at = CURRENT_TIMESTAMP
      WHERE vehicle_id = $1
      AND is_active = TRUE
      RETURNING *;
      `,
      [vehicle_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Vehicle deleted successfully.",
      data: result.rows[0],
    });

  } catch (error) {
    console.error("Delete Vehicle Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};