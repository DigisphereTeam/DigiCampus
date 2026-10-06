import pool from "../config/database.js";

import {
  sendErrorResponse,
  sendSuccessResponse,
} from "../utils/response.js";

import { isValidId } from "../utils/validation.js";

export const createConversation = async (req, res) => {
  try {
    const { participant_ids, message } = req.body;

    const userId = req.user.user_id;

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const participants = [
        ...new Set([
          userId,
          ...participant_ids,
        ]),
      ];

      const conversationResult = await client.query(
        `
          INSERT INTO tbl_conversations (
            conversation_type,
            created_by
          )
          VALUES ($1, $2)
          RETURNING *
        `,
        [
          participants.length === 2
            ? "DIRECT"
            : "GROUP",
          userId,
        ]
      );

      const conversation =
        conversationResult.rows[0];

      const participantValues = [];
      const participantPlaceholders = [];

      participants.forEach(
        (participantId, index) => {
          const valueIndex = index + 1;

          participantValues.push(
            conversation.conversation_id,
            participantId
          );

          participantPlaceholders.push(
            `($${valueIndex * 2 - 1}, $${valueIndex * 2})`
          );
        }
      );

      await client.query(
        `
          INSERT INTO tbl_conversation_participants (
            conversation_id,
            user_id
          )
          VALUES ${participantPlaceholders.join(", ")}
        `,
        participantValues
      );

      let messageData = null;

      if (message) {
        const messageResult =
          await client.query(
            `
              INSERT INTO tbl_messages (
                conversation_id,
                sender_id,
                message
              )
              VALUES ($1, $2, $3)
              RETURNING *
            `,
            [
              conversation.conversation_id,
              userId,
              message,
            ]
          );

        messageData = messageResult.rows[0];
      }

      await client.query("COMMIT");

      return sendSuccessResponse(
        res,
        201,
        "Conversation created successfully",
        {
          conversation,
          message: messageData,
        }
      );
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error(
      "Create conversation error:",
      error
    );

    return sendErrorResponse(
      res,
      500,
      "Failed to create conversation"
    );
  }
};

export const getAllConversations = async (
  req,
  res
) => {
  try {
    const userId = req.user.user_id;

    const result = await pool.query(
      `
        SELECT
          c.conversation_id,
          c.conversation_type,
          c.title,
          c.created_by,
          c.created_at,
          c.updated_at,
          (
            SELECT m.message
            FROM tbl_messages m
            WHERE m.conversation_id = c.conversation_id
              AND m.is_deleted = false
            ORDER BY m.created_at DESC
            LIMIT 1
          ) AS last_message,
          (
            SELECT m.created_at
            FROM tbl_messages m
            WHERE m.conversation_id = c.conversation_id
              AND m.is_deleted = false
            ORDER BY m.created_at DESC
            LIMIT 1
          ) AS last_message_at
        FROM tbl_conversations c
        INNER JOIN tbl_conversation_participants cp
          ON cp.conversation_id = c.conversation_id
        WHERE cp.user_id = $1
          AND cp.is_active = true
        ORDER BY COALESCE(
          (
            SELECT m.created_at
            FROM tbl_messages m
            WHERE m.conversation_id = c.conversation_id
              AND m.is_deleted = false
            ORDER BY m.created_at DESC
            LIMIT 1
          ),
          c.created_at
        ) DESC
      `,
      [userId]
    );

    return sendSuccessResponse(
      res,
      200,
      "Conversations fetched successfully",
      result.rows
    );
  } catch (error) {
    console.error(
      "Get conversations error:",
      error
    );

    return sendErrorResponse(
      res,
      500,
      "Failed to fetch conversations"
    );
  }
};

