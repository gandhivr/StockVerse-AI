const express = require("express");
const router = express.Router();
const { analyzePortfolio, savePortfolio } = require("../controllers/portfolioController");

router.post("/analyze", analyzePortfolio);
router.post("/save", savePortfolio);

module.exports = router;
