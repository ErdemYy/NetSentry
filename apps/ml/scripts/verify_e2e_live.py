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

    # Fast-forward consumer group cursor to end of stream so this verification immediately inspects newly injected flows
    try:
        worker.redis_client.xgroup_setid(
            STREAMING_CONFIG.stream_flows,
            STREAMING_CONFIG.consumer_group,
            "$"
        )
    except Exception as e:
        logger.debug(f"Consumer group cursor adjustment: {e}")

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
            "source": "replay",
        }
        replay.redis_client.xadd(STREAMING_CONFIG.stream_flows, message_payload)

    logger.info(f"Published {len(injected_flow_ids)} flows to stream '{STREAMING_CONFIG.stream_flows}'.")

    # 2. Consume and infer via MLStreamWorker until all injected flows are detected
    start_wait = time.time()
    verified = {}
    target_ids = {inj_id: expected_cls for inj_id, expected_cls in injected_flow_ids}

    while len(verified) < len(injected_flow_ids) and (time.time() - start_wait) < 25:
        worker.process_batch(count=10, block_ms=500)

        # Check output stream netsentry:detections
        detections = worker.redis_client.xrevrange(STREAMING_CONFIG.stream_detections, count=50)
        for det_id, fields in detections:
            flow_id = fields.get("flow_id")
            if flow_id in target_ids and flow_id not in verified:
                payload = json.loads(fields["payload"])
                verified[flow_id] = {
                    "expected_class": target_ids[flow_id],
                    "predicted_category": payload.get("attackCategory"),
                    "verdict": payload.get("verdict"),
                    "confidence": payload.get("supervisedConfidence"),
                    "anomaly_score": payload.get("unsupervisedAnomalyScore"),
                    "severity": payload.get("severity"),
                    "top_shap_feature": payload["topFeatures"][0]["feature"] if payload.get("topFeatures") else None,
                    "latency_ms": payload.get("inferenceLatencyMs"),
                }
        if len(verified) < len(injected_flow_ids):
            time.sleep(0.5)

    logger.info(f"Verified {len(verified)} of {len(injected_flow_ids)} injected flows in {time.time() - start_wait:.2f}s.")

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
