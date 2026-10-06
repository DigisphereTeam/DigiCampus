import { sendErrorResponse } from "../utils/response.js";

export const errorHandler = (err, _, res, __) => {
  console.error("Global Error:", err);

  if (err.type === "entity.parse.failed") {
    return sendErrorResponse(res, 400, "Invalid JSON request body");
  }

  return sendErrorResponse(
    res,
    err.status || 500,
    process.env.NODE_ENV === "development"
      ? err.message
      : "Internal server error",
  );
};