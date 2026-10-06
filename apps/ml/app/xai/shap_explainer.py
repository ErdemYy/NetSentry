import json
import time
from pathlib import Path
import joblib
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import shap

from app.preprocessing.pipeline import prepare_dataset_splits

BASE_DIR = Path(__file__).resolve().parent.parent.parent
MODELS_DIR = BASE_DIR / "models"
REPORTS_DIR = BASE_DIR / "reports"


def run_shap_analysis(sample_size: int = 500, random_state: int = 42):
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    t0 = time.time()

    print(f"Loading supervised model and test split for SHAP attribution...")
    model_path = MODELS_DIR / "supervised_lightgbm.joblib"
    if not model_path.exists():
        raise FileNotFoundError(f"Model not found at {model_path}. Train supervised model first.")

    model = joblib.load(model_path)
    label_encoder = joblib.load(MODELS_DIR / "label_encoder.joblib")

    # Load splits
    _, _, X_test, _, _, y_test, feature_names, _ = prepare_dataset_splits(random_state=random_state)

    # Sample test instances stratified across classes
    np.random.seed(random_state)
    sample_indices = np.random.choice(len(X_test), size=min(sample_size, len(X_test)), replace=False)
    X_sample = X_test[sample_indices]
    y_sample = y_test[sample_indices]

    print(f"Initializing SHAP TreeExplainer on {len(X_sample)} test samples...")
    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X_sample)

    # Save explainer
    joblib.dump(explainer, MODELS_DIR / "shap_explainer.joblib")

    # If multiclass, shap_values is a list of arrays (one per class) or 3D array (samples, features, classes)
    classes = list(label_encoder.classes_)

    # Extract sample individual explanations (top 5 features for a few test attacks)
    sample_explanations = []
    for i in range(min(10, len(X_sample))):
        pred_class_idx = int(model.predict(X_sample[i:i+1])[0])
        pred_class_name = classes[pred_class_idx]
        actual_class_name = classes[y_sample[i]]

        # Get shap values for the predicted class
        if isinstance(shap_values, list):
            sample_class_shap = shap_values[pred_class_idx][i]
        elif len(shap_values.shape) == 3:
            sample_class_shap = shap_values[i, :, pred_class_idx]
        else:
            sample_class_shap = shap_values[i]

        # Top 5 contributing features
        top_indices = np.argsort(np.abs(sample_class_shap))[::-1][:5]
        top_features = [
            {
                "feature": feature_names[idx],
                "feature_value_scaled": round(float(X_sample[i, idx]), 4),
                "shap_contribution": round(float(sample_class_shap[idx]), 4),
                "direction": "increases_risk" if sample_class_shap[idx] > 0 else "decreases_risk",
            }
            for idx in top_indices
        ]

        sample_explanations.append({
            "sample_index": int(sample_indices[i]),
            "predicted_class": pred_class_name,
            "actual_class": actual_class_name,
            "top_contributing_features": top_features,
        })

    with open(REPORTS_DIR / "sample_shap_explanations.json", "w", encoding="utf-8") as f:
        json.dump(sample_explanations, f, indent=2)

    # Plot SHAP Global Feature Importance
    plt.style.use("dark_background")
    fig, ax = plt.subplots(figsize=(10, 8))

    # Compute mean absolute SHAP value across all classes and samples
    if isinstance(shap_values, list):
        mean_abs_shap = np.mean([np.abs(sv).mean(axis=0) for sv in shap_values], axis=0)
    elif len(shap_values.shape) == 3:
        mean_abs_shap = np.abs(shap_values).mean(axis=(0, 2))
    else:
        mean_abs_shap = np.abs(shap_values).mean(axis=0)

    top_feature_idx = np.argsort(mean_abs_shap)[::-1][:15]
    top_feature_names = [feature_names[i] for i in top_feature_idx][::-1]
    top_feature_scores = mean_abs_shap[top_feature_idx][::-1]

    ax.barh(top_feature_names, top_feature_scores, color="#ff5b2e")
    ax.set_title("NetSentry AI — Top 15 Global Features by Mean |SHAP| Impact", fontsize=12, pad=12)
    ax.set_xlabel("Mean Absolute SHAP Value (Global Impact)", fontsize=10)
    plt.tight_layout()

    fig.savefig(REPORTS_DIR / "shap_summary.png", dpi=200)
    plt.close(fig)

    duration = time.time() - t0
    print(f"SHAP analysis completed in {duration:.2f}s. Artifacts saved to {REPORTS_DIR}.")
    return sample_explanations


if __name__ == "__main__":
    run_shap_analysis()
