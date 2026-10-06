import { sendErrorResponse } from "../../utils/response.js";
import { hasValue, isValidId } from "../../utils/validation.js";

export const validateCreateVehicle = (req, res, next) => {
  const {
    vehicle_number,
    seating_capacity,
    driver_id,
    route_name,
    status
  } = req.body || {};

  if (!hasValue(vehicle_number)) {
    return sendErrorResponse(
      res,
      400,
      "Vehicle number is required"
    );
  }

  if (!hasValue(seating_capacity)) {
    return sendErrorResponse(
      res,
      400,
      "Seating capacity is required"
    );
  }

  if (
    !Number.isInteger(Number(seating_capacity)) ||
    Number(seating_capacity) <= 0
  ) {
    return sendErrorResponse(
      res,
      400,
      "Seating capacity must be a valid positive integer"
    );
  }

  if (!hasValue(driver_id)) {
    return sendErrorResponse(
      res,
      400,
      "Driver ID is required"
    );
  }

  if (!isValidId(driver_id)) {
    return sendErrorResponse(
      res,
      400,
      "Valid driver ID is required"
    );
  }

  if (!hasValue(route_name)) {
    return sendErrorResponse(
      res,
      400,
      "Route name is required"
    );
  }

  const normalizedStatus = hasValue(status)
    ? status.trim().toUpperCase()
    : "ACTIVE";

  const allowedStatuses = [
    "ACTIVE",
    "INACTIVE",
    "MAINTENANCE"
  ];

  if (!allowedStatuses.includes(normalizedStatus)) {
    return sendErrorResponse(
      res,
      400,
      "Invalid vehicle status"
    );
  }

  req.body.vehicle_number = vehicle_number.trim();
  req.body.seating_capacity = Number(seating_capacity);
  req.body.driver_id = Number(driver_id);
  req.body.route_name = route_name.trim();
  req.body.status = normalizedStatus;

  next();
};

export const validateUpdateVehicle = (req, res, next) => {
  const { vehicle_id } = req.params;

  const {
    vehicle_number,
    seating_capacity,
    driver_id,
    route_name,
    status
  } = req.body || {};

  if (!isValidId(vehicle_id)) {
    return sendErrorResponse(
      res,
      400,
      "Valid vehicle ID is required"
    );
  }

  if (vehicle_number !== undefined && vehicle_number !== null) {
    if (typeof vehicle_number !== "string" || !vehicle_number.trim()) {
      return sendErrorResponse(
        res,
        400,
        "Vehicle number is required"
      );
    }

    req.body.vehicle_number = vehicle_number.trim();
  }

  if (seating_capacity !== undefined && seating_capacity !== null) {
    if (
      !Number.isInteger(Number(seating_capacity)) ||
      Number(seating_capacity) <= 0
    ) {
      return sendErrorResponse(
        res,
        400,
        "Seating capacity must be a valid positive integer"
      );
    }

    req.body.seating_capacity = Number(seating_capacity);
  }

  if (driver_id !== undefined && driver_id !== null) {
    if (!isValidId(driver_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid driver ID is required"
      );
    }

    req.body.driver_id = Number(driver_id);
  }

  if (route_name !== undefined && route_name !== null) {
    if (typeof route_name !== "string" || !route_name.trim()) {
      return sendErrorResponse(
        res,
        400,
        "Route name is required"
      );
    }

    req.body.route_name = route_name.trim();
  }

  if (status !== undefined && status !== null) {
    const allowedStatuses = [
      "ACTIVE",
      "INACTIVE",
      "MAINTENANCE"
    ];

    if (!allowedStatuses.includes(status)) {
      return sendErrorResponse(
        res,
        400,
        "Invalid vehicle status"
      );
    }

    req.body.status = status;
  }

  if (Object.keys(req.body).length === 0) {
    return sendErrorResponse(
      res,
      400,
      "At least one field is required to update"
    );
  }

  next();
};

export const validateAddStudentsToTransport = (req, res, next) => {
  const {
    student_ids,
    vehicle_id,
    pickup_stop,
    pickup_time
  } = req.body || {};

  if (!hasValue(student_ids)) {
    return sendErrorResponse(
      res,
      400,
      "Student IDs are required"
    );
  }

  if (!Array.isArray(student_ids) || student_ids.length === 0) {
    return sendErrorResponse(
      res,
      400,
      "Student IDs must be a non-empty array"
    );
  }

  const normalizedStudentIds = student_ids.map((studentId) =>
    Number(studentId)
  );

  if (normalizedStudentIds.some((studentId) => !isValidId(studentId))) {
    return sendErrorResponse(
      res,
      400,
      "Valid student IDs are required"
    );
  }

  if (new Set(normalizedStudentIds).size !== normalizedStudentIds.length) {
    return sendErrorResponse(
      res,
      400,
      "Duplicate student IDs are not allowed"
    );
  }

  if (!hasValue(vehicle_id)) {
    return sendErrorResponse(
      res,
      400,
      "Vehicle ID is required"
    );
  }

  if (!isValidId(vehicle_id)) {
    return sendErrorResponse(
      res,
      400,
      "Valid vehicle ID is required"
    );
  }

  if (!hasValue(pickup_stop)) {
    return sendErrorResponse(
      res,
      400,
      "Pickup stop is required"
    );
  }

  if (typeof pickup_stop !== "string") {
    return sendErrorResponse(
      res,
      400,
      "Invalid pickup stop"
    );
  }

  const normalizedPickupStop = pickup_stop.trim();

  if (!normalizedPickupStop) {
    return sendErrorResponse(
      res,
      400,
      "Pickup stop is required"
    );
  }

  if (!hasValue(pickup_time)) {
    return sendErrorResponse(
      res,
      400,
      "Pickup time is required"
    );
  }

  if (typeof pickup_time !== "string") {
    return sendErrorResponse(
      res,
      400,
      "Invalid pickup time"
    );
  }

  const normalizedPickupTime = pickup_time.trim();

  if (
    !/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/.test(
      normalizedPickupTime
    )
  ) {
    return sendErrorResponse(
      res,
      400,
      "Pickup time must be in HH:MM or HH:MM:SS format"
    );
  }

  req.body.student_ids = normalizedStudentIds;
  req.body.vehicle_id = Number(vehicle_id);
  req.body.pickup_stop = normalizedPickupStop;
  req.body.pickup_time = normalizedPickupTime;

  next();
};