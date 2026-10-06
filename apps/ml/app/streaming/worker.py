import json
import logging
import os
import signal
import sys
import time
from typing import Optional
import redis

from app.streaming.config import STREAMING_CONFIG
from app.inference.service import InferenceService

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("NetSentryMLWorker")


class MLStreamWorker:
    def __init__(self, config=STREAMING_CONFIG, worker_id: Optional[str] = None):
        self.config = config
        self.worker_id = worker_id or f"{self.config.consumer_name_prefix}-{os.getpid()}"
        self.redis_client = redis.Redis(
            host=self.config.redis_host,
            port=self.config.redis_port,
            password=self.config.redis_password or None,
            db=self.config.redis_db,
            decode_responses=True,
        )
        self.inference_service = InferenceService()
        self.is_running = False
        self.processed_count = 0
        self.error_count = 0
        self.retry_counts = {}

    def setup_stream_group(self):
        try:
            self.redis_client.xgroup_create(
                name=self.config.stream_flows,
                groupname=self.config.consumer_group,
                id="0",
                mkstream=True,
            )
            logger.info(f"Created consumer group '{self.config.consumer_group}' on stream '{self.config.stream_flows}'.")
        except redis.exceptions.ResponseError as e:
            if "BUSYGROUP" in str(e):
                logger.info(f"Consumer group '{self.config.consumer_group}' already exists.")
            else:
                raise e

    def process_message(self, message_id: str, fields: dict) -> bool:
        try:
            flow_id = fields.get("flow_id", f"unknown-{message_id}")
            raw_features = fields.get("features")
            if isinstance(raw_features, str):
                features = json.loads(raw_features)
            elif isinstance(raw_features, dict):
                features = raw_features
            else:
                raise ValueError(f"Malformed features field in message {message_id}")

            compute_shap = fields.get("compute_shap", "true").lower() in ("true", "1", "yes")

            # Run deterministic ML Inference
            detection_result = self.inference_service.predict(
                flow_id=flow_id,
                features=features,
                compute_shap=compute_shap,
            )

            # Parse or synthesize flow network metadata for downstream Core API persistence
            raw_flow = fields.get("flow")
            if raw_flow:
                flow_data = json.loads(raw_flow) if isinstance(raw_flow, str) else raw_flow
            else:
                flow_data = {
                    "id": flow_id,
                    "timestamp": detection_result["timestamp"],
                    "sourceIp": fields.get("source_ip", "192.168.10.15"),
                    "destinationIp": fields.get("destination_ip", "192.168.10.50"),
                    "sourcePort": int(fields.get("source_port", 49152)),
                    "destinationPort": int(features.get("destination_port", 80)),
                    "protocol": fields.get("protocol", "TCP"),
                    "durationMs": float(features.get("flow_duration", 0)) / 1000.0,
                    "totalFwdPackets": int(features.get("total_fwd_packets", 1)),
                    "totalBwdPackets": int(features.get("total_bwd_packets", 0)),
                    "totalFwdBytes": float(features.get("total_fwd_bytes", 0.0)),
                    "totalBwdBytes": float(features.get("total_bwd_bytes", 0.0)),
                    "fwdPacketLengthMean": float(features.get("fwd_packet_length_mean", 0.0)),
                    "bwdPacketLengthMean": float(features.get("bwd_packet_length_mean", 0.0)),
                    "flowBytesPerSec": float(features.get("flow_bytes_per_sec", 0.0)),
                    "flowPacketsPerSec": float(features.get("flow_packets_per_sec", 0.0)),
                    "synFlagCount": int(features.get("syn_flag_count", 0)),
                    "finFlagCount": int(features.get("fin_flag_count", 0)),
                    "rstFlagCount": int(features.get("rst_flag_count", 0)),
                    "pshFlagCount": int(features.get("psh_flag_count", 0)),
                    "ackFlagCount": int(features.get("ack_flag_count", 0)),
                }

            event_payload = {
                "eventId": f"evt-{detection_result['id'][4:]}",
                "timestamp": detection_result["timestamp"],
                "flow": flow_data,
                "detection": detection_result,
            }

            # Publish DetectionResult and full ThreatFeedEvent to output stream
            payload_json = json.dumps(detection_result)
            event_json = json.dumps(event_payload)
            flow_json = json.dumps(flow_data)

            self.redis_client.xadd(
                self.config.stream_detections,
                {
                    "payload": payload_json,
                    "flow": flow_json,
                    "event": event_json,
                    "flow_id": flow_id,
                    "id": detection_result["id"],
                },
            )

            # Publish to Pub/Sub for immediate WebSocket broadcast
            self.redis_client.publish(self.config.pubsub_detections, event_json)

            # Acknowledge successfully processed flow
            self.redis_client.xack(self.config.stream_flows, self.config.consumer_group, message_id)
            self.processed_count += 1

            if message_id in self.retry_counts:
                del self.retry_counts[message_id]

            return True

        except Exception as e:
            self.error_count += 1
            retries = self.retry_counts.get(message_id, 0) + 1
            self.retry_counts[message_id] = retries
            logger.error(f"Error processing message {message_id} (Attempt {retries}): {e}")

            if retries >= self.config.max_retries:
                logger.warning(f"Message {message_id} exceeded max retries ({self.config.max_retries}). Forwarding to DLQ.")
                self.redis_client.xadd(
                    self.config.stream_dlq,
                    {
                        "original_id": message_id,
                        "fields": json.dumps(fields),
                        "error": str(e),
                        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    },
                )
                self.redis_client.xack(self.config.stream_flows, self.config.consumer_group, message_id)
                del self.retry_counts[message_id]

            return False

    def process_batch(self, count: int = 10, block_ms: int = 1000) -> int:
        response = self.redis_client.xreadgroup(
            groupname=self.config.consumer_group,
            consumername=self.worker_id,
            streams={self.config.stream_flows: ">"},
            count=count,
            block=block_ms,
        )

        if not response:
            return 0

        total_processed = 0
        for stream_name, messages in response:
            for message_id, fields in messages:
                if self.process_message(message_id, fields):
                    total_processed += 1

        return total_processed

    def run(self, max_messages: Optional[int] = None):
        self.setup_stream_group()
        self.is_running = True
        logger.info(f"Worker '{self.worker_id}' listening on stream '{self.config.stream_flows}'...")

        processed_total = 0
        while self.is_running:
            n = self.process_batch(count=self.config.batch_size, block_ms=self.config.block_timeout_ms)
            processed_total += n
            if max_messages and processed_total >= max_messages:
                logger.info(f"Reached max_messages target ({max_messages}). Stopping worker.")
                break

    def stop(self):
        self.is_running = False
        logger.info(f"Worker '{self.worker_id}' stopping gracefully.")


if __name__ == "__main__":
    worker = MLStreamWorker()

    def handle_sig(sig, frame):
        worker.stop()
        sys.exit(0)

    signal.signal(signal.SIGINT, handle_sig)
    signal.signal(signal.SIGTERM, handle_sig)
    worker.run()
