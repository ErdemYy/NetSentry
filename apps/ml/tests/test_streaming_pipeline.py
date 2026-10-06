import json
import time
import uuid
import pytest
import redis

from app.streaming.config import STREAMING_CONFIG
from app.streaming.worker import MLStreamWorker
from app.streaming.replay import FlowReplayEngine
from app.inference.model_loader import ModelArtifactLoader


@pytest.fixture(scope="module")
def redis_client():
    r = redis.Redis(
        host=STREAMING_CONFIG.redis_host,
        port=STREAMING_CONFIG.redis_port,
        password=STREAMING_CONFIG.redis_password or None,
        db=STREAMING_CONFIG.redis_db,
        decode_responses=True,
    )
    try:
        r.ping()
        return r
    except redis.ConnectionError:
        pytest.skip("Redis server is not reachable on configured port")


@pytest.fixture(scope="module")
def worker(redis_client):
    w = MLStreamWorker(worker_id="test-worker-pytest")
    w.setup_stream_group()
    return w


@pytest.fixture(scope="module")
def sample_features():
    loader = ModelArtifactLoader.get_instance()
    return {col: 1.0 for col in loader.feature_names}


def test_redis_connection(redis_client):
    assert redis_client.ping() is True


def test_worker_process_valid_flow(worker, redis_client, sample_features):
    flow_id = f"test-flow-{uuid.uuid4().hex[:8]}"
    msg_payload = {
        "flow_id": flow_id,
        "features": json.dumps(sample_features),
        "compute_shap": "false",  # Fast path for unit test
    }

    # Add directly to stream
    msg_id = redis_client.xadd(STREAMING_CONFIG.stream_flows, msg_payload)

    # Process message directly
    success = worker.process_message(msg_id, msg_payload)
    assert success is True

    # Verify detection was produced in output stream
    detections = redis_client.xrevrange(STREAMING_CONFIG.stream_detections, count=5)
    assert len(detections) > 0
    found = False
    for det_id, det_fields in detections:
        if det_fields.get("flow_id") == flow_id:
            payload = json.loads(det_fields["payload"])
            assert payload["flowId"] == flow_id
            assert "verdict" in payload
            assert "attackCategory" in payload
            found = True
            break
    assert found, "Processed detection must be published in netsentry:detections"


def test_worker_retry_and_dlq(worker, redis_client):
    flow_id = f"malformed-flow-{uuid.uuid4().hex[:8]}"
    bad_payload = {
        "flow_id": flow_id,
        "features": json.dumps({"incomplete_feature": 1.0}),  # Missing 76 features
    }
    msg_id = redis_client.xadd(STREAMING_CONFIG.stream_flows, bad_payload)

    # Attempt 1 -> Failure
    assert worker.process_message(msg_id, bad_payload) is False
    assert worker.retry_counts.get(msg_id) == 1

    # Attempt 2 -> Failure
    assert worker.process_message(msg_id, bad_payload) is False
    assert worker.retry_counts.get(msg_id) == 2

    # Attempt 3 -> Reaches max_retries (3) -> Transferred to DLQ
    assert worker.process_message(msg_id, bad_payload) is False
    assert msg_id not in worker.retry_counts

    # Verify DLQ received the failed flow
    dlq_messages = redis_client.xrevrange(STREAMING_CONFIG.stream_dlq, count=5)
    assert len(dlq_messages) > 0
    assert any(m[1].get("original_id") == msg_id for m in dlq_messages)


def test_replay_engine_modes_and_integrity():
    replay = FlowReplayEngine()
    replay.load_dataset()

    # Mode 1: NORMAL
    normal_samples = replay.select_samples(mode="NORMAL", count=10)
    assert len(normal_samples) == 10
    assert (normal_samples["label"] == "BENIGN").all()
    assert "label" not in replay._synthesize_network_flow(normal_samples.iloc[0], "f1", "ts")

    # Mode 2: ATTACK
    attack_samples = replay.select_samples(mode="ATTACK", count=10)
    assert len(attack_samples) == 10
    assert (attack_samples["label"] != "BENIGN").all()

    # Mode 3: MIXED
    mixed_samples = replay.select_samples(mode="MIXED", count=20)
    assert len(mixed_samples) == 20
