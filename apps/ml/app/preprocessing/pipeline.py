import json
from pathlib import Path
from typing import Tuple, Dict
import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, LabelEncoder

BASE_DIR = Path(__file__).resolve().parent.parent.parent
PROCESSED_FILE = BASE_DIR / "data" / "processed" / "clean_flows.parquet"
PROCESSED_DIR = BASE_DIR / "data" / "processed"
MODELS_DIR = BASE_DIR / "models"


def prepare_dataset_splits(
    random_state: int = 42,
    train_ratio: float = 0.70,
    val_ratio: float = 0.15,
    test_ratio: float = 0.15,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray, list, LabelEncoder]:
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

    print(f"Loading data from {PROCESSED_FILE} for leakage-safe splitting...")
    df = pd.read_parquet(PROCESSED_FILE)

    feature_cols = [c for c in df.columns if c != "label"]
    X = df[feature_cols].copy()
    y = df["label"].copy()

    # 1. Stratified Train / (Val + Test) Split
    # Split first BEFORE ANY fitting!
    val_test_ratio = val_ratio + test_ratio
    X_train, X_temp, y_train, y_temp = train_test_split(
        X, y, test_size=val_test_ratio, random_state=random_state, stratify=y
    )

    # 2. Stratified Validation / Test Split
    test_relative_ratio = test_ratio / val_test_ratio
    X_val, X_test, y_val, y_test = train_test_split(
        X_temp, y_temp, test_size=test_relative_ratio, random_state=random_state, stratify=y_temp
    )

    # 3. Leakage Verification Audits
    # Audit A: Exact row overlap check
    train_indices = set(X_train.index)
    val_indices = set(X_val.index)
    test_indices = set(X_test.index)
    assert len(train_indices.intersection(test_indices)) == 0, "CRITICAL: Train and Test indices overlap!"
    assert len(train_indices.intersection(val_indices)) == 0, "CRITICAL: Train and Validation indices overlap!"
    assert len(val_indices.intersection(test_indices)) == 0, "CRITICAL: Validation and Test indices overlap!"

    # Audit B: Identical feature vector leakage check
    # Check if duplicate identical vectors exist between train and test
    train_tuples = set(map(tuple, X_train.values[:10000]))  # sample for performance
    test_overlap_count = sum(1 for row in map(tuple, X_test.values[:5000]) if row in train_tuples)

    # 4. Fit Preprocessing ONLY on Train
    scaler = StandardScaler()
    scaler.fit(X_train)  # Strict rule: FIT ONLY ON TRAIN!

    X_train_scaled = scaler.transform(X_train)
    X_val_scaled = scaler.transform(X_val)
    X_test_scaled = scaler.transform(X_test)

    # 5. Encode Labels
    label_encoder = LabelEncoder()
    label_encoder.fit(y_train)

    y_train_encoded = label_encoder.transform(y_train)
    y_val_encoded = label_encoder.transform(y_val)
    y_test_encoded = label_encoder.transform(y_test)

    # 6. Save Transformers
    joblib.dump(scaler, MODELS_DIR / "scaler.joblib")
    joblib.dump(label_encoder, MODELS_DIR / "label_encoder.joblib")

    # 7. Save Split Metadata
    split_meta = {
        "random_state": random_state,
        "train_rows": len(X_train),
        "validation_rows": len(X_val),
        "test_rows": len(X_test),
        "feature_count": len(feature_cols),
        "feature_names": feature_cols,
        "classes": list(label_encoder.classes_),
        "train_class_distribution": pd.Series(y_train).value_counts().to_dict(),
        "val_class_distribution": pd.Series(y_val).value_counts().to_dict(),
        "test_class_distribution": pd.Series(y_test).value_counts().to_dict(),
        "leakage_audit": {
            "index_overlap": 0,
            "feature_vector_overlap_sampled": test_overlap_count,
            "scaler_fit_strictly_on_train": True,
        },
    }

    with open(PROCESSED_DIR / "split_metadata.json", "w", encoding="utf-8") as f:
        json.dump(split_meta, f, indent=2)

    print(f"Splits prepared cleanly:")
    print(f"  Train: {len(X_train):,} rows ({len(X_train)/len(df)*100:.1f}%)")
    print(f"  Val:   {len(X_val):,} rows ({len(X_val)/len(df)*100:.1f}%)")
    print(f"  Test:  {len(X_test):,} rows ({len(X_test)/len(df)*100:.1f}%)")
    print(f"Transformers saved to {MODELS_DIR}.")

    return (
        X_train_scaled,
        X_val_scaled,
        X_test_scaled,
        y_train_encoded,
        y_val_encoded,
        y_test_encoded,
        feature_cols,
        label_encoder,
    )


if __name__ == "__main__":
    prepare_dataset_splits()
