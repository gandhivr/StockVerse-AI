const express = require("express");
const router = express.Router();
const { scanMarket } = require("../controllers/marketScanController");

router.get("/", scanMarket);

module.exports = router;
