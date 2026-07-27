/**
 * StockVerse AI - Main Express Application
 * Entry point for the backend server
 */

require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const axios = require("axios");
const mongoose = require("mongoose");

const connectDB = require("./config/database");
const { initSocket } = require("./sockets/stockSocket");
const { startMarketDataCron } = require("./utils/cronJobs");
const errorHandler = require("./middleware/errorHandler");

// Route imports
const stockRoutes = require("./routes/stockRoutes");
const predictionRoutes = require("./routes/predictionRoutes");
const chatRoutes = require("./routes/chatRoutes");
const portfolioRoutes = require("./routes/portfolioRoutes");
const marketScanRoutes = require("./routes/marketScanRoutes");
const newsRoutes = require("./routes/newsRoutes");
const authRoutes = require("./routes/authRoutes");
const watchlistRoutes = require("./routes/watchlistRoutes");
const accuracyRoutes = require("./routes/accuracyRoutes");
const recommendationRoutes = require("./routes/recommendationRoutes");

const app = express();
const server = http.createServer(app);
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";

const REQUIRED_ENV = ["JWT_SECRET"];
const OPTIONAL_ENV = ["MONGODB_URI", "GEMINI_API_KEY", "ML_SERVICE_URL", "FRONTEND_URL"];
const missingRequiredEnv = REQUIRED_ENV.filter((key) => !process.env[key]);
const missingOptionalEnv = OPTIONAL_ENV.filter((key) => !process.env[key]);

if (missingRequiredEnv.length) {
  console.warn(`Missing required environment variables: ${missingRequiredEnv.join(", ")}`);
}
if (missingOptionalEnv.length) {
  console.warn(`Optional environment variables not set: ${missingOptionalEnv.join(", ")}`);
}

// ─── Connect to MongoDB ───────────────────────────────────────────────────────
connectDB();

// ─── Security Middleware ──────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false })); // CSP off for API server
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow any localhost port (dev) + configured frontend URL
      const allowed = [
        process.env.FRONTEND_URL,
        "http://localhost:8080",
        "http://localhost:8081",
        "http://localhost:3000",
        "http://localhost:5173",
      ].filter(Boolean);
      if (!origin || allowed.includes(origin) || /^http:\/\/localhost:\d+$/.test(origin)) {
        callback(null, true);
      } else {
        callback(null, true); // allow all in dev — tighten in production
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  }),
);

// ─── Rate Limiting ────────────────────────────────────────────────────────────
const isDev = (process.env.NODE_ENV || "development") === "development";

// Skip rate limiting in development — all requests come from localhost
// which shares one IP bucket and causes false 429s
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: isDev ? 0 : parseInt(process.env.RATE_LIMIT_MAX) || 500, // 0 = unlimited in dev
  skip: () => isDev, // skip entirely in dev mode
  message: { success: false, message: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// AI limiter — only active in production (Gemini API costs money)
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 0 : 30,
  skip: () => isDev,
  message: { success: false, message: "AI rate limit exceeded. Please wait a moment." },
});

app.use("/api/", limiter);
app.use("/api/chat", aiLimiter);
app.use("/api/predict", aiLimiter);

// ─── General Middleware ───────────────────────────────────────────────────────
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "StockVerse AI Backend is running",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    environment: process.env.NODE_ENV,
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.get("/api/system/health", async (req, res) => {
  const checks = {
    backend: {
      status: "online",
      message: "Express API is responding",
      latencyMs: 0,
    },
    database: {
      status: mongoose.connection.readyState === 1 ? "online" : "degraded",
      message:
        mongoose.connection.readyState === 1
          ? `Connected to ${mongoose.connection.host || "MongoDB"}`
          : "Database is not connected; cached, auth, and history features may be limited",
    },
    mlService: {
      status: "offline",
      message: "Python ML service did not respond",
      latencyMs: null,
    },
    configuration: {
      status: missingRequiredEnv.length ? "degraded" : "online",
      message: missingRequiredEnv.length
        ? `Missing required env: ${missingRequiredEnv.join(", ")}`
        : "Required environment is present",
      missingOptional: missingOptionalEnv,
    },
  };

  const mlStart = Date.now();
  try {
    const mlResponse = await axios.get(`${ML_SERVICE_URL}/health`, { timeout: 2500 });
    checks.mlService = {
      status: "online",
      message: mlResponse.data?.service || "ML service is responding",
      latencyMs: Date.now() - mlStart,
    };
  } catch (error) {
    checks.mlService = {
      status: "offline",
      message: error.message,
      latencyMs: Date.now() - mlStart,
    };
  }

  const degraded = Object.values(checks).some((check) => check.status !== "online");
  res.status(degraded ? 207 : 200).json({
    success: true,
    status: degraded ? "degraded" : "online",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    version: "1.0.0",
    checks,
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/stocks", stockRoutes);
app.use("/api/predict", predictionRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/portfolio", portfolioRoutes);
app.use("/api/market-scan", marketScanRoutes);
app.use("/api/news-sentiment", newsRoutes);
app.use("/api/watchlist", watchlistRoutes);
app.use("/api/accuracy", accuracyRoutes);
app.use("/api/recommendations", recommendationRoutes);

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Initialize Socket.IO ─────────────────────────────────────────────────────
initSocket(server);

// ─── Start Cron Jobs ──────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== "test") {
  startMarketDataCron();
}

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║   🚀 StockVerse AI Backend Running       ║
  ║   Port: ${PORT}                              ║
  ║   Mode: ${process.env.NODE_ENV || "development"}                   ║
  ╚══════════════════════════════════════════╝
  `);
});

module.exports = { app, server };
