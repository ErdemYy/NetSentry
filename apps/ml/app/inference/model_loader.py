import json
from pathlib import Path
from typing import Dict, Any, List, Optional
import joblib

BASE_DIR = Path(__file__).resolve().parent.parent.parent
MODELS_DIR = BASE_DIR / "models"


class ModelArtifactLoader:
    _instance: Optional["ModelArtifactLoader"] = None

    def __init__(self, models_dir: Path = MODELS_DIR):
        self.models_dir = models_dir
        self.metadata: Dict[str, Any] = {}
        self.scaler = None
        self.label_encoder = None
        self.supervised_model = None
        self.anomaly_model = None
        self.shap_explainer = None
        self.feature_names: List[str] = []
        self.classes: List[str] = []
        self.anomaly_threshold: float = 0.49540
        self.is_loaded: bool = False

    @classmethod
    def get_instance(cls) -> "ModelArtifactLoader":
        if cls._instance is None:
            cls._instance = cls()
            cls._instance.load()
        return cls._instance

    def load(self):
        meta_file = self.models_dir / "metadata.json"
        if not meta_file.exists():
            raise FileNotFoundError(f"Model metadata not found at {meta_file}")

        with open(meta_file, "r", encoding="utf-8") as f:
            self.metadata = json.load(f)

        self.feature_names = self.metadata["feature_order"]
        self.classes = self.metadata["classes"]
        self.anomaly_threshold = float(self.metadata.get("anomaly_threshold", 0.49540))

        # Validate artifact files exist
        scaler_path = self.models_dir / self.metadata["scaler_file"]
        encoder_path = self.models_dir / self.metadata["label_encoder_file"]
        supervised_path = self.models_dir / self.metadata["supervised_model_file"]
        anomaly_path = self.models_dir / self.metadata["anomaly_model_file"]
        shap_path = self.models_dir / self.metadata["shap_explainer_file"]

        for p in (scaler_path, encoder_path, supervised_path, anomaly_path, shap_path):
            if not p.exists():
                raise FileNotFoundError(f"Required artifact missing: {p}")

        print(f"[ModelArtifactLoader] Loading artifacts from {self.models_dir}...")
        self.scaler = joblib.load(scaler_path)
        self.label_encoder = joblib.load(encoder_path)
        self.supervised_model = joblib.load(supervised_path)
        self.anomaly_model = joblib.load(anomaly_path)
        self.shap_explainer = joblib.load(shap_path)

        # Integrity check on feature count
        if len(self.feature_names) != 77:
            raise ValueError(f"Expected 77 features in metadata, found {len(self.feature_names)}")

        self.is_loaded = True
        print(f"[ModelArtifactLoader] Successfully loaded all 5 artifacts ({len(self.classes)} classes, threshold={self.anomaly_threshold}).")
