#!/usr/bin/env python3
"""
NetSentry AI — Fresh-Clone Reproducibility Bootstrap (Phase 7)
==============================================================

Automates end-to-end environment verification and bootstrap for fresh repository clones:
1. Python version and runtime environment check
2. Dependency verification
3. Directory layout initialization (data/pcap, models, runs, reports)
4. Dataset manifest and processed dataset presence verification
5. Model artifact existence and SHA-256 integrity validation
6. Optional training trigger (--train) if artifacts are absent
7. Feature schema contract validation (feature-schema-v1)
8. Smoke inference test
"""

import argparse
import hashlib
import json
import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))


def check_python_version() -> bool:
    print("[1/7] Checking Python runtime...")
    ver = sys.version_info
    if ver.major < 3 or (ver.major == 3 and ver.minor < 10):
        print(f"  [FAIL] Python 3.10+ required. Found: {ver.major}.{ver.minor}.{ver.micro}")
        return False
    print(f"  [PASS] Python {ver.major}.{ver.minor}.{ver.micro} detected.")
    return True


def check_dependencies() -> bool:
    print("\n[2/7] Checking required core dependencies...")
    required_packages = [
        "numpy",
        "pandas",
        "scipy",
        "sklearn",
        "lightgbm",
        "shap",
        "fastapi",
        "uvicorn",
        "redis",
        "scapy",
        "pydantic",
        "joblib",
    ]
    missing = []
    for pkg in required_packages:
        try:
            __import__(pkg)
        except ImportError:
            missing.append(pkg)

    if missing:
        print(f"  [FAIL] Missing packages: {', '.join(missing)}")
        print("  Install dependencies with: pip install -r requirements.txt")
        return False

    print("  [PASS] All core ML and streaming dependencies verified.")
    return True


def initialize_directories() -> bool:
    print("\n[3/7] Initializing directory layout...")
    dirs = [
        BASE_DIR / "data" / "pcap",
        BASE_DIR / "data" / "raw",
        BASE_DIR / "data" / "interim",
        BASE_DIR / "data" / "processed",
        BASE_DIR / "models",
        BASE_DIR / "runs",
        BASE_DIR / "reports",
    ]
    for d in dirs:
        d.mkdir(parents=True, exist_ok=True)
    print("  [PASS] Sandboxed PCAP, model, and data directories initialized.")
    return True


def check_dataset_status() -> bool:
    print("\n[4/7] Checking dataset availability...")
    processed_path = BASE_DIR / "data" / "processed" / "clean_flows.parquet"
    manifest_path = BASE_DIR / "data" / "dataset_manifest.json"

    if processed_path.exists():
        size_mb = round(processed_path.stat().st_size / (1024 * 1024), 2)
        print(f"  [PASS] Cleaned dataset found: {processed_path.name} ({size_mb} MB)")
        return True

    print("  [NOTE] Processed dataset clean_flows.parquet not found.")
    if manifest_path.exists():
        with open(manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)
        print(f"  Dataset Manifest: {manifest.get('dataset_name')} ({manifest.get('provider')})")
        print(f"  Download Mirror: {manifest.get('download_mirror')}")
        print("  Follow instructions in apps/ml/data/README.md to prepare raw CSVs.")
    return False


def verify_or_train_models(allow_train: bool = False) -> bool:
    print("\n[5/7] Verifying ML model artifacts and SHA-256 integrity...")
    models_dir = BASE_DIR / "models"
    meta_path = models_dir / "metadata.json"

    if not meta_path.exists():
        print("  [WARN] models/metadata.json not found.")
        return False

    with open(meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)

    expected_hashes = meta.get("artifact_hashes", {})
    all_valid = True
    missing_files = []

    for key, expected_hash in expected_hashes.items():
        filename = meta.get(key)
        if not filename:
            continue
        file_path = models_dir / filename
        if not file_path.exists():
            missing_files.append(filename)
            all_valid = False
            continue

        sha256 = hashlib.sha256()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                sha256.update(chunk)
        actual_hash = sha256.hexdigest().upper()

        if actual_hash != expected_hash.upper():
            print(f"  [FAIL] SHA-256 mismatch for {filename}!")
            all_valid = False
        else:
            print(f"  [PASS] {filename} SHA-256 verified.")

    if all_valid:
        print("  [PASS] All model artifacts cryptographically verified.")
        return True

    if missing_files:
        print(f"  Missing model files: {', '.join(missing_files)}")
        if allow_train:
            print("  [ACTION] --train specified: Starting baseline training pipeline...")
            from app.training.train_baseline import main as run_train
            run_train()
            return True
        else:
            print("  To train baseline models from dataset, run: python scripts/bootstrap.py --train")
            return False

    return False


def validate_schema_and_smoke_inference() -> bool:
    print("\n[6/7] Validating feature-schema-v1 contract...")
    models_dir = BASE_DIR / "models"
    meta_path = models_dir / "metadata.json"

    with open(meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)

    feature_order = meta.get("feature_order", [])
    if len(feature_order) != 77:
        print(f"  [FAIL] Expected 77 features, got {len(feature_order)}")
        return False
    print(f"  [PASS] Exact 77-feature contract validated (version: {meta.get('feature_schema_version')}).")

    print("\n[7/7] Running smoke inference test...")
    try:
        from app.inference.service import InferenceService
        service = InferenceService()

        # Build zero/baseline synthetic feature vector
        sample_features = {feat: 0.0 for feat in feature_order}
        sample_features["destination_port"] = 80
        sample_features["total_fwd_packets"] = 1

        result = service.predict(
            flow_id="bootstrap-smoke-flow-001",
            features=sample_features,
            compute_shap=True,
        )
        assert "verdict" in result, "Missing verdict in prediction"
        assert "supervisedConfidence" in result, "Missing supervisedConfidence in prediction"
        assert "unsupervisedAnomalyScore" in result, "Missing unsupervisedAnomalyScore in prediction"
        assert "explanation" in result, "Missing explanation in prediction"

        print(f"  [PASS] Smoke inference succeeded: Verdict={result['verdict']}, Latency={result['inferenceLatencyMs']} ms")
        return True
    except Exception as e:
        print(f"  [FAIL] Smoke inference failed: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description="NetSentry AI Fresh-Clone Bootstrap")
    parser.add_argument("--train", action="store_true", help="Automatically train baseline models if artifacts are missing")
    args = parser.parse_args()

    print("=" * 70)
    print("NetSentry AI — Fresh Clone Environment & Artifact Bootstrap")
    print("=" * 70)

    steps = [
        check_python_version(),
        check_dependencies(),
        initialize_directories(),
        check_dataset_status(),
        verify_or_train_models(allow_train=args.train),
        validate_schema_and_smoke_inference(),
    ]

    print("\n" + "=" * 70)
    if all(steps):
        print("BOOTSTRAP AUDIT: ALL SYSTEMS OPERATIONAL & READY FOR SERVICE!")
        print("=" * 70)
        sys.exit(0)
    else:
        print("BOOTSTRAP AUDIT: INCOMPLETE (Review issues flagged above)")
        print("=" * 70)
        sys.exit(1)


if __name__ == "__main__":
    main()
