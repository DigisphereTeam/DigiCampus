import express from "express";

import {
  createConversation,
  deleteMessage,
  getAllConversations,
  getConversationMessages,
  markConversationAsRead,
  sendMessage,
} from "../controllers/messageController.js";


import authMiddleware from "../middleware/authMiddleware.js";
import authorizeRoles from "../middleware/authorizeRoles.js";
import { validateCreateConversation, validateSendMessage } from "../middleware/validation/messageValidation.js";

const messageRouter = express.Router();

messageRouter.post(
  "/conversations",
  authMiddleware,
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN",
    "TEACHER",
    "STAFF",
    "STUDENT",
    "PARENT"
  ),
  validateCreateConversation,
  createConversation
);

messageRouter.get(
  "/conversations",
  authMiddleware,
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN",
    "TEACHER",
    "STAFF",
    "STUDENT",
    "PARENT"
  ),
  getAllConversations
);

messageRouter.get(
  "/conversations/:conversation_id",
  authMiddleware,
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN",
    "TEACHER",
    "STAFF",
    "STUDENT",
    "PARENT"
  ),
  getConversationMessages
);

messageRouter.post(
  "/conversations/:conversation_id",
  authMiddleware,
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN",
    "TEACHER",
    "STAFF",
    "STUDENT",
    "PARENT"
  ),
  validateSendMessage,
  sendMessage
);

messageRouter.patch(
  "/conversations/:conversation_id/read",
  authMiddleware,
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN",
    "TEACHER",
    "STAFF",
    "STUDENT",
    "PARENT"
  ),
  markConversationAsRead
);

messageRouter.delete(
  "/:message_id",
  authMiddleware,
  authorizeRoles(
    "SUPER_ADMIN",
    "ADMIN",
    "TEACHER",
    "STAFF",
    "STUDENT",
    "PARENT"
  ),
  deleteMessage
);

export default messageRouter;