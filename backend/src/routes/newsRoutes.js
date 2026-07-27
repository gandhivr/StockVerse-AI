const express = require("express");
const router = express.Router();
const { getNewsSentiment } = require("../controllers/newsController");

router.get("/", getNewsSentiment);

module.exports = router;
