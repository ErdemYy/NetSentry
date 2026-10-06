from pathlib import Path
import json
import joblib
import numpy as np
import pandas as pd
import pytest
from sklearn.preprocessing import StandardScaler

BASE_DIR = Path(__file__).resolve().parent.parent
SPLIT_META_PATH = BASE_DIR / "data" / "processed" / "split_metadata.json"
SCALER_PATH = BASE_DIR / "models" / "scaler.joblib"
PROCESSED_FILE = BASE_DIR / "data" / "processed" / "clean_flows.parquet"


def test_no_index_overlap_in_splits():
    assert SPLIT_META_PATH.exists(), "Split metadata does not exist."
    with open(SPLIT_META_PATH, "r", encoding="utf-8") as f:
        meta = json.load(f)

    audit = meta.get("leakage_audit", {})
    assert audit.get("index_overlap") == 0, "Index overlap detected between splits!"
    assert audit.get("scaler_fit_strictly_on_train") is True


def test_scaler_is_not_fit_on_test_data():
    assert SCALER_PATH.exists(), "Scaler not found."
    scaler: StandardScaler = joblib.load(SCALER_PATH)

    df = pd.read_parquet(PROCESSED_FILE)
    feature_cols = [c for c in df.columns if c != "label"]

    # Compute statistics of full dataset vs train-fit scaler
    full_mean = df[feature_cols].mean().values
    train_mean = scaler.mean_

    # If scaler had been fit on full dataset, train_mean would equal full_mean exactly.
    # Since it was fit STRICTLY on train, train_mean must slightly diverge from full_mean.
    max_diff = np.max(np.abs(full_mean - train_mean))
    assert max_diff > 1e-6, "Leakage warning: Scaler appears to match full dataset mean identically!"
