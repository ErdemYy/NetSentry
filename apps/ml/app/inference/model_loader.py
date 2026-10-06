import hashlib
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
        self.feature_schema_version: str = "feature-schema-v1"
        self.is_loaded: bool = False

    @classmethod
    def get_instance(cls) -> "ModelArtifactLoader":
        if cls._instance is None:
            cls._instance = cls()
            cls._instance.load()
        return cls._instance

    @staticmethod
    def compute_sha256(file_path: Path) -> str:
        hasher = hashlib.sha256()
        with open(file_path, "rb") as f:
            while chunk := f.read(65536):
                hasher.update(chunk)
        return hasher.hexdigest().upper()

    def verify_schema_compatibility(self, payload_schema_version: Optional[str] = None):
        if payload_schema_version and payload_schema_version != self.feature_schema_version:
            raise ValueError(
                f"MODEL COMPATIBILITY ERROR: Schema version mismatch. "
                f"Model expects '{self.feature_schema_version}', payload provided '{payload_schema_version}'."
            )

    def load(self):
        meta_file = self.models_dir / "metadata.json"
        if not meta_file.exists():
            raise FileNotFoundError(f"Model metadata not found at {meta_file}")

        with open(meta_file, "r", encoding="utf-8") as f:
            self.metadata = json.load(f)

        self.feature_names = self.metadata["feature_order"]
        self.classes = self.metadata["classes"]
        self.anomaly_threshold = float(self.metadata.get("anomaly_threshold", 0.49540))
        self.feature_schema_version = self.metadata.get("feature_schema_version", "feature-schema-v1")

        # Validate artifact files exist and verify cryptographic integrity
        expected_hashes = self.metadata.get("artifact_hashes", {})
        artifact_keys = [
            ("scaler_file", "scaler"),
            ("label_encoder_file", "label_encoder"),
            ("supervised_model_file", "supervised_model"),
            ("anomaly_model_file", "anomaly_model"),
            ("shap_explainer_file", "shap_explainer"),
        ]

        for file_key, _ in artifact_keys:
            filename = self.metadata.get(file_key)
            if not filename:
                raise ValueError(f"Missing '{file_key}' definition in metadata.json")
            path = self.models_dir / filename
            if not path.exists():
                raise FileNotFoundError(f"Required artifact missing: {path}")

            # Verify cryptographic SHA-256 hash if defined
            if file_key in expected_hashes:
                expected_hash = expected_hashes[file_key].upper()
                actual_hash = self.compute_sha256(path)
                if actual_hash != expected_hash:
                    raise RuntimeError(
                        f"MODEL INTEGRITY CHECK FAILED: Hash mismatch for '{filename}'. "
                        f"Expected {expected_hash}, calculated {actual_hash}."
                    )

        print(f"[ModelArtifactLoader] Verified SHA-256 integrity for all artifacts. Loading from {self.models_dir}...")
        self.scaler = joblib.load(self.models_dir / self.metadata["scaler_file"])
        self.label_encoder = joblib.load(self.models_dir / self.metadata["label_encoder_file"])
        self.supervised_model = joblib.load(self.models_dir / self.metadata["supervised_model_file"])
        self.anomaly_model = joblib.load(self.models_dir / self.metadata["anomaly_model_file"])
        self.shap_explainer = joblib.load(self.models_dir / self.metadata["shap_explainer_file"])

        # Integrity check on feature count
        if len(self.feature_names) != 77:
            raise ValueError(f"Expected 77 features in metadata, found {len(self.feature_names)}")

        self.is_loaded = True
        print(
            f"[ModelArtifactLoader] Successfully loaded all 5 artifacts "
            f"({len(self.classes)} classes, threshold={self.anomaly_threshold}, schema={self.feature_schema_version})."
        )

