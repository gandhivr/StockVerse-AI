const mongoose = require("mongoose");

const holdingSchema = new mongoose.Schema({
  symbol: { type: String, required: true, uppercase: true },
  name: { type: String, required: true },
  quantity: { type: Number, required: true, min: 0 },
  buyPrice: { type: Number, required: true, min: 0 },
  buyDate: { type: Date, default: Date.now },
  sector: { type: String, default: "Unknown" },
});

const portfolioSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  name: { type: String, default: "My Portfolio" },
  holdings: [holdingSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

portfolioSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("Portfolio", portfolioSchema);
