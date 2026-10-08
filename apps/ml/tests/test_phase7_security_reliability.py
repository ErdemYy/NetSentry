import json
import os
import tempfile
import time
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.sensor.sandbox import resolve_and_validate_pcap_path, get_pcap_root
from app.streaming.config import STREAMING_CONFIG
from app.streaming.replay import FlowReplayEngine
from app.streaming.worker import MLStreamWorker

client = TestClient(app)


class TestFastAPISecurityBoundary:
    """Verifies that FastAPI sensor and administrative endpoints cannot be accessed directly without internal service authentication."""

    def test_sensor_endpoints_blocked_without_service_token(self, monkeypatch):
        # Force authentication on
        monkeypatch.setenv("ML_INTERNAL_AUTH_ENABLED", "true")
        monkeypatch.setenv("INTERNAL_SERVICE_TOKEN", "super-secret-cluster-token")

        # 1. /sensor/start
        res = client.post("/api/v1/sensor/start", json={"filter": "ip"})
        assert res.status_code == 401
        assert "internal service token" in res.json().get("detail", "").lower()

        # 2. /sensor/stop
        res = client.post("/api/v1/sensor/stop")
        assert res.status_code == 401

        # 3. /sensor/process-pcap
        res = client.post("/api/v1/sensor/process-pcap", json={"filename": "test.pcap"})
        assert res.status_code == 401

        # 4. /sensor/status
        res = client.get("/api/v1/sensor/status")
        assert res.status_code == 401

        # 5. /sensor/interfaces
        res = client.get("/api/v1/sensor/interfaces")
        assert res.status_code == 401

    def test_sensor_endpoints_blocked_with_invalid_token(self, monkeypatch):
        monkeypatch.setenv("ML_INTERNAL_AUTH_ENABLED", "true")
        monkeypatch.setenv("INTERNAL_SERVICE_TOKEN", "valid-cluster-token-xyz")

        headers = {"Authorization": "Bearer wrong-token-123"}
        res = client.post("/api/v1/sensor/start", json={}, headers=headers)
        assert res.status_code == 401

    def test_sensor_endpoints_succeed_with_valid_bearer_token(self, monkeypatch):
        monkeypatch.setenv("ML_INTERNAL_AUTH_ENABLED", "true")
        monkeypatch.setenv("INTERNAL_SERVICE_TOKEN", "valid-cluster-token-xyz")

        headers = {"Authorization": "Bearer valid-cluster-token-xyz"}
        # /sensor/status should now return 200 OK
        res = client.get("/api/v1/sensor/status", headers=headers)
        assert res.status_code == 200
        assert "capture_state" in res.json()

        # /sensor/interfaces should return 200 OK
        res = client.get("/api/v1/sensor/interfaces", headers=headers)
        assert res.status_code == 200
        assert "interfaces" in res.json()

    def test_public_health_remains_accessible_without_token(self, monkeypatch):
        monkeypatch.setenv("ML_INTERNAL_AUTH_ENABLED", "true")
        monkeypatch.setenv("INTERNAL_SERVICE_TOKEN", "valid-cluster-token-xyz")

        # /health must remain open for Docker and Kubernetes probes
        res = client.get("/health")
        assert res.status_code == 200
        assert res.json().get("service") == "NetSentry ML Inference Engine"


