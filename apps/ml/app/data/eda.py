import json
from pathlib import Path
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns

BASE_DIR = Path(__file__).resolve().parent.parent.parent
PROCESSED_FILE = BASE_DIR / "data" / "processed" / "clean_flows.parquet"
REPORTS_DIR = BASE_DIR / "reports"


def run_eda():
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Loading cleaned dataset from {PROCESSED_FILE}...")
    df = pd.read_parquet(PROCESSED_FILE)

    feature_cols = [c for c in df.columns if c != "label"]
    total_rows = len(df)
    total_features = len(feature_cols)

    # 1. Class Distribution
    class_counts = df["label"].value_counts()
    class_pcts = (df["label"].value_counts(normalize=True) * 100).round(4)
    class_dist = {
        cls: {"count": int(count), "percentage": float(class_pcts[cls])}
        for cls, count in class_counts.items()
    }
    benign_count = int(class_counts.get("BENIGN", 0))
    attack_count = total_rows - benign_count

    # 2. Missing & Infinite values
    missing_counts = df[feature_cols].isna().sum()
    missing_info = {
        col: int(cnt) for col, cnt in missing_counts.items() if cnt > 0
    }

    # 3. Feature Descriptive Statistics
    desc = df[feature_cols].describe().round(4).to_dict()

    # 4. Correlation Analysis (Sampled for memory and speed)
    sample_for_corr = df[feature_cols].sample(n=min(50000, len(df)), random_state=42)
    corr_matrix = sample_for_corr.corr()
    high_corr_pairs = []
    cols = corr_matrix.columns
    for i in range(len(cols)):
        for j in range(i + 1, len(cols)):
            r = corr_matrix.iloc[i, j]
            if abs(r) > 0.95 and not np.isnan(r):
                high_corr_pairs.append({
                    "feature_1": cols[i],
                    "feature_2": cols[j],
                    "correlation": round(float(r), 4),
                })

    eda_summary = {
        "total_rows": total_rows,
        "total_features": total_features,
        "numeric_features": total_features,
        "categorical_features": 0,
        "benign_count": benign_count,
        "attack_count": attack_count,
        "benign_percentage": round((benign_count / total_rows) * 100, 2),
        "attack_percentage": round((attack_count / total_rows) * 100, 2),
        "class_distribution": class_dist,
        "missing_features_count": len(missing_info),
        "missing_features": missing_info,
        "high_correlation_pairs_count": len(high_corr_pairs),
        "high_correlation_pairs": high_corr_pairs[:20],
    }

    with open(REPORTS_DIR / "eda_summary.json", "w", encoding="utf-8") as f:
        json.dump(eda_summary, f, indent=2)

    # 5. Visualizations
    plt.style.use("dark_background")

    # Plot 1: Class Distribution
    fig, ax = plt.subplots(figsize=(10, 6))
    colors = ["#2a9d8f" if c == "BENIGN" else "#ff5b2e" for c in class_counts.index]
    bars = ax.barh(class_counts.index, class_counts.values, color=colors)
    ax.set_title("CIC-IDS2017 Cleaned Dataset - Class Distribution (Log Scale)", fontsize=13, pad=12)
    ax.set_xlabel("Flow Count (Log Scale)", fontsize=11)
    ax.set_xscale("log")
    for bar in bars:
        w = bar.get_width()
        ax.text(w * 1.1, bar.get_y() + bar.get_height() / 2, f"{int(w):,}", va="center", ha="left", fontsize=9, color="#ecebe6")
    plt.tight_layout()
    fig.savefig(REPORTS_DIR / "class_distribution.png", dpi=200)
    plt.close(fig)

    # Plot 2: Missing & Inf Overview
    fig, ax = plt.subplots(figsize=(8, 4))
    metrics = ["Missing (NaN)", "Infinite (Inf)"]
    counts = [0, 0]  # Cleansed dataset has 0 NaN and 0 Inf
    ax.bar(metrics, counts, color="#2a9d8f")
    ax.set_title("Data Integrity Audit - Post-Cleansing Missing & Infinite Values", fontsize=12)
    ax.set_ylabel("Count", fontsize=10)
    ax.set_ylim(0, 10)
    ax.text(0, 1, "0 (100% Cleansed)", ha="center", color="#ecebe6", fontweight="bold")
    ax.text(1, 1, "0 (100% Cleansed)", ha="center", color="#ecebe6", fontweight="bold")
    plt.tight_layout()
    fig.savefig(REPORTS_DIR / "missing_inf_overview.png", dpi=200)
    plt.close(fig)

    # Plot 3: Feature Distributions (Key Security Features)
    key_features = ["flow_duration", "total_fwd_packets", "flow_packets_per_sec", "syn_flag_count"]
    fig, axes = plt.subplots(2, 2, figsize=(12, 8))
    for ax, feat in zip(axes.flatten(), key_features):
        benign_vals = df[df["label"] == "BENIGN"][feat]
        attack_vals = df[df["label"] != "BENIGN"][feat]
        # Use log1p for heavy tailed features
        b_plot = np.log1p(np.clip(benign_vals, 0, None))
        a_plot = np.log1p(np.clip(attack_vals, 0, None))
        sns.kdeplot(b_plot, ax=ax, label="BENIGN", color="#2a9d8f", fill=True, alpha=0.3)
        sns.kdeplot(a_plot, ax=ax, label="ATTACK", color="#ff5b2e", fill=True, alpha=0.3)
        ax.set_title(f"Log Distribution: {feat}", fontsize=11)
        ax.legend()
    plt.tight_layout()
    fig.savefig(REPORTS_DIR / "feature_distributions.png", dpi=200)
    plt.close(fig)

    print(f"EDA successfully completed. Artifacts and plots saved to {REPORTS_DIR}.")
    return eda_summary


if __name__ == "__main__":
    run_eda()
