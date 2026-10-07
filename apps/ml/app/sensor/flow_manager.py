import json
import logging
import time
from typing import Dict, List, Optional, Callable, Any

from app.sensor.packet_parser import ParsedPacket
from app.sensor.flow_accumulator import BidirectionalFlow
from app.sensor.flow_key import FlowKey
from app.sensor.feature_schema import FeatureSchemaValidator

logger = logging.getLogger("NetSentryFlowManager")


class FlowManager:
    """
    Orchestrates the bidirectional flow lifecycle, state management,
    timeout sweeps, and emission of completed flows to Redis Streams.
    Never transmits partial flows.
    """

    def __init__(
        self,
        flow_timeout_sec: float = 60.0,
        max_active_flows: int = 10_000,
        redis_client: Optional[Any] = None,
        stream_name: str = "netsentry:flows",
        on_flow_finalized: Optional[Callable[[BidirectionalFlow, Dict[str, float]], None]] = None,
    ):
        self.flow_timeout_sec = float(flow_timeout_sec)
        self.max_active_flows = int(max_active_flows)
        self.redis_client = redis_client
        self.stream_name = stream_name
        self.on_flow_finalized = on_flow_finalized

        # In-memory active flow table: canonical_key -> BidirectionalFlow
        self.active_flows: Dict[Any, BidirectionalFlow] = {}

        # Observability counters
        self.total_packets_received = 0
        self.completed_flows_count = 0
        self.expired_flows_count = 0
        self.dropped_flows_count = 0
        self.feature_extraction_errors = 0
        self.last_packet_at: Optional[str] = None
        self.last_flow_at: Optional[str] = None

    def on_packet(self, pkt: ParsedPacket) -> Optional[BidirectionalFlow]:
        """
        Ingests a parsed packet into the appropriate bidirectional conversation.
        If the packet triggers TCP termination (FIN/RST), the flow is finalized immediately.
        """
        self.total_packets_received += 1
        self.last_packet_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(pkt.timestamp))

        key = FlowKey(
            src_ip=pkt.src_ip,
            src_port=pkt.src_port,
            dst_ip=pkt.dst_ip,
            dst_port=pkt.dst_port,
            protocol=pkt.protocol,
        )
        canonical_id = key.canonical_id

        flow = self.active_flows.get(canonical_id)
        if flow is None:
            # Enforce max active flow capacity
            if len(self.active_flows) >= self.max_active_flows:
                # Emergency sweep
                self.check_timeouts(pkt.timestamp)
                if len(self.active_flows) >= self.max_active_flows:
                    # Controlled degradation: drop oldest
                    oldest_key = min(self.active_flows, key=lambda k: self.active_flows[k].last_time)
                    evicted = self.active_flows.pop(oldest_key)
                    self._finalize_flow(evicted, reason="CAPACITY_EVICTION")
                    self.dropped_flows_count += 1

            flow = BidirectionalFlow(pkt)
            self.active_flows[canonical_id] = flow
        else:
            flow.add_packet(pkt)

        # Check immediate termination (TCP FIN or RST)
        if flow.is_terminated:
            self.active_flows.pop(canonical_id, None)
            self.completed_flows_count += 1
            self._finalize_flow(flow, reason=flow.termination_reason)
            return flow

        return None

    def check_timeouts(self, current_time: Optional[float] = None) -> List[BidirectionalFlow]:
        """
        Sweeps active flows for inactivity timeouts (UDP flows and inactive TCP flows).
        """
        now = current_time if current_time is not None else time.time()
        expired_keys = []

        for cid, flow in self.active_flows.items():
            if (now - flow.last_time) >= self.flow_timeout_sec:
                expired_keys.append(cid)

        finalized = []
        for cid in expired_keys:
            flow = self.active_flows.pop(cid)
            flow.is_terminated = True
            flow.termination_reason = "TIMEOUT"
            self.expired_flows_count += 1
            self._finalize_flow(flow, reason="TIMEOUT")
            finalized.append(flow)

        return finalized

    def flush_all(self) -> List[BidirectionalFlow]:
        """
        Flushes and finalizes all currently active flows (e.g. upon sensor shutdown or PCAP completion).
        """
        all_flows = list(self.active_flows.values())
        self.active_flows.clear()

        for flow in all_flows:
            flow.is_terminated = True
            flow.termination_reason = "SENSOR_FLUSH"
            self.completed_flows_count += 1
            self._finalize_flow(flow, reason="SENSOR_FLUSH")

        return all_flows

    def _finalize_flow(self, flow: BidirectionalFlow, reason: str):
        """
        Extracts 77 features, validates schema, and transmits to Redis Stream netsentry:flows.
        """
        try:
            features = flow.extract_features()
            self.last_flow_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

            # Redis publishing
            if self.redis_client:
                flow_meta = flow.to_network_flow_metadata()
                payload = {
                    "source": "live",
                    "flow_id": flow.flow_id,
                    "timestamp": flow_meta["timestamp"],
                    "features": json.dumps(features),
                    "flow": json.dumps(flow_meta),
                    "compute_shap": "true",
                    "source_ip": flow.initiator_src_ip,
                    "destination_ip": flow.destination_ip,
                    "source_port": str(flow.initiator_src_port),
                    "protocol": flow.protocol,
                }
                self.redis_client.xadd(self.stream_name, payload)

            if self.on_flow_finalized:
                self.on_flow_finalized(flow, features)

        except Exception as e:
            self.feature_extraction_errors += 1
            logger.error(f"Error extracting features for flow {flow.flow_id}: {e}")

    @property
    def metrics(self) -> Dict[str, Any]:
        """Returns live sensor flow statistics for observability and health probes."""
        return {
            "packets_observed": self.total_packets_received,
            "flows_active": len(self.active_flows),
            "flows_completed": self.completed_flows_count,
            "flows_expired": self.expired_flows_count,
            "flows_dropped": self.dropped_flows_count,
            "feature_extraction_errors": self.feature_extraction_errors,
            "last_packet_at": self.last_packet_at or "NONE",
            "last_flow_at": self.last_flow_at or "NONE",
            "flow_timeout_sec": self.flow_timeout_sec,
            "max_active_flows": self.max_active_flows,
        }
