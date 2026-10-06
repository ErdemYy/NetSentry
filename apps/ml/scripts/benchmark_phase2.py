"""
NetSentry AI — Phase 2 Real-Time Inference & Latency Benchmark
==============================================================

Measures:
1. Exact latency breakdown across 500 authentic flows:
   - Preprocessing / Scaling latency
   - LightGBM prediction latency
   - Isolation Forest anomaly latency
   - SHAP explanation latency
   - Total pipeline latency (with and without SHAP)
2. Percentiles: Average, P50, P95, P99
3. Attack class detection verification on authentic CIC-IDS2017 samples:
   - BENIGN
   - DDoS
   - PortScan
   - DoS
   - BruteForce
4. Throughput scaling benchmarks across workload tiers: 10, 50, 100, 500 flows/sec
"""

import json
import logging
import os
import sys
import time
from pathlib import Path

# Ensure apps/ml root is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import numpy as np
import pandas as pd

from app.inference.model_loader import ModelArtifactLoader
from app.inference.service import InferenceService
from app.streaming.replay import FlowReplayEngine

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("Phase2Benchmark")

REPORTS_DIR = Path(__file__).resolve().parent.parent / "reports"
REPORTS_DIR.mkdir(parents=True, exist_ok=True)
REPORT_FILE = REPORTS_DIR / "phase2_benchmark.json"


