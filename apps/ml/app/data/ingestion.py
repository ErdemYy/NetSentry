import json
import time
from pathlib import Path
from typing import Dict, Tuple, List, Optional
import numpy as np
import pandas as pd

from app.data.schema import CANONICAL_COLUMNS_MAPPING
from app.preprocessing.label_normalizer import normalize_label, export_mapping_metadata

BASE_DIR = Path(__file__).resolve().parent.parent.parent
RAW_DIR = BASE_DIR / "data" / "raw"
PROCESSED_DIR = BASE_DIR / "data" / "processed"
INTERIM_DIR = BASE_DIR / "data" / "interim"


def clean_dataframe(df: pd.DataFrame, file_name: str) -> Tuple[pd.DataFrame, Dict]:
    rows_before = len(df)

    # 1. Column Normalization
    renamed_cols = {}
    for col in df.columns:
        if col in CANONICAL_COLUMNS_MAPPING:
            renamed_cols[col] = CANONICAL_COLUMNS_MAPPING[col]
        else:
            cleaned = col.strip().lower().replace(" ", "_").replace("/", "_per_")
            renamed_cols[col] = cleaned
    df = df.rename(columns=renamed_cols)

    # Drop duplicate fwd_header_length column if present
    if "fwd_header_length_dup" in df.columns:
        df = df.drop(columns=["fwd_header_length_dup"])

    # 2. Label Normalization
    if "label" not in df.columns:
        raise ValueError(f"Label column missing in {file_name}")
    raw_labels = df["label"].astype(str).tolist()
    df["label"] = [normalize_label(lbl) for lbl in raw_labels]

    # 3. Numeric Conversion for Feature Columns
    feature_cols = [c for c in df.columns if c != "label"]
    for c in feature_cols:
        df[c] = pd.to_numeric(df[c], errors="coerce")

    # 4. Infinite Value Analysis and Cleaning
    inf_mask = np.isinf(df[feature_cols].values).any(axis=1)
    inf_count = int(inf_mask.sum())
    df_no_inf = df[~inf_mask].copy()
    rows_after_inf = len(df_no_inf)

    # 5. NaN Value Analysis and Cleaning
    nan_mask = df_no_inf[feature_cols].isna().any(axis=1)
    nan_count = int(nan_mask.sum())
    df_no_nan = df_no_inf[~nan_mask].copy()
    rows_after_nan = len(df_no_nan)

    # 6. Duplicate Analysis and Cleaning
    dup_mask = df_no_nan.duplicated(subset=feature_cols)
    dup_count = int(dup_mask.sum())
    df_dedup = df_no_nan[~dup_mask].copy()
    rows_after_dup = len(df_dedup)

    stats = {
        "file": file_name,
        "rows_before": rows_before,
        "inf_rows_removed": inf_count,
        "rows_after_inf_cleaning": rows_after_inf,
        "nan_rows_removed": nan_count,
        "rows_after_nan_cleaning": rows_after_nan,
        "duplicate_rows_removed": dup_count,
        "rows_after_duplicate_analysis": rows_after_dup,
        "rows_final": rows_after_dup,
    }

    return df_dedup, stats


