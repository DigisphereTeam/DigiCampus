import express from "express";

import {
  addMeetingParticipants,
  cancelMeeting,
  createMeeting,
  getAllMeetings,
  getMeetingById,
  getMeetingHistory,
  getMyMeetings,
  getUpcomingMeetings,
  removeMeetingParticipant,
  updateMeeting,
  updateMeetingStatus,
  updateParticipantResponse,
} from "../controllers/meetingController.js";



import authMiddleware from "../middleware/authMiddleware.js";
import authorizeRoles from "../middleware/authorizeRoles.js";
import { validateCreateMeeting, validateMeetingParticipants, validateMeetingStatus, validateParticipantResponse, validateUpdateMeeting } from "../middleware/validation/meetingValidation.js";

const meetingRouter = express.Router();

meetingRouter.use(authMiddleware);
meetingRouter.use(authorizeRoles(
  "SUPER_ADMIN",
  "ADMIN",
  "TEACHER",
  "STAFF",
  "PARENT"
)
)

meetingRouter.post(
  "/",
  validateCreateMeeting,
  createMeeting
);

meetingRouter.get(
  "/",
  getAllMeetings
);

meetingRouter.get(
  "/my",
  getMyMeetings
);

meetingRouter.get(
  "/upcoming",
  getUpcomingMeetings
);

meetingRouter.get(
  "/history",
  getMeetingHistory
);

meetingRouter.get(
  "/:meeting_id",
  getMeetingById
);

meetingRouter.patch(
  "/:meeting_id",
  validateUpdateMeeting,
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN",
    "TEACHER",
    "STAFF"
  ),
  updateMeeting
);

meetingRouter.patch(
  "/:meeting_id/status",
  validateMeetingStatus,
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN"
  ),
  updateMeetingStatus
);

meetingRouter.patch(
  "/:meeting_id/participants/:user_id",
  validateParticipantResponse,
  updateParticipantResponse
);

meetingRouter.post(
  "/:meeting_id/participants",
  validateMeetingParticipants,
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN",
    "TEACHER",
    "STAFF"
  ),
  addMeetingParticipants
);

meetingRouter.delete(
  "/:meeting_id/participants/:user_id",
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN",
    "TEACHER",
    "STAFF"
  ),
  removeMeetingParticipant
);

meetingRouter.patch(
  "/:meeting_id/cancel",
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN",
    "TEACHER",
    "STAFF"
  ),
  cancelMeeting
);

export default meetingRouter;
