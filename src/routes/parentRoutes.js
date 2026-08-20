import express from "express";
import { createParent, deleteParent, getAllParents, getParentById, updateParent } from "../controllers/parentController.js";



const ParentRouter = express.Router();

ParentRouter.post("/", createParent);
ParentRouter.get("/", getAllParents);
ParentRouter.get("/:parent_id", getParentById);
ParentRouter.put("/:parent_id", updateParent);
ParentRouter.delete("/:parent_id", deleteParent);

export default ParentRouter;
