const express = require("express");
const router = express.Router();
const { getAllStocks, getStock, getStockHistory, searchStocks } = require("../controllers/stockController");

router.get("/search", searchStocks);   // must be before /:symbol
router.get("/", getAllStocks);
router.get("/:symbol", getStock);
router.get("/:symbol/history", getStockHistory);

module.exports = router;
