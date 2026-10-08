#!/usr/bin/env python3
"""
NetSentry AI — Scientific Experiment Consistency Validator (Phase 7)
===================================================================

Verifies mathematical consistency between the ground-truth run artifacts:
- apps/ml/runs/baseline_supervised_001/metrics.json
- apps/ml/runs/baseline_anomaly_001/metrics.json
and all public documentation:
- README.md
- docs/EXPERIMENTS.md
- docs/thesis/FINAL_VALIDATION.md
- docs/thesis/EXPERIMENTAL_RESULTS.md
- docs/thesis/LIMITATIONS.md
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

SUPERVISED_METRICS = ROOT / "apps" / "ml" / "runs" / "baseline_supervised_001" / "metrics.json"
ANOMALY_METRICS = ROOT / "apps" / "ml" / "runs" / "baseline_anomaly_001" / "metrics.json"

README_FILE = ROOT / "README.md"
EXPERIMENTS_FILE = ROOT / "docs" / "EXPERIMENTS.md"
FINAL_VAL_FILE = ROOT / "docs" / "thesis" / "FINAL_VALIDATION.md"
EXP_RESULTS_FILE = ROOT / "docs" / "thesis" / "EXPERIMENTAL_RESULTS.md"
LIMITATIONS_FILE = ROOT / "docs" / "thesis" / "LIMITATIONS.md"


def validate():
    print("=" * 70)
    print("NetSentry AI — Experiment Artifact & Document Consistency Audit")
    print("=" * 70)

    # 1. Load canonical metrics
    assert SUPERVISED_METRICS.exists(), f"Missing: {SUPERVISED_METRICS}"
    assert ANOMALY_METRICS.exists(), f"Missing: {ANOMALY_METRICS}"

    with open(SUPERVISED_METRICS, "r", encoding="utf-8") as f:
        sup_data = json.load(f)

    with open(ANOMALY_METRICS, "r", encoding="utf-8") as f:
        ano_data = json.load(f)

    # 2. Strict numeric assertions on canonical artifact
    sup_m = sup_data["metrics"]
    acc_pct = round(sup_m["accuracy"] * 100, 2)
    prec_macro_pct = round(sup_m["precision_macro"] * 100, 2)
    rec_macro_pct = round(sup_m["recall_macro"] * 100, 2)
    f1_macro_pct = round(sup_m["f1_macro"] * 100, 2)

    assert acc_pct == 99.85, f"Expected 99.85, got {acc_pct}"
    assert prec_macro_pct == 98.78, f"Expected 98.78, got {prec_macro_pct}"
    assert rec_macro_pct == 92.45, f"Expected 92.45, got {rec_macro_pct}"
    assert f1_macro_pct == 93.74, f"Expected 93.74, got {f1_macro_pct}"

    # Verify per-class supports & metrics
    classes = sup_data["per_class_metrics"]
    assert classes["Infiltration"]["support"] == 6, f"Expected 6 Infiltration, got {classes['Infiltration']['support']}"
    assert round(classes["Infiltration"]["recall"] * 100, 2) == 33.33
    assert classes["Heartbleed"]["support"] == 1, f"Expected 1 Heartbleed, got {classes['Heartbleed']['support']}"
    assert round(classes["Heartbleed"]["recall"] * 100, 2) == 100.00
    assert classes["BENIGN"]["support"] == 35764
    assert classes["DDoS"]["support"] == 4500
    assert classes["PortScan"]["support"] == 4500
    assert classes["DoS"]["support"] == 4500
    assert classes["BruteForce"]["support"] == 1373
    assert classes["WebAttack"]["support"] == 321
    assert classes["Botnet"]["support"] == 292

    total_test = sum(c["support"] for c in classes.values())
    assert total_test == 51257, f"Expected 51257 total test rows, got {total_test}"

    # Anomaly assertions
    ano_m = ano_data["test_metrics"]
    roc_auc_pct = round(ano_m["roc_auc"] * 100, 2)
    ano_prec_pct = round(ano_m["precision"] * 100, 2)
    ano_rec_pct = round(ano_m["recall"] * 100, 2)
    ano_f1_pct = round(ano_m["f1"] * 100, 2)
    ano_fpr_pct = round(ano_m["false_positive_rate"] * 100, 2)
    threshold = ano_data["optimal_threshold_tau"]

    assert roc_auc_pct == 73.35, f"Expected 73.35, got {roc_auc_pct}"
    assert ano_prec_pct in (65.65, 65.66), f"Expected 65.65 or 65.66, got {ano_prec_pct}"
    assert ano_rec_pct == 43.54, f"Expected 43.54, got {ano_rec_pct}"
    assert ano_f1_pct == 52.36, f"Expected 52.36, got {ano_f1_pct}"
    assert ano_fpr_pct == 9.87, f"Expected 9.87, got {ano_fpr_pct}"
    assert threshold == 0.4954, f"Expected 0.4954, got {threshold}"

    print("[PASS] Canonical metrics artifact integrity validated.")

    # 3. Verify documentation cross-consistency
    docs_to_check = [
        (README_FILE, ["99.85%", "93.74%", "92.45%", "98.78%", "73.35%", "52.36%", "65.65%", "43.54%", "9.87%", "0.49540"]),
        (EXPERIMENTS_FILE, ["99.85%", "93.74%", "92.45%", "98.78%", "73.35%", "52.36%", "35,764", "4,500", "1,373", "6"]),
        (FINAL_VAL_FILE, ["%99.85", "%93.74", "%92.45", "%98.78", "%73.35", "%52.36", "Destek: 6", "Destek: 1", "35,764"]),
        (EXP_RESULTS_FILE, ["%99.85", "%93.74", "%92.45", "%98.78", "%73.35", "%52.36", "35.764", "4.500", "6 akış"]),
        (LIMITATIONS_FILE, ["6 ve 1 örnek", "%33.33"]),
    ]

    for doc_path, expected_tokens in docs_to_check:
        assert doc_path.exists(), f"Document missing: {doc_path}"
        content = doc_path.read_text(encoding="utf-8")
        for token in expected_tokens:
            assert token in content, f"Consistency Failure: '{token}' missing from {doc_path.name}"
        print(f"[PASS] {doc_path.name} verified against canonical numbers.")

    print("\n" + "=" * 70)
    print("ALL EXPERIMENT & DOCUMENT CONSISTENCY CHECKS PASSED (100% MATCH)!")
    print("=" * 70)
    return True


if __name__ == "__main__":
    try:
        validate()
        sys.exit(0)
    except AssertionError as e:
        print(f"\n[FAIL] Consistency Error: {e}", file=sys.stderr)
        sys.exit(1)
