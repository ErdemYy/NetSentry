# NetSentry AI — ML Experiments Log & Reproducibility Ledger

## 1. Experiment Overview

All experiments recorded in this ledger are executed deterministically on verified test splits with fixed random seeds (`random_state = 42`). No synthetic or mock metrics are permitted.

---

## 2. Experiment EXP-001: Supervised LightGBM Baseline

- **Experiment ID:** `EXP-001`
- **Execution Date:** 2026-10-06T17:29:16Z
- **Dataset:** CIC-IDS2017 Cleaned Flow Dataset (341,713 flows)
- **Features Used:** 77 numerical network flow attributes
- **Split Strategy:** 70% Train (239,199), 15% Validation (51,257), 15% Test (51,257) (Stratified)
- **Algorithm:** LightGBM Multi-Class Classifier (`LGBMClassifier`)
- **Hyperparameters:**
  - `objective`: `"multiclass"`
  - `num_class`: 9
  - `learning_rate`: 0.1
  - `num_leaves`: 31
  - `n_estimators`: 100
  - `class_weight`: `"balanced"`
- **Test Set Results:**
  - **Accuracy:** **99.85%** (0.99854)
  - **Macro Precision:** **98.78%** (0.98784)
  - **Macro Recall:** **92.45%** (0.92451)
  - **Macro F1-Score:** **93.74%** (0.93737)
  - **Weighted F1-Score:** **99.85%** (0.99853)
- **Per-Class Metrics on Test Set:**
  | Class | Precision | Recall | F1-Score | Support |
  |---|---|---|---|---|
  | **BENIGN** | 0.9998 | 0.9983 | 0.9990 | 35,764 |
  | **DDoS** | 0.9993 | 1.0000 | 0.9997 | 4,500 |
  | **PortScan** | 0.9958 | 0.9991 | 0.9975 | 4,500 |
  | **DoS** | 0.9976 | 0.9996 | 0.9986 | 4,500 |
  | **BruteForce** | 1.0000 | 1.0000 | 1.0000 | 1,373 |
  | **WebAttack** | 1.0000 | 0.9938 | 0.9969 | 321 |
  | **Botnet** | 0.8982 | 0.9966 | 0.9448 | 292 |
  | **Infiltration** | 1.0000 | 0.3333 | 0.5000 | 6 |
  | **Heartbleed** | 1.0000 | 1.0000 | 1.0000 | 1 |
- **Artifacts Saved:**
  - Model: `apps/ml/models/supervised_lightgbm.joblib`
  - Metrics: `apps/ml/runs/baseline_supervised_001/metrics.json`
  - Plot: `apps/ml/reports/confusion_matrix_supervised.png`
- **Observations:**
  Supervised model achieves near-perfect classification on volumetric and port scanning attacks. The macro F1 score is predominantly bounded by the Infiltration class (33.3% recall due to extreme subtlety and only 6 test instances), confirming natural dataset dynamics.

---

## 3. Experiment EXP-002: Unsupervised Isolation Forest Anomaly Baseline

- **Experiment ID:** `EXP-002`
- **Execution Date:** 2026-10-06T17:30:22Z
- **Dataset:** CIC-IDS2017 Monday & Benign Training Flows (166,899 flows)
- **Features Used:** 77 numerical network flow attributes
- **Algorithm:** Isolation Forest (`IsolationForest`, `n_estimators=100`, `contamination='auto'`)
- **Threshold Optimization ($\tau$):**
  - Validation sweep across 40 percentiles of benign validation scores.
  - Optimal threshold chosen on Validation set: $\tau^* = 0.49540$ (Validation F1: 52.66%).
- **Test Set Results:**
  - **Precision:** **65.65%**
  - **Recall:** **43.54%**
  - **F1-Score:** **52.36%**
  - **False Positive Rate:** **9.87%**
  - **ROC-AUC:** **73.35%**
  - **True Positives:** 6,746 / 15,493 attacks detected purely without labels
  - **False Positives:** 3,530 / 35,764 benign flows flagged as outliers
- **Artifacts Saved:**
  - Model: `apps/ml/models/isolation_forest.joblib`
  - Metrics: `apps/ml/runs/baseline_anomaly_001/metrics.json`
  - Plot: `apps/ml/reports/isolation_forest_threshold_analysis.png`
- **Observations:**
  Demonstrates classic unsupervised anomaly detection trade-offs: unsupervised scoring flags novel deviations without labels at the expense of higher false positive rates, justifying the hybrid decision synthesis engine.

---

## 4. Experiment EXP-003: Explainable AI (SHAP) Attribution Analysis

- **Experiment ID:** `EXP-003`
- **Execution Date:** 2026-10-06T17:30:57Z
- **Explainer:** `shap.TreeExplainer` on LightGBM Baseline
- **Evaluation Sample:** 500 stratified test instances
- **Key Discriminative Features:**
  - `bwd_packet_length_min`: Dominant discriminator for web attacks and background flows.
  - `destination_port`: Key indicator for port scanning reconnaissance and brute force.
  - `flow_packets_per_sec`: Key indicator for DoS and DDoS volumetric spikes.
- **Artifacts Saved:**
  - Explainer: `apps/ml/models/shap_explainer.joblib`
  - Sample Explanations: `apps/ml/reports/sample_shap_explanations.json`
  - Plot: `apps/ml/reports/shap_summary.png`
