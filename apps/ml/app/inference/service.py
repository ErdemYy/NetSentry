import time
import uuid
from typing import Dict, Any, List, Tuple
import numpy as np

from app.inference.model_loader import ModelArtifactLoader
from app.inference.severity import calculate_severity


class InferenceService:
    def __init__(self, loader: ModelArtifactLoader = None):
        self.loader = loader or ModelArtifactLoader.get_instance()

    def validate_features(self, features: Dict[str, Any]) -> Tuple[np.ndarray, float]:
        t0 = time.perf_counter()

        expected_features = set(self.loader.feature_names)
        incoming_features = set(features.keys())

        # 1. Missing features check
        missing = expected_features - incoming_features
        if missing:
            raise ValueError(f"Missing {len(missing)} required features: {sorted(list(missing))[:5]}...")

        # 2. Unknown features check
        unknown = incoming_features - expected_features
        if unknown:
            raise ValueError(f"Unknown {len(unknown)} features detected: {sorted(list(unknown))[:5]}...")

        # 3. Build ordered array in exact canonical order
        vector = []
        for feat in self.loader.feature_names:
            val = features[feat]

            # Datatype check
            if not isinstance(val, (int, float, np.number)) or isinstance(val, bool):
                raise ValueError(f"Invalid non-numeric datatype for feature '{feat}': {type(val).__name__}")

            val_float = float(val)

            # NaN and Inf check
            if np.isnan(val_float):
                raise ValueError(f"Feature '{feat}' cannot be NaN")
            if np.isinf(val_float):
                raise ValueError(f"Feature '{feat}' cannot be Infinite")

            vector.append(val_float)

        X = np.array([vector], dtype=np.float64)
        validation_ms = (time.perf_counter() - t0) * 1000
        return X, validation_ms

    def predict(
        self,
        flow_id: str,
        features: Dict[str, Any],
        compute_shap: bool = True,
        timestamp: str = None,
        schema_version: str = None,
    ) -> Dict[str, Any]:
        t_start = time.perf_counter()

        if schema_version:
            self.loader.verify_schema_compatibility(schema_version)

        if timestamp is None:
            timestamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

        # 1. Validation & Vector Alignment
        X, validation_ms = self.validate_features(features)

        # 2. Preprocessing / Scaling
        t_prep0 = time.perf_counter()
        import pandas as pd
        X_df = pd.DataFrame(X, columns=self.loader.feature_names)
        X_scaled = self.loader.scaler.transform(X_df)
        preprocessing_ms = (time.perf_counter() - t_prep0) * 1000

        # 3. Supervised Prediction (LightGBM)
        t_sup0 = time.perf_counter()
        probs = self.loader.supervised_model.predict_proba(X_scaled)[0]
        pred_idx = int(np.argmax(probs))
        predicted_class = self.loader.classes[pred_idx]
        confidence = float(probs[pred_idx])
        class_probabilities = {
            cls: round(float(prob), 5) for cls, prob in zip(self.loader.classes, probs)
        }
        supervised_ms = (time.perf_counter() - t_sup0) * 1000

        # 4. Unsupervised Anomaly Scoring (Isolation Forest)
        t_ano0 = time.perf_counter()
        raw_score = self.loader.anomaly_model.score_samples(X_scaled)[0]
        anomaly_score = float(-raw_score)
        is_anomalous = bool(anomaly_score >= self.loader.anomaly_threshold)
        anomaly_ms = (time.perf_counter() - t_ano0) * 1000

        # 5. Hybrid Verdict Synthesis
        if predicted_class == "BENIGN":
            if is_anomalous:
                verdict = "UNKNOWN_ANOMALOUS"
            else:
                verdict = "NORMAL"
        else:
            if confidence >= 0.80 and is_anomalous:
                verdict = "HIGH_RISK"
            elif confidence >= 0.80:
                verdict = "KNOWN_ATTACK"
            else:
                verdict = "ANOMALOUS"

        # 6. Severity Assignment
        severity = calculate_severity(
            predicted_class=predicted_class,
            confidence=confidence,
            is_anomalous=is_anomalous,
            anomaly_score=anomaly_score,
        )

        # 7. SHAP Explanation
        top_features = []
        explanation_text = ""
        shap_ms = 0.0

        if compute_shap:
            t_shap0 = time.perf_counter()
            raw_shap = self.loader.shap_explainer.shap_values(X_scaled)

            # Handle multiclass shap values format
            if isinstance(raw_shap, list):
                class_shap = raw_shap[pred_idx][0]
            elif len(raw_shap.shape) == 3:
                class_shap = raw_shap[0, :, pred_idx]
            else:
                class_shap = raw_shap[0]

            top_indices = np.argsort(np.abs(class_shap))[::-1][:5]
            for idx in top_indices:
                feat_name = self.loader.feature_names[idx]
                feat_val = float(X[0, idx])
                contribution = float(class_shap[idx])
                direction = "increases_risk" if contribution > 0 else "decreases_risk"

                desc = f"{feat_name} ({feat_val:.2f}) {direction.replace('_', ' ')} for {predicted_class}"
                top_features.append({
                    "feature": feat_name,
                    "value": feat_val,
                    "contribution": round(contribution, 4),
                    "description": desc,
                    "direction": direction,
                })

            if top_features:
                primary = top_features[0]
                explanation_text = f"Primary decision factor: '{primary['feature']}' ({primary['contribution']:+.2f} contribution)."
            else:
                explanation_text = f"Model classified flow as {predicted_class} with {confidence*100:.1f}% confidence."

            shap_ms = (time.perf_counter() - t_shap0) * 1000
        else:
            explanation_text = f"Classified as {predicted_class} (Fast-path without SHAP)."

        total_ms = (time.perf_counter() - t_start) * 1000

        # Mapping predicted_class to AttackCategory enum in @netsentry/shared
        attack_category = predicted_class.upper()
        if attack_category == "BRUTEFORCE":
            attack_category = "BRUTE_FORCE"
        elif attack_category == "PORTSCAN":
            attack_category = "PORT_SCAN"
        elif attack_category == "WEBATTACK":
            attack_category = "WEB_ATTACK"

        return {
            "id": f"det-{uuid.uuid4().hex[:12]}",
            "flowId": flow_id,
            "timestamp": timestamp,
            "verdict": verdict,
            "attackCategory": attack_category,
            "supervisedConfidence": round(confidence, 4),
            "unsupervisedAnomalyScore": round(anomaly_score, 4),
            "anomalyThreshold": self.loader.anomaly_threshold,
            "isAnomalous": is_anomalous,
            "severity": severity,
            "topFeatures": top_features,
            "explanation": explanation_text,
            "modelVersionSupervised": f"LightGBM-{self.loader.metadata.get('model_version', '1.0.0')}",
            "modelVersionUnsupervised": f"IsolationForest-{self.loader.metadata.get('model_version', '1.0.0')}",
            "inferenceLatencyMs": round(total_ms, 3),
            "classProbabilities": class_probabilities,
            "telemetry": {
                "validation_ms": round(validation_ms, 3),
                "preprocessing_ms": round(preprocessing_ms, 3),
                "supervised_ms": round(supervised_ms, 3),
                "anomaly_ms": round(anomaly_ms, 3),
                "shap_ms": round(shap_ms, 3),
                "total_ms": round(total_ms, 3),
            },
        }
