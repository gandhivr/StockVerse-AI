/**
 * Cron Jobs - Scheduled background tasks
 */

const cron = require("node-cron");
const { spawn } = require("child_process");
const path = require("path");
const { getMultipleStocks, DEFAULT_SYMBOLS } = require("../services/stockService");
const { reconcileDuePredictions } = require("../services/predictionTrackingService");

let latestMarketData = null;
let lastFetchTime = null;

function startMarketDataCron() {
  // Fetch market data every 2 minutes during market hours (IST 9:15 - 15:30)
  cron.schedule("*/2 * * * 1-5", async () => {
    const now = new Date();
    const istTotalMinutes = now.getUTCHours() * 60 + now.getUTCMinutes() + 330;
    const istHour = Math.floor(istTotalMinutes / 60) % 24;
    const istMinute = istTotalMinutes % 60;
    const isMarketHours =
      (istHour > 9 || (istHour === 9 && istMinute >= 15)) &&
      (istHour < 15 || (istHour === 15 && istMinute <= 30));

    if (!isMarketHours) return;

    try {
      latestMarketData = await getMultipleStocks(DEFAULT_SYMBOLS);
      lastFetchTime = new Date();
      console.log(`Market data refreshed at ${lastFetchTime.toISOString()}`);
    } catch (error) {
      console.error("Cron fetch error:", error.message);
    }
  });

  // Pre-fetch at market open (9:15 AM IST = 3:45 AM UTC)
  cron.schedule("45 3 * * 1-5", async () => {
    console.log("Market opening - pre-fetching data...");
    try {
      latestMarketData = await getMultipleStocks(DEFAULT_SYMBOLS);
      lastFetchTime = new Date();
    } catch (error) {
      console.error("Market open fetch error:", error.message);
    }
  });

  // Compare saved predictions with actual close after market close.
  // 16:15 IST = 10:45 UTC, Mon-Fri.
  cron.schedule("45 10 * * 1-5", async () => {
    try {
      const result = await reconcileDuePredictions();
      console.log(`Prediction reconciliation complete: ${JSON.stringify(result)}`);
    } catch (error) {
      console.error("Prediction reconciliation error:", error.message);
    }
  });

  // Optional weekly retraining. Disabled by default because it downloads data
  // and writes model artifacts. Enable with ENABLE_MODEL_RETRAINING=true.
  cron.schedule("30 18 * * 6", () => {
    if (process.env.ENABLE_MODEL_RETRAINING !== "true") return;

    const cwd = path.resolve(__dirname, "../../python-ml-service");
    const child = spawn(
      "py",
      ["train.py", "--all-system", "--period", "5y", "--skip-lstm", "--skip-existing"],
      {
        cwd,
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      },
    );
    child.unref();
    console.log("Weekly model retraining started in background");
  });

  console.log("Cron jobs started");
}

function getCachedMarketData() {
  return { data: latestMarketData, lastFetchTime };
}

module.exports = { startMarketDataCron, getCachedMarketData };
