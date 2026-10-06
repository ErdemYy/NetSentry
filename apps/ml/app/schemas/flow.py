from typing import List, Literal, Optional
from pydantic import BaseModel, Field


class NetworkFlowSchema(BaseModel):
    id: str = Field(..., description="Unique flow identifier")
    timestamp: str = Field(..., description="ISO 8601 timestamp")
    source_ip: str = Field(..., description="Source IPv4/IPv6 address")
    destination_ip: str = Field(..., description="Destination IPv4/IPv6 address")
    source_port: int = Field(..., ge=0, le=65535)
    destination_port: int = Field(..., ge=0, le=65535)
    protocol: Literal["TCP", "UDP", "ICMP", "OTHER"]
    duration_ms: float = Field(..., ge=0.0)
    total_fwd_packets: int = Field(..., ge=0)
    total_bwd_packets: int = Field(..., ge=0)
    total_fwd_bytes: float = Field(..., ge=0.0)
    total_bwd_bytes: float = Field(..., ge=0.0)
    fwd_packet_length_mean: float = Field(..., ge=0.0)
    bwd_packet_length_mean: float = Field(..., ge=0.0)
    flow_bytes_per_sec: float = Field(..., ge=0.0)
    flow_packets_per_sec: float = Field(..., ge=0.0)
    syn_flag_count: int = Field(default=0, ge=0)
    fin_flag_count: int = Field(default=0, ge=0)
    rst_flag_count: int = Field(default=0, ge=0)
    psh_flag_count: int = Field(default=0, ge=0)
    ack_flag_count: int = Field(default=0, ge=0)


class ShapFeatureContributionSchema(BaseModel):
    feature: str
    value: float
    contribution: float
    description: str
    direction: Optional[Literal["increases_risk", "decreases_risk"]] = None


class DetectionResponseSchema(BaseModel):
    id: str
    flow_id: str = Field(..., alias="flowId")
    timestamp: str
    verdict: Literal["NORMAL", "KNOWN_ATTACK", "ANOMALOUS", "HIGH_RISK", "UNKNOWN_ANOMALOUS"]
    attack_category: Literal[
        "BENIGN",
        "DOS",
        "DDOS",
        "PORT_SCAN",
        "BRUTE_FORCE",
        "WEB_ATTACK",
        "BOTNET",
        "INFILTRATION",
        "HEARTBLEED",
        "UNKNOWN_ANOMALY",
    ] = Field(..., alias="attackCategory")
    supervised_confidence: float = Field(..., ge=0.0, le=1.0, alias="supervisedConfidence")
    unsupervised_anomaly_score: float = Field(..., ge=0.0, le=1.0, alias="unsupervisedAnomalyScore")
    anomaly_threshold: float = Field(..., alias="anomalyThreshold")
    is_anomalous: bool = Field(..., alias="isAnomalous")
    severity: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    top_features: List[ShapFeatureContributionSchema] = Field(default=[], alias="topFeatures")
    explanation: str
    model_version_supervised: str = Field(..., alias="modelVersionSupervised")
    model_version_unsupervised: str = Field(..., alias="modelVersionUnsupervised")
    inference_latency_ms: Optional[float] = Field(default=None, alias="inferenceLatencyMs")
    class_probabilities: Optional[dict] = Field(default=None, alias="classProbabilities")

    class Config:
        populate_by_name = True

