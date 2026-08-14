import {
  sendErrorResponse,
} from "../utils/response.js";

export default function authorizeRoles(
  ...allowedRoles
) {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return sendErrorResponse(
          res,
          401,
          "Authentication required"
        );
      }

      if (!allowedRoles.includes(req.user.role)) {
        return sendErrorResponse(
          res,
          403,
          "You do not have permission to access this resource"
        );
      }

      next();
    } catch (error) {
      console.error(
        "Authorization error:",
        error
      );

      return sendErrorResponse(
        res,
        500,
        error.message ||
        "Authorization failed"
      );
    }
  };
}