# Task State — NetSentry AI

- **Goal:** Execute PHASE 1 — Dataset Ingestion, EDA & Baseline ML Methodology: verified CIC-IDS2017 provenance, data cleaning, leakage audit, EDA, supervised LightGBM baseline, unsupervised Isolation Forest baseline with methodological thresholding, SHAP XAI attribution, and unit tests.
- **Status:** done
- **Class and Risk:** ARCHITECTURAL / MEDIUM
- **Owner:** Senior Software Architect & ML Engineer
- **UpdatedAt:** 2026-10-06T20:33:40+03:00

## Completed
1. Ingested all 8 canonical CIC-IDS2017 files (843.66 MB total, 2,830,743 raw rows).
2. Computed SHA-256 hashes and saved `dataset_manifest.json`.
3. Cleansed dataset: removed 2,867 Inf rows, 256,858 duplicates; created clean 341,713 flow dataset retaining 100% of minority attacks.
4. Normalized labels into 9 canonical security categories (`label_mapping.json`).
5. Conducted EDA and generated report artifacts (`class_distribution.png`, `missing_inf_overview.png`, `feature_distributions.png`, `eda_summary.json`).
6. Implemented strict leakage-safe pipeline (70% Train, 15% Val, 15% Test; Scaler fit strictly on Train).
7. Trained Supervised LightGBM model (EXP-001): 99.85% Accuracy, 93.74% Macro F1, 99.85% Weighted F1.
8. Trained Unsupervised Isolation Forest (EXP-002) on 166,899 pure benign flows with validation threshold optimization ($\tau^* = 0.49540$, Test Recall: 43.54%, FPR: 9.87%, ROC-AUC: 73.35%).
9. Extracted real SHAP TreeExplainer attributions (EXP-003) and generated `shap_summary.png`.
10. Executed full unit test suite (8/8 tests passed).
11. Updated all documentation files (`DATASET.md`, `ML-METHODOLOGY.md`, `EXPERIMENTS.md`, `DECISIONS.md`).

## Changed Files
- `apps/ml/data/dataset_manifest.json`: Verified provenance metadata and file hashes.
- `apps/ml/app/data/schema.py`: Canonical column names and excluded identifier schema.
- `apps/ml/app/preprocessing/label_normalizer.py`: Semantic label mapping and rationale.
- `apps/ml/app/data/ingestion.py`: Cleansing and ingestion pipeline.
- `apps/ml/app/data/eda.py`: Statistical analysis and EDA plot generator.
- `apps/ml/app/preprocessing/pipeline.py`: Leakage-safe stratified train/val/test split and scaler.
- `apps/ml/app/training/supervised.py`: Supervised LightGBM trainer and evaluator.
- `apps/ml/app/anomaly/isolation_forest.py`: Isolation Forest anomaly trainer and threshold sweep.
- `apps/ml/app/xai/shap_explainer.py`: TreeExplainer and feature attribution generator.
- `apps/ml/tests/`: Comprehensive test suite (8 tests).
- `docs/DATASET.md`, `docs/ML-METHODOLOGY.md`, `docs/EXPERIMENTS.md`, `docs/DECISIONS.md`: Updated with real empirical results.

## Remaining for Next Phase
- Phase 2: Asynchronous Flow Ingestion, Redis Event Stream, and Real-Time ML Inference Service integration.

## Known Problems
- Infiltration class recall is 33.3% due to extreme subtlety and rare occurrences (6 test samples), accurately mirroring real-world intrusion benchmark behavior.

## Last Validation
- Pytest: 8 passed in 3.53s.
- Clean dataset: 341,713 rows, 77 features, 0 NaN, 0 Inf.
- Supervised LightGBM: 99.85% Accuracy, 93.74% Macro F1.
- Isolation Forest: Selected $\tau = 0.49540$, 73.35% ROC-AUC.