class TestPcapSandboxing:
    """Verifies strict filesystem path sandboxing and traversal mitigation."""

    def test_valid_pcap_in_sandbox(self):
        sandbox = get_pcap_root()
        test_file = sandbox / "valid_sample.pcap"
        test_file.write_bytes(b"DUMMY_PCAP_DATA")
        try:
            resolved = resolve_and_validate_pcap_path("valid_sample.pcap", pcap_root=sandbox)
            assert resolved.exists()
            assert resolved.name == "valid_sample.pcap"
        finally:
            if test_file.exists():
                test_file.unlink()

    def test_path_traversal_double_dot_rejected(self):
        sandbox = get_pcap_root()
        with pytest.raises(ValueError, match="strictly prohibited|outside the configured PCAP sandbox"):
            resolve_and_validate_pcap_path("../secret.txt", pcap_root=sandbox)

        with pytest.raises(ValueError, match="strictly prohibited|outside the configured PCAP sandbox"):
            resolve_and_validate_pcap_path("sub/../../.env", pcap_root=sandbox)

    def test_absolute_path_escape_rejected(self):
        sandbox = get_pcap_root()
        with pytest.raises(ValueError, match="outside the configured PCAP sandbox"):
            resolve_and_validate_pcap_path("C:\\Windows\\System32\\drivers\\etc\\hosts", pcap_root=sandbox)

    def test_unsupported_extensions_rejected(self):
        sandbox = get_pcap_root()
        test_file = sandbox / "payload.txt"
        test_file.write_bytes(b"HELLO")
        try:
            with pytest.raises(ValueError, match="Unsupported file extension"):
                resolve_and_validate_pcap_path("payload.txt", pcap_root=sandbox)
        finally:
            if test_file.exists():
                test_file.unlink()

    def test_directory_as_pcap_rejected(self):
        sandbox = get_pcap_root()
        test_dir = sandbox / "nested_dir.pcap"
        test_dir.mkdir(exist_ok=True)
        try:
            with pytest.raises(ValueError, match="directory"):
                resolve_and_validate_pcap_path("nested_dir.pcap", pcap_root=sandbox)
        finally:
            if test_dir.exists():
                test_dir.rmdir()


class TestGroundTruthIsolation:
    """Ensures ground truth labels are strictly isolated from the inference stream."""

    def test_replay_message_excludes_ground_truth_label(self):
        import redis
        try:
            r = redis.Redis(
                host=STREAMING_CONFIG.redis_host,
                port=STREAMING_CONFIG.redis_port,
                db=STREAMING_CONFIG.redis_db,
                decode_responses=True,
                socket_timeout=2.0,
            )
            r.ping()
        except Exception:
            pytest.skip("Redis server not available at localhost:6380")

        replay = FlowReplayEngine()
        replay.load_dataset()

        # Replay a single flow
        stats = replay.replay(mode="ATTACK", attack_category="DDoS", flows_per_second=10, max_events=1)
        assert stats["published_events"] == 1

        # Read the latest flow from netsentry:flows
        entries = r.xrevrange(STREAMING_CONFIG.stream_flows, count=1)
        assert len(entries) > 0
        msg_id, fields = entries[0]

        # Critical Academic Integrity Assertion: ground_truth_label MUST NOT be present
        assert "ground_truth_label" not in fields, "Academic risk: ground_truth_label leaked into model inference stream!"
        assert "features" in fields
        assert fields.get("source") == "replay"

        # Check local evaluation map retained correlation
        assert len(replay.evaluation_map) >= 1
        flow_id = fields.get("flow_id")
        assert flow_id in replay.evaluation_map
        assert replay.evaluation_map[flow_id] == "DDoS"


