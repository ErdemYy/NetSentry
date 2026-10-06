from pathlib import Path
import joblib
import numpy as np
import pytest

BASE_DIR = Path(__file__).resolve().parent.parent
MODELS_DIR = BASE_DIR / "models"


def test_supervised_model_prediction():
    model_path = MODELS_DIR / "supervised_lightgbm.joblib"
    encoder_path = MODELS_DIR / "label_encoder.joblib"
    assert model_path.exists(), "Supervised model not found."
    assert encoder_path.exists(), "Encoder not found."

    model = joblib.load(model_path)
    encoder = joblib.load(encoder_path)

    # 77 feature dummy input (scaled zeros)
    dummy_input = np.zeros((2, 77))
    preds = model.predict(dummy_input)
    probs = model.predict_proba(dummy_input)

    assert len(preds) == 2
    assert probs.shape == (2, len(encoder.classes_))
    # Probabilities must sum to 1
    np.testing.assert_allclose(probs.sum(axis=1), np.ones(2), rtol=1e-5)


def test_isolation_forest_scoring():
    iso_path = MODELS_DIR / "isolation_forest.joblib"
    assert iso_path.exists(), "Isolation Forest model not found."

    iso_model = joblib.load(iso_path)
    dummy_input = np.zeros((3, 77))
    # Score samples returns raw scores
    scores = -iso_model.score_samples(dummy_input)

    assert len(scores) == 3
    assert not np.isnan(scores).any()
    assert not np.isinf(scores).any()


def test_shap_explainer_loaded():
    explainer_path = MODELS_DIR / "shap_explainer.joblib"
    assert explainer_path.exists(), "SHAP explainer not found."

    explainer = joblib.load(explainer_path)
    dummy_input = np.zeros((1, 77))
    shap_vals = explainer.shap_values(dummy_input)

    assert shap_vals is not None
