import json
import time
from pathlib import Path
import joblib
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.metrics import (
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
    roc_auc_score,
)

from app.preprocessing.pipeline import prepare_dataset_splits

BASE_DIR = Path(__file__).resolve().parent.parent.parent
RUNS_DIR = BASE_DIR / "runs" / "baseline_anomaly_001"
REPORTS_DIR = BASE_DIR / "reports"
MODELS_DIR = BASE_DIR / "models"


def train_isolation_forest(random_state: int = 42):
    RUNS_DIR.mkdir(parents=True, exist_ok=True)
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    t0 = time.time()
    (
        X_train,
        X_val,
        X_test,
        y_train,
        y_val,
        y_test,
        feature_names,
        label_encoder,
    ) = prepare_dataset_splits(random_state=random_state)

    benign_idx = list(label_encoder.classes_).index("BENIGN")

    # 1. Filter Pure Benign Samples for Training
    benign_train_mask = y_train == benign_idx
    X_train_benign = X_train[benign_train_mask]
    print(f"\nTraining Isolation Forest on {len(X_train_benign):,} pure BENIGN baseline flows...")

    iso_forest = IsolationForest(
        n_estimators=100,
        max_samples="auto",
        contamination="auto",
        random_state=random_state,
        n_jobs=-1,
    )
    iso_forest.fit(X_train_benign)
    train_duration = time.time() - t0
    print(f"Isolation Forest training completed in {train_duration:.2f}s.")

    # In Scikit-learn, score_samples returns opposite of anomaly score (lower is more anomalous).
    # We invert it: anomaly_score = -score_samples(X), so HIGHER means MORE ANOMALOUS.
    val_scores = -iso_forest.score_samples(X_val)
    val_y_binary = (y_val != benign_idx).astype(int)  # 1 = Anomaly (Attack), 0 = Normal (Benign)

    val_benign_scores = val_scores[val_y_binary == 0]

    # 2. Methodological Threshold Selection on Validation Set ONLY
    # Sweep candidate thresholds from percentiles of benign validation scores
    candidate_percentiles = np.linspace(80, 99.5, 40)
    candidate_thresholds = np.percentile(val_benign_scores, candidate_percentiles)

    threshold_grid = []
    best_tau = None
    best_f1 = -1.0

    for pct, tau in zip(candidate_percentiles, candidate_thresholds):
        val_preds_binary = (val_scores >= tau).astype(int)
        tn, fp, fn, tp = confusion_matrix(val_y_binary, val_preds_binary).ravel()
        prec = precision_score(val_y_binary, val_preds_binary, zero_division=0)
        rec = recall_score(val_y_binary, val_preds_binary, zero_division=0)
        f1 = f1_score(val_y_binary, val_preds_binary, zero_division=0)
        fpr = fp / (fp + tn) if (fp + tn) > 0 else 0.0

        threshold_grid.append({
            "percentile": round(float(pct), 2),
            "threshold": round(float(tau), 5),
            "precision": round(float(prec), 5),
            "recall": round(float(rec), 5),
            "f1": round(float(f1), 5),
            "fpr": round(float(fpr), 5),
            "tp": int(tp),
            "fp": int(fp),
            "tn": int(tn),
            "fn": int(fn),
        })

        if f1 > best_f1:
            best_f1 = f1
            best_tau = tau

    print(f"Optimal threshold selected on validation set: tau = {best_tau:.5f} (Val F1: {best_f1:.4f})")

    # 3. Final Evaluation on Independent Test Set
    test_scores = -iso_forest.score_samples(X_test)
    test_y_binary = (y_test != benign_idx).astype(int)

    test_preds_binary = (test_scores >= best_tau).astype(int)
    tn_test, fp_test, fn_test, tp_test = confusion_matrix(test_y_binary, test_preds_binary).ravel()

    test_prec = float(precision_score(test_y_binary, test_preds_binary, zero_division=0))
    test_rec = float(recall_score(test_y_binary, test_preds_binary, zero_division=0))
    test_f1 = float(f1_score(test_y_binary, test_preds_binary, zero_division=0))
    test_fpr = float(fp_test / (fp_test + tn_test)) if (fp_test + tn_test) > 0 else 0.0
    test_roc_auc = float(roc_auc_score(test_y_binary, test_scores))

    # Save Model
    joblib.dump(iso_forest, MODELS_DIR / "isolation_forest.joblib")
    joblib.dump(iso_forest, RUNS_DIR / "model.joblib")

    # Save Run Metadata
    run_meta = {
        "experiment_id": "EXP-003",
        "model_name": "Isolation_Forest_Anomaly_Baseline",
        "model_version": "1.0.0",
        "training_timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "random_state": random_state,
        "train_benign_rows": len(X_train_benign),
        "val_rows": len(X_val),
        "test_rows": len(X_test),
        "optimal_threshold_tau": round(float(best_tau), 5),
        "validation_best_f1": round(float(best_f1), 5),
        "test_metrics": {
            "precision": round(test_prec, 5),
            "recall": round(test_rec, 5),
            "f1": round(test_f1, 5),
            "false_positive_rate": round(test_fpr, 5),
            "roc_auc": round(test_roc_auc, 5),
            "true_positive_count": int(tp_test),
            "false_positive_count": int(fp_test),
            "true_negative_count": int(tn_test),
            "false_negative_count": int(fn_test),
            "normal_predicted_count": int(tn_test + fn_test),
            "anomaly_predicted_count": int(tp_test + fp_test),
        },
        "threshold_grid_validation": threshold_grid,
    }

    with open(RUNS_DIR / "metrics.json", "w", encoding="utf-8") as f:
        json.dump(run_meta, f, indent=2)

    # Plot Threshold Analysis
    plt.style.use("dark_background")
    fig, ax1 = plt.subplots(figsize=(10, 6))

    df_grid = pd.DataFrame(threshold_grid)
    ax1.plot(df_grid["threshold"], df_grid["f1"], color="#ff5b2e", label="F1-Score", lw=2)
    ax1.plot(df_grid["threshold"], df_grid["precision"], color="#2a9d8f", label="Precision", lw=1.5, ls="--")
    ax1.plot(df_grid["threshold"], df_grid["recall"], color="#4f8cff", label="Recall", lw=1.5, ls="--")
    ax1.axvline(best_tau, color="#ecebe6", ls=":", label=f"Selected tau ({best_tau:.4f})")

    ax1.set_xlabel("Anomaly Score Threshold (tau)", fontsize=11)
    ax1.set_ylabel("Score (Precision / Recall / F1)", fontsize=11)
    ax1.set_title("Isolation Forest - Methodological Threshold Selection on Validation Set", fontsize=12, pad=12)
    ax1.legend(loc="lower left")

    ax2 = ax1.twinx()
    ax2.plot(df_grid["threshold"], df_grid["fpr"], color="#f77f00", label="FPR (False Positive Rate)", lw=1.5)
    ax2.set_ylabel("False Positive Rate", color="#f77f00", fontsize=11)
    ax2.tick_params(axis="y", labelcolor="#f77f00")

    plt.tight_layout()
    fig.savefig(REPORTS_DIR / "isolation_forest_threshold_analysis.png", dpi=200)
    fig.savefig(RUNS_DIR / "threshold_analysis.png", dpi=200)
    plt.close(fig)

    print("\n--- ISOLATION FOREST ANOMALY BASELINE RESULTS ---")
    print(f"Optimal Threshold (tau): {best_tau:.5f}")
    print(f"Test Precision:          {test_prec * 100:.2f}%")
    print(f"Test Recall:             {test_rec * 100:.2f}%")
    print(f"Test F1-Score:           {test_f1 * 100:.2f}%")
    print(f"Test False Positive Rate:{test_fpr * 100:.2f}%")
    print(f"Test ROC-AUC:            {test_roc_auc * 100:.2f}%")
    print(f"Artifacts saved to {RUNS_DIR} and {REPORTS_DIR}.")

    return iso_forest, run_meta


if __name__ == "__main__":
    train_isolation_forest()