export const getConversationMessages = async (
  req,
  res
) => {
  try {
    const { conversation_id } = req.params;

    const userId = req.user.user_id;

    if (!isValidId(conversation_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid conversation ID is required"
      );
    }

    const participantResult =
      await pool.query(
        `
          SELECT participant_id
          FROM tbl_conversation_participants
          WHERE conversation_id = $1
            AND user_id = $2
            AND is_active = true
        `,
        [
          conversation_id,
          userId,
        ]
      );

    if (participantResult.rows.length === 0) {
      return sendErrorResponse(
        res,
        403,
        "You are not a participant in this conversation"
      );
    }

    const result = await pool.query(
      `
        SELECT
          m.message_id,
          m.conversation_id,
          m.sender_id,
          u.full_name AS sender_name,
          m.message,
          m.attachment_url,
          m.is_deleted,
          m.created_at,
          m.updated_at
        FROM tbl_messages m
        INNER JOIN tbl_users u
          ON u.user_id = m.sender_id
        WHERE m.conversation_id = $1
        ORDER BY m.created_at ASC
      `,
      [conversation_id]
    );

    return sendSuccessResponse(
      res,
      200,
      "Messages fetched successfully",
      result.rows
    );
  } catch (error) {
    console.error(
      "Get conversation messages error:",
      error
    );

    return sendErrorResponse(
      res,
      500,
      "Failed to fetch messages"
    );
  }
};

export const sendMessage = async (
  req,
  res
) => {
  try {
    const { conversation_id } = req.params;
    const {
      message,
      attachment_url,
    } = req.body;

    const userId = req.user.user_id;

    if (!isValidId(conversation_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid conversation ID is required"
      );
    }

    const participantResult =
      await pool.query(
        `
          SELECT participant_id
          FROM tbl_conversation_participants
          WHERE conversation_id = $1
            AND user_id = $2
            AND is_active = true
        `,
        [
          conversation_id,
          userId,
        ]
      );

    if (participantResult.rows.length === 0) {
      return sendErrorResponse(
        res,
        403,
        "You are not a participant in this conversation"
      );
    }

    const result = await pool.query(
      `
        INSERT INTO tbl_messages (
          conversation_id,
          sender_id,
          message,
          attachment_url
        )
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `,
      [
        conversation_id,
        userId,
        message,
        attachment_url || null,
      ]
    );

    await pool.query(
      `
        UPDATE tbl_conversations
        SET updated_at = CURRENT_TIMESTAMP
        WHERE conversation_id = $1
      `,
      [conversation_id]
    );

    return sendSuccessResponse(
      res,
      201,
      "Message sent successfully",
      result.rows[0]
    );
  } catch (error) {
    console.error(
      "Send message error:",
      error
    );

    return sendErrorResponse(
      res,
      500,
      "Failed to send message"
    );
  }
};

export const markConversationAsRead = async (
  req,
  res
) => {
  try {
    const { conversation_id } = req.params;

    const userId = req.user.user_id;

    if (!isValidId(conversation_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid conversation ID is required"
      );
    }

    const result = await pool.query(
      `
        UPDATE tbl_conversation_participants
        SET
          last_read_at = CURRENT_TIMESTAMP
        WHERE conversation_id = $1
          AND user_id = $2
          AND is_active = true
        RETURNING *
      `,
      [
        conversation_id,
        userId,
      ]
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Conversation with ID ${conversation_id} not found`
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Conversation marked as read",
      result.rows[0]
    );
  } catch (error) {
    console.error(
      "Mark conversation as read error:",
      error
    );

    return sendErrorResponse(
      res,
      500,
      "Failed to mark conversation as read"
    );
  }
};

export const deleteMessage = async (
  req,
  res
) => {
  try {
    const { message_id } = req.params;

    const userId = req.user.user_id;

    if (!isValidId(message_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid message ID is required"
      );
    }

    const result = await pool.query(
      `
        UPDATE tbl_messages
        SET
          is_deleted = true,
          updated_at = CURRENT_TIMESTAMP
        WHERE message_id = $1
          AND sender_id = $2
          AND is_deleted = false
        RETURNING *
      `,
      [
        message_id,
        userId,
      ]
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Message with ID ${message_id} not found`
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Message deleted successfully",
      result.rows[0]
    );
  } catch (error) {
    console.error(
      "Delete message error:",
      error
    );

    return sendErrorResponse(
      res,
      500,
      "Failed to delete message"
    );
  }
};