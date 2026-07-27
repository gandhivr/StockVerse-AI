"""
StockVerse AI - Model Training Pipeline

Trains:
1. Optional LSTM next-session models
2. Multi-horizon Random Forest models for 1d, 7d, 30d, 60d, and 90d forecasts

Usage:
  py train.py
  py train.py --symbols RELIANCE,TCS --period 5y
  py train.py --skip-lstm
"""

import argparse
import json
import os
import re
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
import pandas as pd
import yfinance as yf

DEFAULT_HORIZONS = [1, 7, 30, 60, 90]
MODEL_VERSION = "multi_horizon_random_forest_v1"
MODEL_DIR = Path(os.getenv("MODEL_DIR", "models"))
MULTI_HORIZON_MODEL_DIR = MODEL_DIR / "multi_horizon"
SYSTEM_SYMBOLS_PATH = Path(__file__).resolve().parents[1] / "src" / "data" / "nseSymbols.js"
STOCK_SERVICE_PATH = Path(__file__).resolve().parents[1] / "src" / "services" / "stockService.js"

STOCKS = {
    "RELIANCE": "RELIANCE.NS",
    "TCS": "TCS.NS",
    "INFY": "INFY.NS",
    "HDFCBANK": "HDFCBANK.NS",
    "ICICIBANK": "ICICIBANK.NS",
    "SBIN": "SBIN.NS",
    "WIPRO": "WIPRO.NS",
    "BAJFINANCE": "BAJFINANCE.NS",
}

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


def fetch_data(yahoo_symbol: str, period: str = "5y") -> pd.DataFrame:
    print(f"  Fetching {yahoo_symbol}...")
    ticker = yf.Ticker(yahoo_symbol)
    df = ticker.history(period=period)
    df = df[["Open", "High", "Low", "Close", "Volume"]].dropna()
    df.columns = ["open", "high", "low", "close", "volume"]
    return df