class TestRedisCrashRecovery:
    """Verifies XAUTOCLAIM-based pending message recovery and durable retry tracking."""

    def test_crashed_worker_pending_recovery_via_xautoclaim(self):
        import redis
        try:
            r = redis.Redis(
                host=STREAMING_CONFIG.redis_host,
                port=STREAMING_CONFIG.redis_port,
                db=STREAMING_CONFIG.redis_db,
                decode_responses=True,
                socket_timeout=2.0,
            )
            r.ping()
        except Exception:
            pytest.skip("Redis server not available at localhost:6380")

        # 1. Setup consumer group
        group = "test-recovery-group"
        stream = "netsentry:test:flows"
        try:
            r.xgroup_create(stream, group, id="0", mkstream=True)
        except Exception:
            pass

        # Clean stream
        r.delete(stream)
        r.xgroup_create(stream, group, id="0", mkstream=True)

        # 2. Publish a synthetic valid message
        replay = FlowReplayEngine()
        replay.load_dataset()
        sample = replay.df.iloc[0]
        feature_cols = [c for c in replay.df.columns if c != "label"]
        features_dict = {col: float(sample[col]) for col in feature_cols}

        msg_payload = {
            "flow_id": "test-crash-flow-001",
            "timestamp": "2026-10-08T12:00:00Z",
            "features": json.dumps(features_dict),
            "source": "replay",
            "compute_shap": "false",
        }
        msg_id = r.xadd(stream, msg_payload)

        # 3. Worker A reads message from group but intentionally CRASHES without XACK
        worker_a = "worker-a-crashed"
        entries = r.xreadgroup(group, worker_a, {stream: ">"}, count=1)
        assert len(entries) > 0
        claimed_id, _ = entries[0][1][0]
        assert claimed_id == msg_id

        # Message is now in PENDING state under worker_a
        pending_info = r.xpending(stream, group)
        assert pending_info["pending"] >= 1

        # 4. Worker B starts with zero claim idle time to immediately reclaim orphaned messages
        from app.streaming.config import StreamingConfig
        cfg = StreamingConfig(
            stream_flows=stream,
            consumer_group=group,
            consumer_name_prefix="worker-b",
            claim_idle_ms=0,  # Immediate autoclaim
        )
        worker_b = MLStreamWorker(config=cfg, worker_id="worker-b-recovery")

        # Worker B runs batch: claims and processes the pending message
        recovered = worker_b.process_batch(count=10, block_ms=500)
        assert recovered >= 1

        # 5. Pending list must now be empty (acknowledged by Worker B)
        pending_after = r.xpending(stream, group)
        assert pending_after["pending"] == 0

        # Clean up
        r.delete(stream)

    def test_failing_message_retries_and_dlq(self):
        import redis
        try:
            r = redis.Redis(
                host=STREAMING_CONFIG.redis_host,
                port=STREAMING_CONFIG.redis_port,
                db=STREAMING_CONFIG.redis_db,
                decode_responses=True,
                socket_timeout=2.0,
            )
            r.ping()
        except Exception:
            pytest.skip("Redis server not available at localhost:6380")

        stream = "netsentry:test:fail_stream"
        group = "test-fail-group"
        dlq_stream = "netsentry:test:dlq_stream"

        r.delete(stream, dlq_stream)
        r.xgroup_create(stream, group, id="0", mkstream=True)

        from app.streaming.config import StreamingConfig
        cfg = StreamingConfig(
            stream_flows=stream,
            stream_dlq=dlq_stream,
            consumer_group=group,
            max_retries=3,
        )
        worker = MLStreamWorker(config=cfg, worker_id="worker-fail-test")

        # Publish a malformed message that triggers an exception in inference
        bad_msg_id = r.xadd(stream, {"flow_id": "bad-flow", "features": "NOT_JSON_OR_INVALID"})

        # Process attempt 1
        res1 = worker.process_message(bad_msg_id, {"flow_id": "bad-flow", "features": "NOT_JSON_OR_INVALID"})
        assert res1 is False
        assert worker._get_retry_count(bad_msg_id) == 1

        # Process attempt 2
        res2 = worker.process_message(bad_msg_id, {"flow_id": "bad-flow", "features": "NOT_JSON_OR_INVALID"})
        assert res2 is False
        assert worker._get_retry_count(bad_msg_id) == 2

        # Process attempt 3 -> should route to DLQ, XACK from original stream, and clear retry count
        res3 = worker.process_message(bad_msg_id, {"flow_id": "bad-flow", "features": "NOT_JSON_OR_INVALID"})
        assert res3 is False
        assert worker._get_retry_count(bad_msg_id) == 0  # Cleared after DLQ

        # Verify DLQ received the event
        dlq_entries = r.xrange(dlq_stream)
        assert len(dlq_entries) == 1
        _, dlq_fields = dlq_entries[0]
        assert dlq_fields["original_id"] == bad_msg_id
        assert dlq_fields["attempt_count"] == "3"

        # Clean up
        r.delete(stream, dlq_stream)