def ingest_cic_dataset(
    sample_benign_per_day: Optional[int] = 30000,
    random_seed: int = 42,
) -> Tuple[pd.DataFrame, Dict]:
    t0 = time.time()
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    INTERIM_DIR.mkdir(parents=True, exist_ok=True)

    # Export label mapping metadata first
    export_mapping_metadata(BASE_DIR / "data" / "label_mapping.json")

    csv_files = sorted(list(RAW_DIR.glob("*.csv")))
    if not csv_files:
        raise FileNotFoundError(f"No CSV files found in {RAW_DIR}")

    print(f"Starting ingestion of {len(csv_files)} files from {RAW_DIR}...")
    file_stats = []
    cleaned_frames = []

    total_rows_raw = 0
    total_inf_removed = 0
    total_nan_removed = 0
    total_duplicates_removed = 0

    for csv_file in csv_files:
        print(f"Ingesting & cleansing: {csv_file.name}...")
        raw_df = pd.read_csv(csv_file, encoding="cp1252", low_memory=False)
        total_rows_raw += len(raw_df)

        clean_df, stats = clean_dataframe(raw_df, csv_file.name)
        file_stats.append(stats)

        total_inf_removed += stats["inf_rows_removed"]
        total_nan_removed += stats["nan_rows_removed"]
        total_duplicates_removed += stats["duplicate_rows_removed"]

        # Stratified sampling for voluminous files to maintain fast, reproducible training
        # while keeping 100% of all minority attacks
        if sample_benign_per_day is not None:
            benign_mask = clean_df["label"] == "BENIGN"
            attack_mask = ~benign_mask

            df_attack = clean_df[attack_mask]
            df_benign = clean_df[benign_mask]

            if len(df_benign) > sample_benign_per_day:
                df_benign = df_benign.sample(n=sample_benign_per_day, random_state=random_seed)

            # Cap massive attack classes (DoS Hulk, PortScan, DDoS) if they exceed 30,000 samples per file
            if len(df_attack) > 30000:
                # Keep minority attacks 100%, downsample only large ones
                sampled_attacks = []
                for attack_cat in df_attack["label"].unique():
                    subset = df_attack[df_attack["label"] == attack_cat]
                    if len(subset) > 30000:
                        sampled_attacks.append(subset.sample(n=30000, random_state=random_seed))
                    else:
                        sampled_attacks.append(subset)
                df_attack = pd.concat(sampled_attacks, ignore_index=True)

            sampled_day = pd.concat([df_benign, df_attack], ignore_index=True)
            cleaned_frames.append(sampled_day)
        else:
            cleaned_frames.append(clean_df)

    merged_df = pd.concat(cleaned_frames, ignore_index=True)

    # Global deduplication across all merged days
    feature_cols = [c for c in merged_df.columns if c != "label"]
    global_dups = int(merged_df.duplicated(subset=feature_cols).sum())
    final_df = merged_df.drop_duplicates(subset=feature_cols).reset_index(drop=True)

    duration = time.time() - t0
    print(f"\nIngestion finished in {duration:.2f}s.")
    print(f"Total raw rows across all 8 files: {total_rows_raw:,}")
    print(f"Total rows after cleansing and representative sampling: {len(final_df):,}")

    summary = {
        "dataset_name": "CIC-IDS2017",
        "ingestion_timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "random_seed": random_seed,
        "files_processed": len(csv_files),
        "rows_before": total_rows_raw,
        "rows_after_inf_cleaning": total_rows_raw - total_inf_removed,
        "rows_after_nan_cleaning": total_rows_raw - total_inf_removed - total_nan_removed,
        "rows_after_duplicate_analysis": total_rows_raw - total_inf_removed - total_nan_removed - total_duplicates_removed,
        "inf_rows_removed_total": total_inf_removed,
        "nan_rows_removed_total": total_nan_removed,
        "duplicate_rows_removed_total": total_duplicates_removed + global_dups,
        "rows_final": len(final_df),
        "features_count": len(feature_cols),
        "feature_names": feature_cols,
        "class_distribution": final_df["label"].value_counts().to_dict(),
        "per_file_statistics": file_stats,
    }

    # Save summary
    summary_path = PROCESSED_DIR / "dataset_summary.json"
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    # Save processed dataframe (using Parquet for fast loading and low disk footprint)
    processed_parquet_path = PROCESSED_DIR / "clean_flows.parquet"
    final_df.to_parquet(processed_parquet_path, index=False)
    print(f"Cleaned dataset saved to {processed_parquet_path} ({processed_parquet_path.stat().st_size / (1024*1024):.2f} MB)")

    return final_df, summary


if __name__ == "__main__":
    ingest_cic_dataset()
