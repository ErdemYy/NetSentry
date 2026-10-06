# NetSentry AI — ML Experiments Log & Reproducibility Ledger

## 1. Experimentation Protocol
Every model run must produce a verifiable record containing:
- Experiment ID (e.g. `EXP-001`)
- Date and timestamp
- Git commit hash
- Dataset partition and seed (`random_state=42`)
- Hyperparameters
- Evaluation metrics generated from test splits (Macro F1, Weighted F1, Accuracy, Inference Latency)
- Location of saved weights and confusion matrix artifacts

## 2. Planned Experiment Schedule

| ID | Model Type | Algorithm | Dataset Split | Objective | Status |
|---|---|---|---|---|---|
| `EXP-001` | Supervised Baseline | LightGBM | CIC-IDS2017 (80/20 Stratified) | Multi-class classification baseline | Scheduled (Phase 1) |
| `EXP-002` | Supervised Alternative | XGBoost | CIC-IDS2017 (80/20 Stratified) | Performance and latency comparison | Scheduled (Phase 1) |
| `EXP-003` | Unsupervised Baseline | Isolation Forest | Monday (Benign only) | Anomaly scoring on pure benign baseline | Scheduled (Phase 1) |
| `EXP-004` | XAI Attribution | SHAP TreeExplainer | Test Split (Sampled 1000) | Feature attribution latency & fidelity | Scheduled (Phase 1) |

## 3. Metric Recording Format
```json
{
  "experiment_id": "EXP-001",
  "model_name": "LightGBM_NIDS_Multiclass",
  "training_timestamp": "ISO_TIMESTAMP",
  "metrics": {
    "overall_accuracy": 0.0,
    "macro_f1": 0.0,
    "weighted_f1": 0.0,
    "latency_p95_ms": 0.0
  },
  "artifact_paths": {
    "model_weights": "models/exp001_lightgbm.joblib",
    "confusion_matrix": "artifacts/exp001_cm.png"
  }
}
```
*(No mock metrics are pre-filled in accordance with project principles).*
