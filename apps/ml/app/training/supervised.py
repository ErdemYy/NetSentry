import json
import time
from pathlib import Path
import joblib
import lightgbm as lgb
import matplotlib.pyplot as plt
import numpy as np
import seaborn as sns
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    classification_report,
    confusion_matrix,
)

from app.preprocessing.pipeline import prepare_dataset_splits

BASE_DIR = Path(__file__).resolve().parent.parent.parent
RUNS_DIR = BASE_DIR / "runs" / "baseline_supervised_001"
REPORTS_DIR = BASE_DIR / "reports"
MODELS_DIR = BASE_DIR / "models"


def train_supervised_baseline(random_state: int = 42):
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

    class_names = list(label_encoder.classes_)
    num_classes = len(class_names)

    print(f"\nTraining Supervised LightGBM Baseline on {len(X_train):,} samples ({num_classes} classes)...")

    # Hyperparameters for reliable baseline without overfitting
    params = {
        "objective": "multiclass",
        "num_class": num_classes,
        "metric": "multi_logloss",
        "boosting_type": "gbdt",
        "learning_rate": 0.1,
        "num_leaves": 31,
        "max_depth": -1,
        "random_state": random_state,
        "n_estimators": 100,
        "class_weight": "balanced",
        "verbosity": -1,
        "n_jobs": -1,
    }

    model = lgb.LGBMClassifier(**params)
    model.fit(
        X_train,
        y_train,
        eval_set=[(X_val, y_val)],
        callbacks=[lgb.early_stopping(stopping_rounds=10, verbose=False)],
    )

    training_duration = time.time() - t0
    print(f"Training completed in {training_duration:.2f}s.")

    # Evaluation on Test Set
    t_eval0 = time.time()
    y_pred = model.predict(X_test)
    eval_duration = time.time() - t_eval0

    acc = float(accuracy_score(y_test, y_pred))
    prec_macro = float(precision_score(y_test, y_pred, average="macro", zero_division=0))
    rec_macro = float(recall_score(y_test, y_pred, average="macro", zero_division=0))
    f1_macro = float(f1_score(y_test, y_pred, average="macro", zero_division=0))
    f1_weighted = float(f1_score(y_test, y_pred, average="weighted", zero_division=0))

    report_dict = classification_report(
        y_test, y_pred, target_names=class_names, output_dict=True, zero_division=0
    )
    cm = confusion_matrix(y_test, y_pred)
    cm_normalized = confusion_matrix(y_test, y_pred, normalize="true")

    # Save Model Artifacts
    model_path = MODELS_DIR / "supervised_lightgbm.joblib"
    joblib.dump(model, model_path)
    joblib.dump(model, RUNS_DIR / "model.joblib")

    # Save Metrics & Run Metadata
    run_metadata = {
        "experiment_id": "EXP-001",
        "model_name": "LightGBM_NIDS_Multiclass_Baseline",
        "model_version": "1.0.0",
        "training_timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "random_state": random_state,
        "train_rows": len(X_train),
        "val_rows": len(X_val),
        "test_rows": len(X_test),
        "feature_count": len(feature_names),
        "classes": class_names,
        "hyperparameters": params,
        "training_duration_seconds": round(training_duration, 2),
        "test_evaluation_seconds": round(eval_duration, 4),
        "metrics": {
            "accuracy": round(acc, 5),
            "precision_macro": round(prec_macro, 5),
            "recall_macro": round(rec_macro, 5),
            "f1_macro": round(f1_macro, 5),
            "f1_weighted": round(f1_weighted, 5),
        },
        "per_class_metrics": {
            cls: {
                "precision": round(float(report_dict[cls]["precision"]), 5),
                "recall": round(float(report_dict[cls]["recall"]), 5),
                "f1_score": round(float(report_dict[cls]["f1-score"]), 5),
                "support": int(report_dict[cls]["support"]),
            }
            for cls in class_names
            if cls in report_dict
        },
        "confusion_matrix": cm.tolist(),
        "confusion_matrix_normalized": [[round(float(v), 4) for v in row] for row in cm_normalized],
    }

    with open(RUNS_DIR / "metrics.json", "w", encoding="utf-8") as f:
        json.dump(run_metadata, f, indent=2)

    # Plot Confusion Matrix
    plt.style.use("dark_background")
    fig, ax = plt.subplots(figsize=(10, 8))
    sns.heatmap(
        cm_normalized,
        annot=True,
        fmt=".2f",
        cmap="Blues",
        xticklabels=class_names,
        yticklabels=class_names,
        ax=ax,
        cbar_kws={"label": "Normalized Recall"},
    )
    ax.set_title("Supervised LightGBM Baseline - Normalized Confusion Matrix", fontsize=13, pad=12)
    ax.set_xlabel("Predicted Label", fontsize=11)
    ax.set_ylabel("True Label", fontsize=11)
    plt.xticks(rotation=45, ha="right")
    plt.yticks(rotation=0)
    plt.tight_layout()
    fig.savefig(REPORTS_DIR / "confusion_matrix_supervised.png", dpi=200)
    fig.savefig(RUNS_DIR / "confusion_matrix.png", dpi=200)
    plt.close(fig)

    print("\n--- SUPERVISED BASELINE RESULTS ---")
    print(f"Accuracy:        {acc * 100:.2f}%")
    print(f"Macro F1-Score:  {f1_macro * 100:.2f}%")
    print(f"Weighted F1:     {f1_weighted * 100:.2f}%")
    print(f"Artifacts saved to {RUNS_DIR} and {REPORTS_DIR}.")

    return model, run_metadata


if __name__ == "__main__":
    train_supervised_baseline()
