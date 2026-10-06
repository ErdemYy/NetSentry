import os
from pydantic import BaseModel


class StreamingConfig(BaseModel):
    redis_host: str = os.getenv("REDIS_HOST", "localhost")
    redis_port: int = int(os.getenv("REDIS_PORT", "6380"))
    redis_password: str = os.getenv("REDIS_PASSWORD", "")
    redis_db: int = int(os.getenv("REDIS_DB", "0"))

    # Canonical Stream Keys
    stream_flows: str = "netsentry:flows"
    stream_detections: str = "netsentry:detections"
    stream_dlq: str = "netsentry:flows:dlq"
    pubsub_detections: str = "netsentry:detections:pubsub"

    # Consumer Group Configurations
    consumer_group: str = "ml-inference"
    consumer_name_prefix: str = "ml-worker"
    batch_size: int = 20
    block_timeout_ms: int = 1000
    max_retries: int = 3


STREAMING_CONFIG = StreamingConfig()