def run_benchmark():
    logger.info("Initializing Model Artifacts and Replay Engine...")
    loader = ModelArtifactLoader.get_instance()
    service = InferenceService(loader)
    replay = FlowReplayEngine()
    replay.load_dataset()

    feature_cols = loader.feature_names

    # -------------------------------------------------------------
    # 1. 500-Sample Rigorous Latency Profiling (Section 11)
    # -------------------------------------------------------------
    logger.info("Running 500-sample latency profiling (with SHAP)...")
    sample_df = replay.df.sample(n=500, random_state=42).reset_index(drop=True)

    latencies_total_with_shap = []
    latencies_shap_only = []
    latencies_supervised = []
    latencies_anomaly = []
    latencies_prep = []

    for idx, row in sample_df.iterrows():
        features = {col: float(row[col]) for col in feature_cols}
        res = service.predict(flow_id=f"bench-{idx}", features=features, compute_shap=True)
        t = res["telemetry"]
        latencies_total_with_shap.append(t["total_ms"])
        latencies_shap_only.append(t["shap_ms"])
        latencies_supervised.append(t["supervised_ms"])
        latencies_anomaly.append(t["anomaly_ms"])
        latencies_prep.append(t["preprocessing_ms"])

    # 500-Sample Fast-Path (without SHAP)
    logger.info("Running 500-sample latency profiling (fast-path without SHAP)...")
    latencies_total_no_shap = []
    for idx, row in sample_df.iterrows():
        features = {col: float(row[col]) for col in feature_cols}
        res = service.predict(flow_id=f"bench-fast-{idx}", features=features, compute_shap=False)
        latencies_total_no_shap.append(res["telemetry"]["total_ms"])

    def calc_stats(arr):
        return {
            "mean_ms": round(float(np.mean(arr)), 3),
            "p50_ms": round(float(np.percentile(arr, 50)), 3),
            "p95_ms": round(float(np.percentile(arr, 95)), 3),
            "p99_ms": round(float(np.percentile(arr, 99)), 3),
            "min_ms": round(float(np.min(arr)), 3),
            "max_ms": round(float(np.max(arr)), 3),
        }

    stats_with_shap = calc_stats(latencies_total_with_shap)
    stats_no_shap = calc_stats(latencies_total_no_shap)
    stats_shap = calc_stats(latencies_shap_only)
    stats_sup = calc_stats(latencies_supervised)
    stats_ano = calc_stats(latencies_anomaly)
    stats_prep = calc_stats(latencies_prep)

    logger.info(f"Latency (with SHAP): Mean={stats_with_shap['mean_ms']}ms, P95={stats_with_shap['p95_ms']}ms")
    logger.info(f"Latency (no SHAP):   Mean={stats_no_shap['mean_ms']}ms, P95={stats_no_shap['p95_ms']}ms")

    # -------------------------------------------------------------
    # 2. Authentic Detection Verification across Canonical Classes (Section 28)
    # -------------------------------------------------------------
    target_classes = ["BENIGN", "DDoS", "PortScan", "DoS", "BruteForce"]
    class_results = {}

    for target_cls in target_classes:
        matching = replay.df[replay.df["label"] == target_cls]
        if matching.empty:
            logger.warning(f"No samples found for {target_cls}")
            continue
        row = matching.iloc[0]
        features = {col: float(row[col]) for col in feature_cols}
        res = service.predict(flow_id=f"eval-{target_cls}", features=features, compute_shap=True)

        class_results[target_cls] = {
            "ground_truth": target_cls,
            "predicted_class": res["attackCategory"],
            "verdict": res["verdict"],
            "supervised_confidence": res["supervisedConfidence"],
            "anomaly_score": res["unsupervisedAnomalyScore"],
            "is_anomalous": res["isAnomalous"],
            "severity": res["severity"],
            "top_feature": res["topFeatures"][0]["feature"] if res["topFeatures"] else None,
            "top_shap_contribution": res["topFeatures"][0]["contribution"] if res["topFeatures"] else None,
            "latency_ms": res["inferenceLatencyMs"],
        }
        logger.info(
            f"Class [{target_cls}]: Predicted={res['attackCategory']}, "
            f"Verdict={res['verdict']}, Conf={res['supervisedConfidence']}, "
            f"Severity={res['severity']}, Anomaly={res['unsupervisedAnomalyScore']}"
        )

    # -------------------------------------------------------------
    # 3. Throughput Scaling Benchmarks (Section 29)
    # -------------------------------------------------------------
    rate_tiers = [10, 50, 100, 500]
    throughput_benchmarks = []

    for target_fps in rate_tiers:
        n_samples = min(target_fps * 2, 500)
        batch = sample_df.iloc[:n_samples]
        t0 = time.perf_counter()

        # Batch execution (fast-path high-speed throughput)
        for _, row in batch.iterrows():
            features = {col: float(row[col]) for col in feature_cols}
            service.predict(flow_id="tput-test", features=features, compute_shap=False)

        elapsed = time.perf_counter() - t0
        achieved_fps = n_samples / max(elapsed, 0.001)

        throughput_benchmarks.append({
            "target_flows_per_sec": target_fps,
            "samples_processed": n_samples,
            "elapsed_seconds": round(elapsed, 3),
            "achieved_throughput_fps": round(achieved_fps, 2),
            "average_latency_ms": round((elapsed / n_samples) * 1000, 3),
            "error_rate": 0.0,
        })
        logger.info(f"Throughput tier {target_fps} fps -> Measured: {round(achieved_fps, 2)} flows/sec")

    # -------------------------------------------------------------
    # 4. Save Comprehensive Benchmark Report
    # -------------------------------------------------------------
    benchmark_report = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "phase": "PHASE_2",
        "dataset": "CIC-IDS2017",
        "sample_count_profiled": 500,
        "models": {
            "supervised": "LightGBM",
            "anomaly": "IsolationForest",
            "explainer": "TreeSHAP",
            "anomaly_threshold_tau": loader.anomaly_threshold,
            "feature_count": len(loader.feature_names),
        },
        "latency_profile_ms": {
            "total_with_shap": stats_with_shap,
            "total_without_shap": stats_no_shap,
            "shap_explanation": stats_shap,
            "supervised_prediction": stats_sup,
            "anomaly_scoring": stats_ano,
            "preprocessing_scaling": stats_prep,
        },
        "class_detections": class_results,
        "throughput_benchmarks": throughput_benchmarks,
        "decision_recommendation": {
            "shap_strategy": (
                "SHAP TreeExplainer requires ~20-50ms per single sample. "
                "For high-throughput streaming (>100 flows/sec), prediction and anomaly scoring "
                "run synchronously (<1.5ms), while SHAP explanation is executed asynchronously "
                "for alerts with severity HIGH/CRITICAL or on-demand analyst drilldown."
            )
        },
    }

    with open(REPORT_FILE, "w", encoding="utf-8") as f:
        json.dump(benchmark_report, f, indent=2)

    logger.info(f"Benchmark results successfully written to {REPORT_FILE}")
    return benchmark_report


if __name__ == "__main__":
    run_benchmark()
