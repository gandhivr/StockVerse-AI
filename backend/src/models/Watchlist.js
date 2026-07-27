const mongoose = require("mongoose");

const watchlistSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  symbols: [{ type: String, uppercase: true }],
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Watchlist", watchlistSchema);
