"""
StockVerse AI - Python ML Microservice
FastAPI server for LSTM stock price prediction
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import numpy as np
import os
import json
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

MODEL_DIR = Path(os.getenv("MODEL_DIR", "models"))
MULTI_HORIZON_MODEL_DIR = MODEL_DIR / "multi_horizon"
DEFAULT_HORIZONS = [1, 7, 30, 60, 90]
FEATURE_COLUMNS = [
    "close",
    "return_1d",
    "return_5d",
    "return_10d",
    "rsi",
    "macd",
    "sma20_ratio",
    "sma50_ratio",
    "volatility_10d",
    "volatility_20d",
    "volume_ratio",
]

app = FastAPI(
    title="StockVerse AI - ML Service",
    description="LSTM-based Indian stock price prediction",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Data Models ──────────────────────────────────────────────────────────────

class OHLCVData(BaseModel):
    date: str
    open: float
    high: float
    low: float
    close: float
    volume: int

class PredictionRequest(BaseModel):
    symbol: str
    history: List[OHLCVData]

class MultiHorizonPredictionRequest(BaseModel):
    symbol: str
    history: List[OHLCVData]
    horizons: Optional[List[int]] = None

class PredictionResponse(BaseModel):
    symbol: str
    predictedPrice: float
    signal: str
    confidence: float
    riskScore: float
    trend: str
    currentPrice: float
    priceChange: float
    priceChangePercent: float
    technicalIndicators: dict
    source: str

# ─── Technical Indicators ─────────────────────────────────────────────────────

def calculate_rsi(closes: np.ndarray, period: int = 14) -> float:
    if len(closes) < period + 1:
        return 50.0
    deltas = np.diff(closes)
    gains = np.where(deltas > 0, deltas, 0)
    losses = np.where(deltas < 0, -deltas, 0)
    avg_gain = np.mean(gains[:period])
    avg_loss = np.mean(losses[:period])
    for i in range(period, len(deltas)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return round(100 - (100 / (1 + rs)), 2)

def calculate_ema(data: np.ndarray, period: int) -> float:
    if len(data) < period:
        return float(data[-1])
    k = 2 / (period + 1)
    ema = np.mean(data[:period])
    for price in data[period:]:
        ema = price * k + ema * (1 - k)
    return ema

def calculate_macd(closes: np.ndarray) -> float:
    ema12 = calculate_ema(closes, 12)
    ema26 = calculate_ema(closes, 26)
    return round(ema12 - ema26, 2)

def calculate_bollinger_bands(closes: np.ndarray, period: int = 20):
    if len(closes) < period:
        return closes[-1], closes[-1], closes[-1]
    recent = closes[-period:]
    sma = np.mean(recent)
    std = np.std(recent)
    return round(sma + 2 * std, 2), round(sma, 2), round(sma - 2 * std, 2)

# ─── LSTM Prediction ──────────────────────────────────────────────────────────

def lstm_predict(closes: np.ndarray, symbol: str) -> dict:
    """
    LSTM prediction using TensorFlow/Keras.
    Tries to load a pre-trained model, trains a quick one if not found.
    """
    try:
        import tensorflow as tf
        from sklearn.preprocessing import MinMaxScaler

        scaler = MinMaxScaler(feature_range=(0, 1))
        scaled = scaler.fit_transform(closes.reshape(-1, 1))

        # Use last 60 days as sequence
        seq_len = min(60, len(scaled) - 1)
        X = scaled[-seq_len:].reshape(1, seq_len, 1)

        model_path = f"models/{symbol}_lstm.h5"

        if os.path.exists(model_path):
            model = tf.keras.models.load_model(model_path)
        else:
            # Quick training on available data
            model = build_lstm_model(seq_len)
            X_train, y_train = [], []
            for i in range(seq_len, len(scaled)):
                X_train.append(scaled[i - seq_len:i, 0])
                y_train.append(scaled[i, 0])

            if len(X_train) > 0:
                X_train = np.array(X_train).reshape(-1, seq_len, 1)
                y_train = np.array(y_train)
                model.fit(X_train, y_train, epochs=10, batch_size=16, verbose=0)
                os.makedirs("models", exist_ok=True)
                model.save(model_path)

        predicted_scaled = model.predict(X, verbose=0)
        predicted_price = float(scaler.inverse_transform(predicted_scaled)[0][0])
        return {"price": round(predicted_price, 2), "source": "lstm_model"}

    except Exception as e:
        print(f"LSTM failed: {e}, falling back to linear regression")
        return linear_regression_predict(closes)

def build_lstm_model(seq_len: int):
    import tensorflow as tf
    model = tf.keras.Sequential([
        tf.keras.layers.LSTM(50, return_sequences=True, input_shape=(seq_len, 1)),
        tf.keras.layers.Dropout(0.2),
        tf.keras.layers.LSTM(50, return_sequences=False),
        tf.keras.layers.Dropout(0.2),
        tf.keras.layers.Dense(25),
        tf.keras.layers.Dense(1),
    ])
    model.compile(optimizer="adam", loss="mean_squared_error")
    return model

def linear_regression_predict(closes: np.ndarray) -> dict:
    """Simple linear regression fallback"""
    from sklearn.linear_model import LinearRegression
    x = np.arange(len(closes)).reshape(-1, 1)
    model = LinearRegression()
    model.fit(x, closes)
    next_x = np.array([[len(closes)]])
    predicted = float(model.predict(next_x)[0])
    return {"price": round(predicted, 2), "source": "linear_regression"}

def calculate_volatility(closes: np.ndarray) -> float:
    if len(closes) < 2:
        return 0.01
    returns = np.diff(closes) / closes[:-1]
    return float(np.std(returns)) if len(returns) else 0.01

def direction_for(change_percent: float) -> str:
    if change_percent > 0.35:
        return "UP"
    if change_percent < -0.35:
        return "DOWN"
    return "FLAT"

def horizon_label(days: int) -> str:
    labels = {
        1: "Next Day",
        7: "1 Week",
        14: "2 Weeks",
        30: "1 Month",
        60: "2 Months",
        90: "3 Months",
    }
    return labels.get(days, f"{days} Days")

def pct_change(closes: np.ndarray, periods: int) -> float:
    if len(closes) <= periods or closes[-periods - 1] == 0:
        return 0.0
    return float((closes[-1] - closes[-periods - 1]) / closes[-periods - 1])

def latest_feature_vector(closes: np.ndarray, volumes: np.ndarray) -> np.ndarray:
    current_price = float(closes[-1])
    sma20 = float(np.mean(closes[-20:])) if len(closes) >= 20 else float(np.mean(closes))
    sma50 = float(np.mean(closes[-50:])) if len(closes) >= 50 else float(np.mean(closes))
    avg_volume = float(np.mean(volumes[-20:])) if len(volumes) >= 20 else float(np.mean(volumes))
    returns = np.diff(closes) / closes[:-1] if len(closes) > 1 else np.array([0.0])
    volatility_10d = float(np.std(returns[-10:])) if len(returns) >= 2 else 0.0
    volatility_20d = float(np.std(returns[-20:])) if len(returns) >= 2 else volatility_10d

    values = {
        "close": current_price,
        "return_1d": pct_change(closes, 1),
        "return_5d": pct_change(closes, 5),
        "return_10d": pct_change(closes, 10),
        "rsi": calculate_rsi(closes),
        "macd": calculate_macd(closes),
        "sma20_ratio": (current_price / sma20) - 1 if sma20 else 0.0,
        "sma50_ratio": (current_price / sma50) - 1 if sma50 else 0.0,
        "volatility_10d": volatility_10d,
        "volatility_20d": volatility_20d,
        "volume_ratio": float(volumes[-1]) / avg_volume if avg_volume > 0 else 1.0,
    }

    return np.array([[values[column] for column in FEATURE_COLUMNS]], dtype=float)

def load_multi_horizon_artifact(symbol: str):
    try:
        import joblib

        model_path = MULTI_HORIZON_MODEL_DIR / f"{symbol.upper()}_multi_horizon.joblib"
        if not model_path.exists():
            return None
        return joblib.load(model_path)
    except Exception as e:
        print(f"Unable to load multi-horizon model for {symbol}: {e}")
        return None

def trained_multi_horizon_predict(
    symbol: str,
    closes: np.ndarray,
    volumes: np.ndarray,
    requested_horizons: List[int],
) -> Optional[dict]:
    artifact = load_multi_horizon_artifact(symbol)
    if not artifact:
        return None

    model = artifact.get("model")
    metadata = artifact.get("metadata", {})
    trained_horizons = [int(day) for day in metadata.get("horizons", DEFAULT_HORIZONS)]
    validation_mae = metadata.get("validationMae", {})
    current_price = float(closes[-1])
    volatility = calculate_volatility(closes)
    features = latest_feature_vector(closes, volumes)
    raw_predictions = np.asarray(model.predict(features)[0], dtype=float)

    predictions = []
    for days in requested_horizons:
        if days in trained_horizons:
            horizon_index = trained_horizons.index(days)
            predicted_return = float(raw_predictions[horizon_index])
            source = "trained_multi_horizon_model"
        else:
            nearest_index = int(np.argmin([abs(days - trained_day) for trained_day in trained_horizons]))
            nearest_days = trained_horizons[nearest_index]
            scale = np.sqrt(days) / max(np.sqrt(nearest_days), 1)
            predicted_return = float(raw_predictions[nearest_index]) * scale
            source = f"trained_model_interpolated_from_{nearest_days}d"

        predicted_price = round(max(0.01, current_price * (1 + predicted_return)), 2)
        change_percent = round(predicted_return * 100, 2)
        mae = float(validation_mae.get(str(days), validation_mae.get(days, volatility)))
        expected_move = max(volatility * np.sqrt(days), mae) * current_price
        confidence = round(max(35, min(92, 90 - mae * 420 - np.sqrt(days) * 0.45)), 1)

        predictions.append({
            "days": days,
            "label": horizon_label(days),
            "predictedPrice": predicted_price,
            "changePercent": change_percent,
            "direction": direction_for(change_percent),
            "confidence": confidence,
            "expectedRange": {
                "low": round(max(0.01, predicted_price - expected_move), 2),
                "high": round(predicted_price + expected_move, 2),
            },
            "source": source,
        })

    return {
        "horizons": predictions,
        "source": "trained_multi_horizon_model",
        "modelVersion": metadata.get("modelVersion", "multi_horizon_random_forest_v1"),
        "modelMetadata": {
            "trainedAt": metadata.get("trainedAt"),
            "trainingRows": metadata.get("trainingRows"),
            "validationMae": validation_mae,
            "trainedHorizons": trained_horizons,
        },
    }

def multi_horizon_ensemble(closes: np.ndarray, volumes: np.ndarray, horizons: List[int]) -> dict:
    """
    Lightweight multi-horizon model.
    Combines linear trend, recent momentum, and technical indicators. This is the
    default trainable contract until stronger saved models are available.
    """
    from sklearn.linear_model import Ridge

    current_price = float(closes[-1])
    x = np.arange(len(closes)).reshape(-1, 1)
    ridge = Ridge(alpha=1.0)
    ridge.fit(x, closes)

    rsi = calculate_rsi(closes)
    macd = calculate_macd(closes)
    sma20 = float(np.mean(closes[-20:])) if len(closes) >= 20 else float(np.mean(closes))
    sma50 = float(np.mean(closes[-50:])) if len(closes) >= 50 else float(np.mean(closes))
    volatility = calculate_volatility(closes)
    avg_volume = float(np.mean(volumes[-20:])) if len(volumes) >= 20 else float(np.mean(volumes))
    volume_ratio = float(volumes[-1]) / avg_volume if avg_volume > 0 else 1.0

    recent_window = min(10, len(closes) - 1)
    recent_momentum = (current_price - float(closes[-recent_window - 1])) / float(closes[-recent_window - 1])

    technical_bias = 0.0
    if rsi < 30:
        technical_bias += 0.004
    elif rsi > 70:
        technical_bias -= 0.004
    technical_bias += 0.003 if sma20 > sma50 else -0.003
    technical_bias += 0.002 if macd > 0 else -0.002
    technical_bias += 0.001 if volume_ratio > 1.5 else 0.0

    predictions = []
    for raw_days in horizons:
        days = int(raw_days)
        regression_price = float(ridge.predict(np.array([[len(closes) + days - 1]]))[0])
        momentum_price = current_price * (1 + (recent_momentum * min(1.8, np.sqrt(days) / 3)))
        technical_price = current_price * (1 + technical_bias * np.sqrt(days))
        predicted_price = (regression_price * 0.45) + (momentum_price * 0.30) + (technical_price * 0.25)
        predicted_price = max(0.01, round(predicted_price, 2))

        change_percent = round(((predicted_price - current_price) / current_price) * 100, 2)
        expected_move = volatility * np.sqrt(days) * current_price
        confidence = round(max(35, min(90, 82 - volatility * 130 - np.sqrt(days) * 1.4)), 1)

        predictions.append({
            "days": days,
            "label": horizon_label(days),
            "predictedPrice": predicted_price,
            "changePercent": change_percent,
            "direction": direction_for(change_percent),
            "confidence": confidence,
            "expectedRange": {
                "low": round(max(0.01, predicted_price - expected_move), 2),
                "high": round(predicted_price + expected_move, 2),
            },
            "source": "ridge_momentum_technical_ensemble",
        })

    return {
        "horizons": predictions,
        "technicalIndicators": {
            "rsi": rsi,
            "macd": macd,
            "sma20": round(sma20, 2),
            "sma50": round(sma50, 2),
            "volumeRatio": round(volume_ratio, 2),
            "volatility": round(volatility * 100, 2),
        },
        "source": "ridge_momentum_technical_ensemble",
        "modelVersion": "multi_horizon_ensemble_v1",
    }

# ─── Main Prediction Endpoint ─────────────────────────────────────────────────

@app.post("/predict", response_model=PredictionResponse)
async def predict(request: PredictionRequest):
    if len(request.history) < 10:
        raise HTTPException(status_code=400, detail="Need at least 10 data points")

    closes = np.array([d.close for d in request.history])
    volumes = np.array([d.volume for d in request.history])
    current_price = closes[-1]

    # Technical indicators
    rsi = calculate_rsi(closes)
    macd = calculate_macd(closes)
    sma20 = round(float(np.mean(closes[-20:])) if len(closes) >= 20 else float(np.mean(closes)), 2)
    sma50 = round(float(np.mean(closes[-50:])) if len(closes) >= 50 else float(np.mean(closes)), 2)
    bb_upper, bb_mid, bb_lower = calculate_bollinger_bands(closes)
    avg_volume = float(np.mean(volumes[-20:])) if len(volumes) >= 20 else float(np.mean(volumes))
    volume_ratio = round(float(volumes[-1]) / avg_volume if avg_volume > 0 else 1.0, 2)

    # LSTM prediction
    lstm_result = lstm_predict(closes, request.symbol)
    predicted_price = lstm_result["price"]

    # Scoring for signal
    score = 0
    if rsi < 30: score += 2
    elif rsi > 70: score -= 2
    if sma20 > sma50: score += 1
    else: score -= 1
    if current_price > sma20: score += 0.5
    else: score -= 0.5
    if macd > 0: score += 1
    else: score -= 1
    if predicted_price > current_price: score += 1.5
    else: score -= 1.5
    if volume_ratio > 1.5: score += 0.5

    # Signal determination
    if score >= 2.5: signal, trend = "BUY", "BULLISH"
    elif score <= -2.5: signal, trend = "SELL", "BEARISH"
    else: signal, trend = "HOLD", "NEUTRAL"

    # Confidence
    confidence = round(min(95, max(45, abs(score) * 12 + 45)), 1)

    # Risk score
    returns = np.diff(closes) / closes[:-1]
    volatility = float(np.std(returns)) if len(returns) > 1 else 0.01
    risk_score = round(min(10, volatility * 100 + (2 if rsi > 70 or rsi < 30 else 0)), 1)

    price_change = round(predicted_price - current_price, 2)
    price_change_pct = round((price_change / current_price) * 100, 2)

    return PredictionResponse(
        symbol=request.symbol,
        predictedPrice=predicted_price,
        signal=signal,
        confidence=confidence,
        riskScore=risk_score,
        trend=trend,
        currentPrice=round(current_price, 2),
        priceChange=price_change,
        priceChangePercent=price_change_pct,
        technicalIndicators={
            "rsi": rsi, "macd": macd, "sma20": sma20, "sma50": sma50,
            "bbUpper": bb_upper, "bbLower": bb_lower, "volumeRatio": volume_ratio,
        },
        source=lstm_result["source"],
    )

@app.post("/predict/multi-horizon")
async def predict_multi_horizon(request: MultiHorizonPredictionRequest):
    if len(request.history) < 20:
        raise HTTPException(status_code=400, detail="Need at least 20 data points")

    horizons = request.horizons or [1, 7, 30, 60, 90]
    horizons = [int(day) for day in horizons if int(day) > 0 and int(day) <= 365][:8]
    if not horizons:
        horizons = [1, 7, 30, 60, 90]

    closes = np.array([d.close for d in request.history])
    volumes = np.array([d.volume for d in request.history])
    result = trained_multi_horizon_predict(request.symbol, closes, volumes, horizons)
    if result is None:
        result = multi_horizon_ensemble(closes, volumes, horizons)

    return {
        "symbol": request.symbol,
        **result,
    }

@app.get("/models")
async def list_models():
    models = []
    if MULTI_HORIZON_MODEL_DIR.exists():
        for model_path in MULTI_HORIZON_MODEL_DIR.glob("*_multi_horizon.joblib"):
            symbol = model_path.name.replace("_multi_horizon.joblib", "")
            metadata_path = MULTI_HORIZON_MODEL_DIR / f"{symbol}_metadata.json"
            metadata = {}
            if metadata_path.exists():
                try:
                    metadata = json.loads(metadata_path.read_text())
                except Exception:
                    metadata = {}
            models.append({
                "symbol": symbol,
                "path": str(model_path),
                "metadata": metadata,
            })
    return {
        "status": "ok",
        "modelDir": str(MULTI_HORIZON_MODEL_DIR),
        "count": len(models),
        "models": models,
    }

@app.get("/health")
async def health():
    return {"status": "ok", "service": "StockVerse AI ML Service", "version": "1.0.0"}

@app.get("/fundamentals/{symbol}")
async def get_fundamentals(symbol: str):
    """
    Fetch fundamental data for an NSE stock using yfinance.
    yfinance handles Yahoo Finance crumb/cookie auth internally.
    Results are cached in-memory for 30 minutes to avoid rate limits.
    """
    import yfinance as yf
    import time
    import asyncio

    upper = symbol.upper()

    # ── in-memory cache (30 min TTL) ─────────────────────────────────────────
    _cache = getattr(get_fundamentals, "_cache", {})
    get_fundamentals._cache = _cache
    cached = _cache.get(upper)
    if cached and (time.time() - cached["ts"]) < 1800:
        return cached["data"]

    # Map known symbols to Yahoo tickers
    TICKER_MAP = {
        "NIFTY50": "^NSEI", "BANKNIFTY": "^NSEBANK", "SENSEX": "^BSESN",
        "MM": "M%26M.NS", "BAJAJ_AUTO": "BAJAJ-AUTO.NS",
        "INFOEDGE": "NAUKRI.NS", "NAUKRI": "NAUKRI.NS",
        "TATAMOTORS": "TMCV.NS", "ZOMATO": "ETERNAL.NS",
        "MAZAGON": "MAZDOCK.NS", "VBLLTD": "VBL.NS",
        "INDUS": "INDUSTOWER.NS", "TEJAS": "TEJASNET.NS",
        "JIOFINANCE": "JIOFIN.NS",
    }
    is_bse_numeric = upper.isdigit() and len(upper) == 6
    is_bse_explicit = upper.endswith(".BO")
    if is_bse_explicit:
        yahoo_symbol = upper
    else:
        yahoo_symbol = TICKER_MAP.get(
            upper,
            f"{upper}.BO" if is_bse_numeric else f"{upper}.NS"
        )

    # ── retry with back-off (Yahoo rate limits) ───────────────────────────────
    last_error = None
    for attempt in range(3):
        try:
            if attempt > 0:
                await asyncio.sleep(4 * attempt)  # 4s, 8s back-off

            ticker = yf.Ticker(yahoo_symbol)
            info = ticker.info or {}

            # Require at least a price to consider the fetch valid
            if not info.get("regularMarketPrice") and not info.get("currentPrice") and not info.get("trailingPE") and not info.get("marketCap"):
                raise ValueError(f"yfinance returned empty info for {yahoo_symbol}")

            # Quarterly financials
            quarterly_results = []
            try:
                qf = ticker.quarterly_financials
                if qf is not None and not qf.empty:
                    for col in list(qf.columns)[:4]:
                        quarterly_results.append({
                            "period": str(col)[:10],
                            "revenue": float(qf.loc["Total Revenue", col]) if "Total Revenue" in qf.index else None,
                            "netIncome": float(qf.loc["Net Income", col]) if "Net Income" in qf.index else None,
                            "ebitda": float(qf.loc["EBITDA", col]) if "EBITDA" in qf.index else None,
                            "eps": None,
                        })
            except Exception:
                quarterly_results = []

            def safe(val):
                if val is None:
                    return None
                try:
                    f = float(val)
                    return None if (f != f) else f  # NaN check
                except (TypeError, ValueError):
                    return None

            def pct(val):
                v = safe(val)
                return round(v * 100, 2) if v is not None else None

            result = {
                "symbol": upper,
                "yahooSymbol": yahoo_symbol,
                "companyName": info.get("longName") or info.get("shortName") or upper,
                "companyInfo": info.get("longBusinessSummary"),
                "sector": info.get("sector"),
                "industry": info.get("industry"),
                "marketCap": safe(info.get("marketCap")),
                "peRatio": safe(info.get("trailingPE")),
                "pbRatio": safe(info.get("priceToBook")),
                "eps": safe(info.get("trailingEps")),
                "evToEbitda": safe(info.get("enterpriseToEbitda")),
                "dividendYield": pct(info.get("dividendYield")),
                "beta": safe(info.get("beta")),
                "roe": pct(info.get("returnOnEquity")),
                "roce": None,
                "profitMargins": pct(info.get("profitMargins")),
                "grossMargins": pct(info.get("grossMargins")),
                "ebitdaMargins": pct(info.get("ebitdaMargins")),
                "operatingMargins": pct(info.get("operatingMargins")),
                "revenueGrowth": pct(info.get("revenueGrowth")),
                "earningsGrowth": pct(info.get("earningsGrowth")),
                "revenuePerShare": safe(info.get("revenuePerShare")),
                "currentRatio": safe(info.get("currentRatio")),
                "debtToEquity": safe(info.get("debtToEquity")),
                "quickRatio": safe(info.get("quickRatio")),
                "totalCash": safe(info.get("totalCash")),
                "totalDebt": safe(info.get("totalDebt")),
                "freeCashflow": safe(info.get("freeCashflow")),
                "promoterHolding": pct(info.get("heldPercentInsiders")),
                "institutionalHolding": pct(info.get("heldPercentInstitutions")),
                "fiiChange": None,
                "diiChange": None,
                "sectorPE": None,
                "sectorROE": None,
                "quarterlyResults": quarterly_results,
            }

            # Cache the successful result
            _cache[upper] = {"data": result, "ts": time.time()}
            return result

        except Exception as e:
            last_error = e
            err_msg = str(e).lower()
            # Only retry on rate-limit / network errors
            if "rate" in err_msg or "too many" in err_msg or "timed out" in err_msg or "connection" in err_msg:
                continue
            break  # non-retryable error

    raise HTTPException(status_code=502, detail=f"yfinance fetch failed for {upper} after retries: {str(last_error)}")

@app.get("/")
async def root():
    return {"message": "StockVerse AI ML Service is running. POST /predict to get predictions."}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
