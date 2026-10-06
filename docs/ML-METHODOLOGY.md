# NetSentry AI — Machine Learning Methodology

## 1. Scientific Rigor & Leakage Prevention Protocol

Data leakage is the primary cause of artificially inflated performance in intrusion detection benchmarks. NetSentry AI establishes strict guardrails:

### Leakage Prevention Rules
1. **Partitioning Precedes Preprocessing:** The dataset is split into **Train (70%)**, **Validation (15%)**, and **Test (15%)** strictly before any scaling, encoding, or feature transformation.
2. **Train-Only Transformer Fitting:** Preprocessing objects (`StandardScaler`, `LabelEncoder`) are fit strictly on the Training set (`scaler.fit(X_train)`). The Validation and Test sets are transformed strictly using learned training parameters.
3. **Identifier Exclusion:** Network topology identifiers (`Flow ID`, IP addresses, timestamps) are strictly removed from feature matrices $X$ to prevent geographic or interface memorization.
4. **Duplicate Leakage Elimination:** Global deduplication is applied prior to splitting, and zero index overlap is verified via automated assertions.

---

## 2. Train / Validation / Test Partitioning

- **Total Instances:** 341,713 flows.
- **Split Configuration:**
  - **Training Set (70%):** 239,199 flows.
  - **Validation Set (15%):** 51,257 flows (Dedicated exclusively to early stopping and anomaly threshold $\tau$ optimization).
  - **Test Set (15%):** 51,257 flows (Held out strictly for unbiased final evaluation).
- **Stratification:** Class distributions across all 9 labels are proportionally preserved across Train, Validation, and Test partitions. Fixed seed `random_state = 42`.

---

## 3. Supervised Model Baseline (LightGBM)

- **Algorithm:** LightGBM Multi-Class Classifier (`LGBMClassifier`).
- **Configuration:**
  - Objective: `multiclass` (9 classes)
  - Loss Metric: `multi_logloss`
  - Learning Rate: `0.1`
  - Leaves: `31`
  - Class Weight: `balanced` (Addresses severe class imbalance for minority vectors)
  - Early Stopping: `10` rounds monitored against Validation log-loss
- **Evaluation on Test Set (EXP-001):**
  - **Accuracy:** **99.85%**
  - **Macro F1-Score:** **93.74%**
  - **Weighted F1-Score:** **99.85%**
  - **Test Inference Latency:** ~0.177 seconds for 51,257 flows (3.4 $\mu$s per flow).

---

## 4. Unsupervised Anomaly Detection Baseline (Isolation Forest)

- **Rationale:** Supervised classifiers fail to identify unknown or zero-day threats. Isolation Forest isolates anomalies by constructing random recursive partitioning trees, measuring average path depth.
- **Training Strategy:** Trained strictly on **166,899 pure BENIGN flows** from the Training set, learning normal operational network distributions without seeing any attack vectors.
- **Scoring Function:** Inverted anomaly score $s(x) = -\text{score\_samples}(x)$, where higher scores signify greater divergence from benign normality.

---

## 5. Methodological Threshold Selection ($\tau$)

Key Rule: **The anomaly threshold $\tau$ is never arbitrarily assigned (e.g. 0.5) nor tuned on the test set.**
- **Optimization Strategy:**
  1. A sweep across 40 candidate thresholds between the 80th and 99.5th percentiles of validation benign anomaly scores is performed.
  2. For each candidate $\tau$, Precision, Recall, F1, and False Positive Rate (FPR) are computed against ground-truth validation labels.
  3. The threshold maximizing the F1 harmonic mean while bounding FPR is selected.
- **Selected Threshold:** $\tau^* = 0.49540$ (Validation F1: 52.66%).
- **Independent Test Set Results (EXP-003):**
  - **Test Precision:** **65.65%**
  - **Test Recall:** **43.54%**
  - **Test F1-Score:** **52.36%**
  - **False Positive Rate:** **9.87%**
  - **ROC-AUC:** **73.35%**

---

## 6. eXplainable AI (XAI) via SHAP

- **Explainer Architecture:** `shap.TreeExplainer` instantiated directly on the trained LightGBM model.
- **Mechanism:** Computes exact additive feature contributions (Shapley values) for each flow classification.
- **Global Key Drivers:**
  `bwd_packet_length_min`, `destination_port`, `flow_packets_per_sec`, `init_win_bytes_fwd`, `bwd_packet_length_std`.
- **Local Explanations:** Real feature contributions are mapped dynamically, enabling SOC analysts to inspect the exact technical reason behind every detection.
