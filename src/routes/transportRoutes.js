import express from "express";

import {
  createVehicle,
  getAllVehicles,
  getVehicleById,
  updateVehicle,
  deleteVehicle,
} from "../controllers/transportController.js";

const TransportVehicleRouter = express.Router();

TransportVehicleRouter.post("/", createVehicle);

TransportVehicleRouter.get("/", getAllVehicles);

TransportVehicleRouter.get("/:vehicle_id", getVehicleById);

TransportVehicleRouter.put("/:vehicle_id", updateVehicle);

TransportVehicleRouter.delete("/:vehicle_id", deleteVehicle);

export default TransportVehicleRouter;