def add_features(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()

    delta = out["close"].diff()
    gain = delta.where(delta > 0, 0).rolling(14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
    rs = gain / loss.replace(0, np.nan)
    out["rsi"] = (100 - (100 / (1 + rs))).fillna(50)

    ema12 = out["close"].ewm(span=12, adjust=False).mean()
    ema26 = out["close"].ewm(span=26, adjust=False).mean()
    out["macd"] = ema12 - ema26

    sma20 = out["close"].rolling(20).mean()
    sma50 = out["close"].rolling(50).mean()
    out["sma20_ratio"] = (out["close"] / sma20) - 1
    out["sma50_ratio"] = (out["close"] / sma50) - 1

    out["return_1d"] = out["close"].pct_change(1)
    out["return_5d"] = out["close"].pct_change(5)
    out["return_10d"] = out["close"].pct_change(10)
    out["volatility_10d"] = out["return_1d"].rolling(10).std()
    out["volatility_20d"] = out["return_1d"].rolling(20).std()
    out["volume_ratio"] = out["volume"] / out["volume"].rolling(20).mean()

    return out.replace([np.inf, -np.inf], np.nan).dropna()


def add_targets(df: pd.DataFrame, horizons: list[int]) -> pd.DataFrame:
    out = df.copy()
    for days in horizons:
        out[f"target_{days}d"] = (out["close"].shift(-days) / out["close"]) - 1
    return out.dropna()


def train_multi_horizon_model(symbol: str, df: pd.DataFrame, horizons: list[int]) -> bool:
    try:
        import joblib
        from sklearn.ensemble import RandomForestRegressor
        from sklearn.metrics import mean_absolute_error
        from sklearn.pipeline import Pipeline
        from sklearn.preprocessing import StandardScaler

        print(f"  Training multi-horizon model for {symbol}...")
        model_df = add_targets(add_features(df), horizons)

        if len(model_df) < 220:
            print(f"  Not enough rows for multi-horizon model: {len(model_df)}")
            return False

        target_columns = [f"target_{days}d" for days in horizons]
        X = model_df[FEATURE_COLUMNS].to_numpy(dtype=float)
        y = model_df[target_columns].to_numpy(dtype=float)

        split = int(len(model_df) * 0.82)
        X_train, X_valid = X[:split], X[split:]
        y_train, y_valid = y[:split], y[split:]

        model = Pipeline([
            ("scaler", StandardScaler()),
            (
                "regressor",
                RandomForestRegressor(
                    n_estimators=300,
                    max_depth=8,
                    min_samples_leaf=4,
                    random_state=42,
                    n_jobs=-1,
                ),
            ),
        ])
        model.fit(X_train, y_train)
        predictions = model.predict(X_valid)

        validation_mae = {}
        for index, days in enumerate(horizons):
            validation_mae[str(days)] = round(
                float(mean_absolute_error(y_valid[:, index], predictions[:, index])),
                5,
            )

        metadata = {
            "symbol": symbol,
            "modelVersion": MODEL_VERSION,
            "trainedAt": datetime.now(UTC).isoformat(),
            "trainingRows": int(len(X_train)),
            "validationRows": int(len(X_valid)),
            "horizons": horizons,
            "featureColumns": FEATURE_COLUMNS,
            "targetColumns": target_columns,
            "validationMae": validation_mae,
        }

        MULTI_HORIZON_MODEL_DIR.mkdir(parents=True, exist_ok=True)
        artifact = {"model": model, "metadata": metadata}
        model_path = MULTI_HORIZON_MODEL_DIR / f"{symbol}_multi_horizon.joblib"
        metadata_path = MULTI_HORIZON_MODEL_DIR / f"{symbol}_metadata.json"
        joblib.dump(artifact, model_path)
        metadata_path.write_text(json.dumps(metadata, indent=2))

        print(f"  Multi-horizon MAE: {validation_mae}")
        print(f"  Saved {model_path}")
        return True
    except Exception as e:
        print(f"  Multi-horizon training failed for {symbol}: {e}")
        return False


def train_lstm(symbol: str, df: pd.DataFrame):
    try:
        import tensorflow as tf
        from sklearn.preprocessing import MinMaxScaler

        print(f"  Training LSTM for {symbol}...")

        closes = df["close"].values
        scaler = MinMaxScaler(feature_range=(0, 1))
        scaled = scaler.fit_transform(closes.reshape(-1, 1))

        seq_len = 60
        X, y = [], []
        for i in range(seq_len, len(scaled)):
            X.append(scaled[i - seq_len:i, 0])
            y.append(scaled[i, 0])

        X, y = np.array(X), np.array(y)
        X = X.reshape(X.shape[0], X.shape[1], 1)

        split = int(len(X) * 0.8)
        X_train, X_test = X[:split], X[split:]
        y_train, y_test = y[:split], y[split:]

        model = tf.keras.Sequential([
            tf.keras.layers.LSTM(100, return_sequences=True, input_shape=(seq_len, 1)),
            tf.keras.layers.Dropout(0.2),
            tf.keras.layers.LSTM(100, return_sequences=True),
            tf.keras.layers.Dropout(0.2),
            tf.keras.layers.LSTM(50, return_sequences=False),
            tf.keras.layers.Dropout(0.2),
            tf.keras.layers.Dense(25),
            tf.keras.layers.Dense(1),
        ])

        model.compile(optimizer=tf.keras.optimizers.Adam(learning_rate=0.001), loss="mean_squared_error")
        early_stop = tf.keras.callbacks.EarlyStopping(monitor="val_loss", patience=5, restore_best_weights=True)
        history = model.fit(
            X_train,
            y_train,
            epochs=50,
            batch_size=32,
            validation_data=(X_test, y_test),
            callbacks=[early_stop],
            verbose=0,
        )

        test_loss = model.evaluate(X_test, y_test, verbose=0)
        print(f"  LSTM test loss: {test_loss:.6f}, epochs: {len(history.history['loss'])}")

        MODEL_DIR.mkdir(parents=True, exist_ok=True)
        model.save(MODEL_DIR / f"{symbol}_lstm.h5")
        return True
    except ImportError:
        print("  TensorFlow not installed. Skipping LSTM training.")
        return False
    except Exception as e:
        print(f"  LSTM training failed for {symbol}: {e}")
        return False


def parse_symbols(raw: str | None) -> dict[str, str]:
    if not raw:
        return STOCKS
    requested = [item.strip().upper() for item in raw.split(",") if item.strip()]
    return {symbol: STOCKS.get(symbol, f"{symbol}.NS") for symbol in requested}


def load_system_symbols() -> dict[str, str]:
    if not SYSTEM_SYMBOLS_PATH.exists():
        raise FileNotFoundError(f"System symbol file not found: {SYSTEM_SYMBOLS_PATH}")

    content = SYSTEM_SYMBOLS_PATH.read_text(encoding="utf-8")
    symbols = re.findall(r"^\s*([A-Z0-9_]+):\s*[\"']", content, flags=re.MULTILINE)
    if not symbols:
        raise ValueError(f"No symbols found in {SYSTEM_SYMBOLS_PATH}")

    overrides = load_yahoo_symbol_overrides()
    return {symbol: overrides.get(symbol, f"{symbol.replace('_', '-')}.NS") for symbol in symbols}


def load_yahoo_symbol_overrides() -> dict[str, str]:
    if not STOCK_SERVICE_PATH.exists():
        return {}

    content = STOCK_SERVICE_PATH.read_text(encoding="utf-8")
    matches = re.findall(r'^\s*"([A-Z0-9_]+)":\s*"([^"]+)"', content, flags=re.MULTILINE)
    return {symbol: yahoo_symbol for symbol, yahoo_symbol in matches}


def main():
    parser = argparse.ArgumentParser(description="Train StockVerse AI models")
    parser.add_argument("--symbols", help="Comma-separated app symbols, e.g. RELIANCE,TCS")
    parser.add_argument("--all-system", action="store_true", help="Train every symbol from backend/src/data/nseSymbols.js")
    parser.add_argument("--period", default="5y", help="Yahoo Finance period, e.g. 2y, 5y, 10y")
    parser.add_argument("--horizons", default="1,7,30,60,90", help="Comma-separated forecast horizons")
    parser.add_argument("--skip-lstm", action="store_true", help="Skip slower LSTM training")
    parser.add_argument("--skip-existing", action="store_true", help="Skip symbols with an existing multi-horizon model")
    args = parser.parse_args()

    horizons = [int(item.strip()) for item in args.horizons.split(",") if item.strip()]
    stocks = load_system_symbols() if args.all_system else parse_symbols(args.symbols)

    print("=" * 64)
    print("StockVerse AI - Model Training Pipeline")
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Symbols: {', '.join(stocks.keys())}")
    print(f"Horizons: {horizons}")
    print("=" * 64)

    results = {}
    for symbol, yahoo_symbol in stocks.items():
        print(f"\nProcessing {symbol}...")
        try:
            model_path = MULTI_HORIZON_MODEL_DIR / f"{symbol}_multi_horizon.joblib"
            if args.skip_existing and model_path.exists():
                print(f"  Existing model found for {symbol}; skipping.")
                results[symbol] = {"multiHorizon": "already_exists", "lstm": "skipped"}
                continue

            df = fetch_data(yahoo_symbol, period=args.period)
            if len(df) < max(260, max(horizons) + 160):
                print(f"  Insufficient data for {symbol}: {len(df)} rows")
                results[symbol] = "insufficient_data"
                continue

            multi_ok = train_multi_horizon_model(symbol, df, horizons)
            lstm_ok = False if args.skip_lstm else train_lstm(symbol, df)
            results[symbol] = {
                "multiHorizon": "trained" if multi_ok else "skipped",
                "lstm": "trained" if lstm_ok else "skipped",
            }
        except Exception as e:
            print(f"  Error: {e}")
            results[symbol] = {"error": str(e)}

    print("\n" + "=" * 64)
    print("Training Summary")
    print(json.dumps(results, indent=2))
    print("=" * 64)


if __name__ == "__main__":
    main()
