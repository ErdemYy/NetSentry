# Trained Model Artifacts

This directory stores serialized model weights and preprocessor scalers:
- Supervised models (`.joblib`, `.xgb`, `.lgb`)
- Unsupervised anomaly models (Isolation Forest, Autoencoder `.pt`)
- Preprocessor pipelines (`scaler.joblib`, `encoder.joblib`)
- Background SHAP explainers (`explainer.joblib`)

All model binaries are git-ignored. Each trained model must correspond to a logged record in the database `ModelVersion` table with accompanied evaluation metrics in `ModelEvaluation`.
