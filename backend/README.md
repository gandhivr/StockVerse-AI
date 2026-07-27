# StockVerse AI - Backend

> Bloomberg Terminal + AI Trading Assistant + Indian Stock Intelligence Platform

## Quick Start

### 1. Install dependencies

```bash
cd backend
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your keys:
# - MONGODB_URI (MongoDB Atlas connection string)
# - GEMINI_API_KEY (Google AI Studio → https://aistudio.google.com)
# - JWT_SECRET (any random 64-char string)
```

### 3. Start the backend

```bash
npm run dev
```

Server runs at **http://localhost:5000**

---

## Python ML Service (Optional but recommended)

```bash
cd python-ml-service
pip install -r requirements.txt
python main.py
```

ML service runs at **http://localhost:8000**

### Pre-train models (optional, improves predictions)

```bash
python train.py
```

Train only the faster multi-horizon models:

```bash
python train.py --skip-lstm
```

Train selected symbols:

```bash
python train.py --symbols RELIANCE,TCS,INFY --period 5y --skip-lstm
```

Multi-horizon model artifacts are saved under `python-ml-service/models/multi_horizon/`.
The ML service loads them automatically for `/predict/multi-horizon`; if no trained
artifact exists, it falls back to the live ridge/momentum/technical ensemble.

Train/retry every app symbol while keeping existing models:

```bash
python train.py --all-system --period 5y --skip-lstm --skip-existing
```

Skipped symbols usually need a Yahoo ticker override or more historical data. Add ticker
overrides in `src/services/stockService.js`, then rerun the command above.

Optional weekly retraining is available through backend cron jobs. Set:

```bash
ENABLE_MODEL_RETRAINING=true
```

The job runs weekly and uses `--skip-existing` so it fills missing models without
retraining every artifact.

---

## API Reference

| Method | Endpoint                                            | Description                        |
| ------ | --------------------------------------------------- | ---------------------------------- |
| GET    | `/health`                                           | Server health check                |
| GET    | `/api/stocks`                                       | All Indian stocks live data        |
| GET    | `/api/stocks/:symbol`                               | Single stock data                  |
| GET    | `/api/stocks/:symbol/history?range=3mo`             | Historical OHLCV                   |
| POST   | `/api/predict`                                      | AI stock prediction `{symbol}`     |
| GET    | `/api/predict/:symbol`                              | AI prediction (GET)                |
| GET    | `/api/predict/:symbol/agents?horizons=1,7,30,60,90` | Multi-agent multi-horizon forecast |
| GET    | `/api/accuracy`                                     | Backtesting and model coverage     |
| GET    | `/api/accuracy/coverage`                            | Trained vs fallback coverage       |
| POST   | `/api/accuracy/reconcile`                           | Compare predictions with actuals   |
| POST   | `/api/chat`                                         | AI chatbot `{message, sessionId?}` |
| GET    | `/api/chat/history/:sessionId`                      | Chat history                       |
| POST   | `/api/portfolio/analyze`                            | Portfolio analysis `{holdings[]}`  |
| GET    | `/api/market-scan`                                  | Top gainers/losers/signals         |
| GET    | `/api/news-sentiment?topic=RELIANCE`                | News + sentiment                   |
| POST   | `/api/auth/register`                                | Register user                      |
| POST   | `/api/auth/login`                                   | Login user                         |

### WebSocket Events

Connect to `ws://localhost:5000`

- `market_update` — Full market data every 5s
- `ticker_tick` — Price ticks every 2s
- `subscribe` — Send `["RELIANCE", "TCS"]` to filter

---

## Example API Responses

### GET /api/stocks/RELIANCE

```json
{
  "success": true,
  "data": {
    "appSymbol": "RELIANCE",
    "currentPrice": 2847.5,
    "changePercent": 1.23,
    "volume": 4521000,
    "high": 2865.0,
    "low": 2820.0
  }
}
```

### POST /api/predict `{ "symbol": "TCS" }`

```json
{
  "success": true,
  "data": {
    "symbol": "TCS",
    "predictedPrice": 3945.2,
    "signal": "BUY",
    "confidence": 72.5,
    "riskScore": 3.2,
    "trend": "BULLISH",
    "technicalIndicators": { "rsi": 58.3, "macd": 12.4, "sma20": 3890 }
  }
}
```

### POST /api/chat `{ "message": "Should I buy HDFC Bank?" }`

```json
{
  "success": true,
  "data": {
    "sessionId": "session_abc123",
    "message": "HDFC Bank is currently trading at ₹1,680... [AI analysis]"
  }
}
```

---

## Deployment

### Render (recommended)

1. Push to GitHub
2. Create new Web Service on Render
3. Connect repo, set root to `backend/`
4. Add environment variables from `.env.example`
5. Deploy!

### Railway

```bash
railway login
railway init
railway up
```

---

## Architecture

```
backend/
├── src/
│   ├── app.js              # Express server entry
│   ├── config/database.js  # MongoDB connection
│   ├── controllers/        # Request handlers
│   ├── routes/             # API route definitions
│   ├── services/           # Business logic
│   │   ├── stockService.js     # Yahoo Finance integration
│   │   ├── geminiService.js    # Google Gemini AI
│   │   ├── predictionService.js # ML predictions + TA fallback
│   │   ├── portfolioService.js  # Portfolio analysis
│   │   ├── marketScanService.js # Market scanner
│   │   └── newsService.js       # News + sentiment
│   ├── models/             # MongoDB schemas
│   ├── sockets/stockSocket.js  # Socket.IO real-time
│   └── utils/cronJobs.js   # Scheduled tasks
└── python-ml-service/
    ├── main.py             # FastAPI ML server
    └── train.py            # LSTM training pipeline
```
