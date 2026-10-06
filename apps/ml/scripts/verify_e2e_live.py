"""
NetSentry AI — Live End-to-End Pipeline Verification Script
===========================================================
Replays 5 distinct authentic flows (BENIGN, DDoS, PortScan, DoS, BruteForce)
from clean_flows.parquet into Redis Stream 'netsentry:flows',
executes MLStreamWorker to consume and run full inference + SHAP,
and verifies published DetectionResult events in 'netsentry:detections'.
"""

import json
import logging
import os
import sys
import time
from pathlib import Path

# Ensure apps/ml root is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.streaming.config import STREAMING_CONFIG
from app.streaming.replay import FlowReplayEngine
from app.streaming.worker import MLStreamWorker

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("LiveE2EVerification")


def verify_live_pipeline():
    logger.info("Initializing Live E2E Pipeline Verification...")
    replay = FlowReplayEngine()
    replay.load_dataset()

    worker = MLStreamWorker(worker_id="live-e2e-worker")
    worker.setup_stream_group()

    test_classes = ["BENIGN", "DDoS", "PortScan", "DoS", "BruteForce"]
    injected_flow_ids = []

    # 1. Replay 1 authentic sample of each class
    for cls_name in test_classes:
        logger.info(f"Replaying authentic sample for class '{cls_name}'...")
        samples = replay.df[replay.df["label"] == cls_name]
        if samples.empty:
            raise ValueError(f"No sample found for {cls_name}")
        row = samples.iloc[0]

        flow_id = f"live-{cls_name.lower()}-{int(time.time())}"
        injected_flow_ids.append((flow_id, cls_name))

        feature_cols = [c for c in replay.df.columns if c != "label"]
        features_dict = {col: float(row[col]) for col in feature_cols}
        flow_meta = replay._synthesize_network_flow(row, flow_id, time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))

        message_payload = {
            "flow_id": flow_id,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "features": json.dumps(features_dict),
            "flow": json.dumps(flow_meta),
            "compute_shap": "true",
            "ground_truth_label": cls_name,
        }
        replay.redis_client.xadd(STREAMING_CONFIG.stream_flows, message_payload)

    logger.info(f"Published {len(injected_flow_ids)} flows to stream '{STREAMING_CONFIG.stream_flows}'.")

    # 2. Consume and infer via MLStreamWorker
    processed_count = 0
    start_wait = time.time()
    while processed_count < len(injected_flow_ids) and (time.time() - start_wait) < 15:
        n = worker.process_batch(count=10, block_ms=1000)
        processed_count += n
        logger.info(f"Batch processed: {n} (Total: {processed_count})")

    logger.info(f"ML Worker processed {processed_count} flows.")

    # 3. Verify in output stream netsentry:detections
    detections = worker.redis_client.xrevrange(STREAMING_CONFIG.stream_detections, count=20)
    verified = {}

    for det_id, fields in detections:
        flow_id = fields.get("flow_id")
        for inj_id, expected_cls in injected_flow_ids:
            if flow_id == inj_id and inj_id not in verified:
                payload = json.loads(fields["payload"])
                verified[inj_id] = {
                    "expected_class": expected_cls,
                    "predicted_category": payload["attackCategory"],
                    "verdict": payload["verdict"],
                    "confidence": payload["supervisedConfidence"],
                    "anomaly_score": payload["unsupervisedAnomalyScore"],
                    "severity": payload["severity"],
                    "top_shap_feature": payload["topFeatures"][0]["feature"] if payload["topFeatures"] else None,
                    "latency_ms": payload["inferenceLatencyMs"],
                }

    logger.info("=== LIVE VERIFICATION RESULTS ===")
    for inj_id, res in verified.items():
        logger.info(
            f"Flow: {inj_id} | Ground Truth: {res['expected_class']} | "
            f"Predicted: {res['predicted_category']} | Verdict: {res['verdict']} | "
            f"Confidence: {res['confidence']} | Severity: {res['severity']} | "
            f"Latency: {res['latency_ms']}ms"
        )

    assert len(verified) == len(injected_flow_ids), f"Expected 5 verified detections, got {len(verified)}"
    logger.info("Live E2E Verification completely succeeded!")
    return verified


if __name__ == "__main__":
    verify_live_pipeline()
