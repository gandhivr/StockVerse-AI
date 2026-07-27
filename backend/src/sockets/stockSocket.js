/**
 * Socket.IO - Real-time Stock Price Updates
 * Pushes live stock data to connected clients every 5 seconds
 */

const { Server } = require("socket.io");
const { getMultipleStocks, DEFAULT_SYMBOLS } = require("../services/stockService");

let io = null;
let updateInterval = null;

function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: /^http:\/\/localhost:\d+$/,
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // Send initial data immediately on connect
    sendMarketUpdate(socket);

    // Client can subscribe to specific symbols
    socket.on("subscribe", (symbols) => {
      socket.subscribedSymbols = Array.isArray(symbols) ? symbols : DEFAULT_SYMBOLS;
      console.log(`📊 ${socket.id} subscribed to: ${socket.subscribedSymbols.join(", ")}`);
    });

    socket.on("disconnect", () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
    });
  });

  // Broadcast market updates every 5 seconds
  updateInterval = setInterval(async () => {
    if (io.sockets.sockets.size === 0) return; // Skip if no clients

    try {
      const stocks = await getMultipleStocks(DEFAULT_SYMBOLS);
      io.emit("market_update", {
        type: "MARKET_UPDATE",
        data: stocks,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Socket update error:", error.message);
    }
  }, 5000);

  // Simulated ticker (more frequent, smaller updates for the ticker tape)
  setInterval(() => {
    if (io.sockets.sockets.size === 0) return;

    // Emit a simulated tick for the ticker tape
    const tickerData = generateTickerTick();
    io.emit("ticker_tick", tickerData);
  }, 2000);

  console.log("✅ Socket.IO initialized");
  return io;
}

/**
 * Send market update to a specific socket
 */
async function sendMarketUpdate(socket) {
  try {
    const stocks = await getMultipleStocks(DEFAULT_SYMBOLS);
    socket.emit("market_update", {
      type: "INITIAL_DATA",
      data: stocks,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    socket.emit("error", { message: "Failed to fetch initial market data" });
  }
}

/**
 * Generate a simulated ticker tick (small random price movement)
 * Used for the live ticker tape animation
 */
const tickerState = {};

function generateTickerTick() {
  const symbols = ["RELIANCE", "TCS", "INFY", "HDFCBANK", "ICICIBANK", "SBIN", "WIPRO", "BAJFINANCE"];
  const BASE_PRICES = {
    RELIANCE: 2850, TCS: 3900, INFY: 1750, HDFCBANK: 1680,
    ICICIBANK: 1050, SBIN: 780, WIPRO: 480, BAJFINANCE: 7200,
  };

  const updates = symbols.map((symbol) => {
    if (!tickerState[symbol]) {
      tickerState[symbol] = BASE_PRICES[symbol] || 1000;
    }

    // Small random walk
    const change = tickerState[symbol] * (Math.random() - 0.499) * 0.002;
    tickerState[symbol] = parseFloat((tickerState[symbol] + change).toFixed(2));

    return {
      symbol,
      price: tickerState[symbol],
      change: parseFloat(change.toFixed(2)),
      direction: change >= 0 ? "UP" : "DOWN",
    };
  });

  return { updates, timestamp: new Date().toISOString() };
}

function getIO() {
  return io;
}

module.exports = { initSocket, getIO };
