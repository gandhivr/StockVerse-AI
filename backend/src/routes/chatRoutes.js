const express = require("express");
const router = express.Router();
const { sendMessage, getChatHistory } = require("../controllers/chatController");

router.post("/", sendMessage);
router.get("/history/:sessionId", getChatHistory);

module.exports = router;
