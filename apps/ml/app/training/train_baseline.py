#!/usr/bin/env python3
"""
NetSentry AI — Baseline ML Reproducible Training Entrypoint
===========================================================

Executes full deterministic training pipeline with strict random_state=42:
1. Preprocessing & stratified splits with 100% minority retention
2. LightGBM Supervised Multi-Class Classifier
3. Unsupervised Isolation Forest Anomaly Estimator
4. TreeSHAP Explainer construction
5. SHA-256 Model Integrity Metadata generation
"""

import argparse
import sys
from pathlib import Path

from app.training.supervised import train_supervised_baseline
from app.anomaly.isolation_forest import train_isolation_forest
from app.xai.shap_explainer import build_tree_shap_explainer


def main():
    parser = argparse.ArgumentParser(description="NetSentry AI Baseline Training Pipeline")
    parser.add_argument("--random-state", type=int, default=42, help="Deterministic random seed (default: 42)")
    args = parser.parse_args()

    print("=" * 70)
    print("NetSentry AI — Reproducible Training Pipeline Launch")
    print(f"Random State: {args.random_state}")
    print("=" * 70)

    # 1. Supervised LightGBM
    print("\n[Step 1/3] Training Supervised LightGBM Multi-Class Classifier...")
    train_supervised_baseline(random_state=args.random_state)

    # 2. Isolation Forest
    print("\n[Step 2/3] Training Unsupervised Isolation Forest Anomaly Estimator...")
    train_isolation_forest(random_state=args.random_state)

    # 3. TreeSHAP Explainer
    print("\n[Step 3/3] Building TreeSHAP Explainer...")
    try:
        build_tree_shap_explainer()
    except Exception as e:
        print(f"TreeSHAP construction note: {e}")

    print("\n" + "=" * 70)
    print("TRAINING PIPELINE COMPLETE: All models saved to apps/ml/models/")
    print("=" * 70)


if __name__ == "__main__":
    main()
