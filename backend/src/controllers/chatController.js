const { chat } = require("../services/geminiService");
const ChatHistory = require("../models/ChatHistory");

/**
 * POST /api/chat
 * Body: { message: string, sessionId?: string }
 */
exports.sendMessage = async (req, res, next) => {
  try {
    const { message, sessionId } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ success: false, message: "message is required" });
    }

    if (message.length > 2000) {
      return res.status(400).json({ success: false, message: "Message too long (max 2000 chars)" });
    }

    // Use provided sessionId or generate new one
    const sid = sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Load conversation history from DB (if available)
    let history = [];
    try {
      const chatDoc = await ChatHistory.findOne({ sessionId: sid });
      if (chatDoc) {
        history = chatDoc.messages.slice(-20).map((m) => ({
          role: m.role,
          content: m.content,
        }));
      }
    } catch (e) {
      // DB unavailable — proceed without history
    }

    // Get AI response
    const response = await chat(message, history);

    // Save to DB (non-blocking)
    try {
      await ChatHistory.findOneAndUpdate(
        { sessionId: sid },
        {
          $push: {
            messages: {
              $each: [
                { role: "user", content: message },
                { role: "assistant", content: response },
              ],
            },
          },
          $set: { updatedAt: new Date() },
          $setOnInsert: { sessionId: sid, createdAt: new Date() },
        },
        { upsert: true }
      );
    } catch (e) {
      // DB unavailable — skip saving
    }

    res.json({
      success: true,
      data: {
        sessionId: sid,
        message: response,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    if (error.message?.includes("API_KEY")) {
      return res.status(503).json({
        success: false,
        message: "AI service unavailable. Please configure GEMINI_API_KEY.",
        userMessage: "The AI chat service is not configured yet. Please check the Gemini API key.",
      });
    }
    if (
      error.message?.includes("Gemini") ||
      error.message?.includes("model") ||
      error.message?.includes("generateContent") ||
      error.message?.includes("timed out")
    ) {
      return res.status(503).json({
        success: false,
        message: "Gemini service unavailable.",
        userMessage:
          "The AI chat service is temporarily unavailable. Please try again in a moment.",
      });
    }
    next(error);
  }
};

/**
 * GET /api/chat/history/:sessionId
 */
exports.getChatHistory = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const chatDoc = await ChatHistory.findOne({ sessionId });

    if (!chatDoc) {
      return res.json({ success: true, data: { sessionId, messages: [] } });
    }

    res.json({
      success: true,
      data: {
        sessionId,
        messages: chatDoc.messages.slice(-50),
      },
    });
  } catch (error) {
    next(error);
  }
};
