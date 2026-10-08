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
        self._last_autoclaim_id = "0-0"

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

    def _get_retry_key(self, message_id: str) -> str:
        """Durable Redis key tracking failure attempt count across worker crashes/restarts."""
        return f"netsentry:retry:{self.config.stream_flows}:{message_id}"

    def _get_retry_count(self, message_id: str) -> int:
        val = self.redis_client.get(self._get_retry_key(message_id))
        return int(val) if val else 0

    def _incr_retry_count(self, message_id: str) -> int:
        key = self._get_retry_key(message_id)
        count = self.redis_client.incr(key)
        self.redis_client.expire(key, 86400)  # 24-hour TTL for durable failure state
        return count

    def _clear_retry_count(self, message_id: str):
        self.redis_client.delete(self._get_retry_key(message_id))

    @property
    def retry_counts(self):
        worker_self = self

        class _DurableRetryDict(dict):
            def get(self, key, default=None):
                cnt = worker_self._get_retry_count(key)
                return cnt if cnt > 0 else default

            def __contains__(self, key):
                return worker_self._get_retry_count(key) > 0

            def __getitem__(self, key):
                cnt = worker_self._get_retry_count(key)
                if cnt == 0:
                    raise KeyError(key)
                return cnt

        return _DurableRetryDict()

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

            # Strict ground-truth isolation: never derive source or verdict from training labels
            source_type = fields.get("source", "replay")
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

            flow_data["source"] = source_type
            detection_result["source"] = source_type

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
            self._clear_retry_count(message_id)
            self.processed_count += 1
            return True

        except Exception as e:
            self.error_count += 1
            retries = self._incr_retry_count(message_id)
            logger.error(f"Error processing message {message_id} (Attempt {retries}/{self.config.max_retries}): {e}")

            if retries >= self.config.max_retries:
                logger.warning(f"Message {message_id} exceeded max retries ({self.config.max_retries}). Forwarding to DLQ.")
                self.redis_client.xadd(
                    self.config.stream_dlq,
                    {
                        "original_id": message_id,
                        "fields": json.dumps(fields) if isinstance(fields, dict) else str(fields),
                        "error": str(e),
                        "attempt_count": retries,
                        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    },
                )
                self.redis_client.xack(self.config.stream_flows, self.config.consumer_group, message_id)
                self._clear_retry_count(message_id)

            return False

    def claim_orphaned_messages(self, count: int = 10) -> int:
        """
        Recovers and processes pending messages orphaned by crashed or abruptly terminated workers.
        Uses XAUTOCLAIM based on the configured claim_idle_ms.
        """
        try:
            res = self.redis_client.xautoclaim(
                name=self.config.stream_flows,
                groupname=self.config.consumer_group,
                consumername=self.worker_id,
                min_idle_time=self.config.claim_idle_ms,
                start_id=self._last_autoclaim_id,
                count=count,
            )
            if not res or len(res) < 2:
                return 0

            next_id = res[0]
            messages = res[1]
            self._last_autoclaim_id = next_id if next_id and next_id != "0-0" else "0-0"

            recovered = 0
            for msg in messages:
                if not msg or not isinstance(msg, (list, tuple)) or len(msg) < 2:
                    continue
                message_id, fields = msg[0], msg[1]
                logger.info(f"Worker '{self.worker_id}' recovered orphaned pending message {message_id} via XAUTOCLAIM")
                if self.process_message(message_id, fields):
                    recovered += 1

            return recovered
        except Exception as e:
            logger.debug(f"XAUTOCLAIM idle inspection: {e}")
            return 0

    def process_batch(self, count: int = 10, block_ms: int = 1000) -> int:
        # 1. First recover any orphaned messages abandoned by crashed workers
        recovered_count = self.claim_orphaned_messages(count=count)

        # 2. Ingest new stream messages
        response = self.redis_client.xreadgroup(
            groupname=self.config.consumer_group,
            consumername=self.worker_id,
            streams={self.config.stream_flows: ">"},
            count=count,
            block=block_ms,
        )

        if not response:
            return recovered_count

        new_processed = 0
        for stream_name, messages in response:
            for message_id, fields in messages:
                if self.process_message(message_id, fields):
                    new_processed += 1

        return recovered_count + new_processed

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
