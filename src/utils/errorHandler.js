import { sendErrorResponse } from "./response.js";

export const handleControllerError = (
  res,
  error,
  message,
  context = {}
) => {
  console.error(`${message} error:`, {
    ...context,
    error: error.message,
    stack: error.stack,
  });

  const responseMessage =
    process.env.NODE_ENV === "development"
      ? `${message}: ${error.message}`
      : `${message}. Please try again later.`;

  return sendErrorResponse(
    res,
    500,
    responseMessage
  );
};
