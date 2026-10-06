import math
import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.inference.model_loader import ModelArtifactLoader
from app.inference.service import InferenceService


@pytest.fixture(scope="module")
def loader():
    return ModelArtifactLoader.get_instance()


@pytest.fixture(scope="module")
def service(loader):
    return InferenceService(loader)


@pytest.fixture(scope="module")
def valid_features(loader):
    # Construct a valid 77-feature dictionary
    return {feat: 1.0 for feat in loader.feature_names}


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


def test_models_loaded(loader):
    assert loader.supervised_model is not None, "Supervised LightGBM model must be loaded"
    assert loader.anomaly_model is not None, "Isolation Forest anomaly model must be loaded"
    assert loader.shap_explainer is not None, "SHAP explainer must be loaded"
    assert loader.scaler is not None, "RobustScaler must be loaded"
    assert loader.label_encoder is not None, "Label encoder must be loaded"
    assert len(loader.feature_names) == 77, "Feature order must contain exactly 77 features"
    assert loader.anomaly_threshold == 0.4954, "Anomaly threshold must match Phase 1 calibration"


def test_valid_flow_prediction(service, valid_features):
    result = service.predict(flow_id="test-flow-001", features=valid_features, compute_shap=True)
    assert result["flowId"] == "test-flow-001"
    assert "verdict" in result
    assert "attackCategory" in result
    assert 0.0 <= result["supervisedConfidence"] <= 1.0
    assert 0.0 <= result["unsupervisedAnomalyScore"] <= 1.0
    assert result["anomalyThreshold"] == 0.4954
    assert isinstance(result["isAnomalous"], bool)
    assert result["severity"] in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    assert len(result["topFeatures"]) <= 5
    assert "telemetry" in result
    assert result["telemetry"]["total_ms"] > 0

    # Probability sum validation
    probs = result["classProbabilities"]
    assert probs is not None
    assert math.isclose(sum(probs.values()), 1.0, rel_tol=1e-3)


def test_missing_feature_rejection(service, valid_features, client):
    bad_features = valid_features.copy()
    del bad_features["destination_port"]

    with pytest.raises(ValueError, match="Missing 1 required features"):
        service.validate_features(bad_features)

    response = client.post("/api/v1/predict", json={"flow_id": "bad-flow", "features": bad_features})
    assert response.status_code == 400
    assert "Missing" in response.json()["detail"]


def test_unknown_feature_rejection(service, valid_features, client):
    bad_features = valid_features.copy()
    bad_features["unexpected_extra_metric"] = 42.0

    with pytest.raises(ValueError, match="Unknown 1 features detected"):
        service.validate_features(bad_features)

    response = client.post("/api/v1/predict", json={"flow_id": "bad-flow", "features": bad_features})
    assert response.status_code == 400
    assert "Unknown" in response.json()["detail"]


def test_wrong_datatype_rejection(service, valid_features, client):
    bad_features = valid_features.copy()
    bad_features["destination_port"] = "port_eighty"

    with pytest.raises(ValueError, match="Invalid non-numeric datatype"):
        service.validate_features(bad_features)

    response = client.post("/api/v1/predict", json={"flow_id": "bad-flow", "features": bad_features})
    assert response.status_code == 400


def test_nan_rejection(service, valid_features, client):
    bad_features = valid_features.copy()
    bad_features["flow_duration"] = float("nan")

    with pytest.raises(ValueError, match="cannot be NaN"):
        service.validate_features(bad_features)

    # In raw JSON text, NaN is parsed by python json.loads into float('nan')
    import json
    raw_payload = json.dumps({"flow_id": "bad-flow", "features": bad_features})
    response = client.post("/api/v1/predict", content=raw_payload, headers={"Content-Type": "application/json"})
    assert response.status_code == 400
    assert "NaN" in response.json()["detail"]


def test_infinity_rejection(service, valid_features, client):
    bad_features = valid_features.copy()
    bad_features["flow_duration"] = float("inf")

    with pytest.raises(ValueError, match="cannot be Infinite"):
        service.validate_features(bad_features)

    import json
    raw_payload = json.dumps({"flow_id": "bad-flow", "features": bad_features})
    response = client.post("/api/v1/predict", content=raw_payload, headers={"Content-Type": "application/json"})
    assert response.status_code == 400
    assert "Infinite" in response.json()["detail"]



def test_feature_ordering_integrity(service, loader, valid_features):
    # Shuffle keys arbitrarily
    import random
    items = list(valid_features.items())
    random.seed(42)
    random.shuffle(items)
    shuffled_features = dict(items)

    # validate_features must return ordered vector aligned with loader.feature_names
    X, _ = service.validate_features(shuffled_features)
    assert X.shape == (1, 77)


def test_shap_explanation_correctness(service, valid_features):
    result = service.predict(flow_id="test-shap-flow", features=valid_features, compute_shap=True)
    top_features = result["topFeatures"]
    assert len(top_features) > 0

    for feat in top_features:
        assert "feature" in feat
        assert "value" in feat
        assert "contribution" in feat
        assert "direction" in feat
        if feat["contribution"] > 0:
            assert feat["direction"] == "increases_risk"
        else:
            assert feat["direction"] == "decreases_risk"
