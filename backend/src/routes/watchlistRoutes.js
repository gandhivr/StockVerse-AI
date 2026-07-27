const express = require("express");
const router = express.Router();
const { getWatchlist, addToWatchlist, removeFromWatchlist } = require("../controllers/watchlistController");

router.get("/:userId", getWatchlist);
router.post("/:userId/add", addToWatchlist);
router.delete("/:userId/remove/:symbol", removeFromWatchlist);

module.exports = router;
