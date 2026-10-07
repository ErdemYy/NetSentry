import math
import time
from typing import Dict, List, Optional, Any, Tuple
import numpy as np

from app.sensor.flow_key import FlowKey, FlowDirection
from app.sensor.packet_parser import ParsedPacket
from app.sensor.feature_schema import CANONICAL_77_FEATURES, FeatureSchemaValidator


class BidirectionalFlow:
    """
    Accumulates bidirectional packet sequence statistics and computes the exact
    canonical 77-feature vector conforming to feature-schema-v1.
    """

    IDLE_THRESHOLD_US = 5_000_000.0  # 5 seconds in microseconds (CICFlowMeter specification)

    def __init__(self, initial_packet: ParsedPacket):
        self.flow_id = f"live-flow-{int(initial_packet.timestamp * 1000)}-{initial_packet.src_port}-{initial_packet.dst_port}"
        self.flow_key = FlowKey(
            src_ip=initial_packet.src_ip,
            src_port=initial_packet.src_port,
            dst_ip=initial_packet.dst_ip,
            dst_port=initial_packet.dst_port,
            protocol=initial_packet.protocol,
        )

        # The initial packet establishes the forward direction
        self.initiator_src_ip = initial_packet.src_ip
        self.initiator_src_port = initial_packet.src_port
        self.destination_ip = initial_packet.dst_ip
        self.destination_port = initial_packet.dst_port
        self.protocol = initial_packet.protocol

        # Timestamps
        self.start_time = initial_packet.timestamp
        self.last_time = initial_packet.timestamp

        # Packet length histories
        self.fwd_pkt_lengths: List[int] = []
        self.bwd_pkt_lengths: List[int] = []
        self.all_pkt_lengths: List[int] = []

        # Inter-arrival times (in microseconds)
        self.flow_iats: List[float] = []
        self.fwd_iats: List[float] = []
        self.bwd_iats: List[float] = []
        self.last_fwd_time: Optional[float] = None
        self.last_bwd_time: Optional[float] = None

        # Headers and payload
        self.fwd_header_bytes = 0
        self.bwd_header_bytes = 0
        self.fwd_act_data_pkts = 0
        self.min_seg_size_fwd = 32  # default TCP segment size, updated with min observed

        # TCP Window
        self.init_win_bytes_fwd = 0
        self.init_win_bytes_bwd = 0
        self.has_set_init_win_fwd = False
        self.has_set_init_win_bwd = False

        # Flags
        self.fin_count = 0
        self.syn_count = 0
        self.rst_count = 0
        self.psh_count = 0
        self.ack_count = 0
        self.urg_count = 0
        self.cwe_count = 0
        self.ece_count = 0

        self.fwd_psh_flags = 0
        self.bwd_psh_flags = 0
        self.fwd_urg_flags = 0
        self.bwd_urg_flags = 0

        # Active / Idle tracker
        self.active_times: List[float] = []
        self.idle_times: List[float] = []
        self.current_active_start = initial_packet.timestamp

        # Status
        self.is_terminated = False
        self.termination_reason = "ACTIVE"

        # Add initial packet
        self.add_packet(initial_packet)

    def add_packet(self, pkt: ParsedPacket):
        """Processes an incoming packet into the bidirectional accumulator."""
        is_forward = (pkt.src_ip == self.initiator_src_ip and pkt.src_port == self.initiator_src_port)
        direction = FlowDirection.FORWARD if is_forward else FlowDirection.BACKWARD
        pkt_time = pkt.timestamp
        wire_len = pkt.wire_length

        # Update flow IAT
        if len(self.all_pkt_lengths) > 0:
            iat_us = max(0.0, (pkt_time - self.last_time) * 1_000_000.0)
            self.flow_iats.append(iat_us)

            # Check Active/Idle intervals
            if iat_us > self.IDLE_THRESHOLD_US:
                idle_us = iat_us
                self.idle_times.append(idle_us)
                active_us = max(0.0, (self.last_time - self.current_active_start) * 1_000_000.0)
                if active_us > 0:
                    self.active_times.append(active_us)
                self.current_active_start = pkt_time

        self.last_time = pkt_time
        self.all_pkt_lengths.append(wire_len)

        # Flag counts
        flags = pkt.tcp_flags
        self.fin_count += flags.get("FIN", 0)
        self.syn_count += flags.get("SYN", 0)
        self.rst_count += flags.get("RST", 0)
        self.psh_count += flags.get("PSH", 0)
        self.ack_count += flags.get("ACK", 0)
        self.urg_count += flags.get("URG", 0)
        self.cwe_count += flags.get("CWR", 0)
        self.ece_count += flags.get("ECE", 0)

        # Direction-specific updates
        if direction == FlowDirection.FORWARD:
            self.fwd_pkt_lengths.append(wire_len)
            self.fwd_header_bytes += pkt.header_length

            if self.last_fwd_time is not None:
                self.fwd_iats.append(max(0.0, (pkt_time - self.last_fwd_time) * 1_000_000.0))
            self.last_fwd_time = pkt_time

            if flags.get("PSH", 0):
                self.fwd_psh_flags += 1
            if flags.get("URG", 0):
                self.fwd_urg_flags += 1

            if not self.has_set_init_win_fwd:
                self.init_win_bytes_fwd = pkt.tcp_window
                self.has_set_init_win_fwd = True

            if pkt.payload_length > 0:
                self.fwd_act_data_pkts += 1

            if pkt.transport_header_length > 0:
                self.min_seg_size_fwd = min(self.min_seg_size_fwd, pkt.transport_header_length)

        else:  # BACKWARD
            self.bwd_pkt_lengths.append(wire_len)
            self.bwd_header_bytes += pkt.header_length

            if self.last_bwd_time is not None:
                self.bwd_iats.append(max(0.0, (pkt_time - self.last_bwd_time) * 1_000_000.0))
            self.last_bwd_time = pkt_time

            if flags.get("PSH", 0):
                self.bwd_psh_flags += 1
            if flags.get("URG", 0):
                self.bwd_urg_flags += 1

            if not self.has_set_init_win_bwd:
                self.init_win_bytes_bwd = pkt.tcp_window
                self.has_set_init_win_bwd = True

        # Check TCP Termination (RST immediately, or completed FIN handshake when fin_count >= 2)
        if flags.get("RST", 0):
            self.is_terminated = True
            self.termination_reason = "TCP_RST"
        elif self.fin_count >= 2:
            self.is_terminated = True
            self.termination_reason = "TCP_FIN"

    @property
    def duration_microseconds(self) -> float:
        return max(0.0, (self.last_time - self.start_time) * 1_000_000.0)

    @property
    def duration_seconds(self) -> float:
        return self.duration_microseconds / 1_000_000.0

    @staticmethod
    def _stats(arr: List[float or int]) -> Tuple[float, float, float, float]:
        """Returns (min, max, mean, std) with safe zero-handling."""
        if not arr:
            return 0.0, 0.0, 0.0, 0.0
        np_arr = np.array(arr, dtype=np.float64)
        min_val = float(np.min(np_arr))
        max_val = float(np.max(np_arr))
        mean_val = float(np.mean(np_arr))
        std_val = float(np.std(np_arr)) if len(arr) > 1 else 0.0
        return min_val, max_val, mean_val, std_val

    def extract_features(self) -> Dict[str, float]:
        """
        Calculates all 77 features strictly adhering to feature-schema-v1.
        """
        dur_us = self.duration_microseconds
        dur_sec = dur_us / 1_000_000.0

        total_fwd_pkts = len(self.fwd_pkt_lengths)
        total_bwd_pkts = len(self.bwd_pkt_lengths)
        total_fwd_bytes = sum(self.fwd_pkt_lengths)
        total_bwd_bytes = sum(self.bwd_pkt_lengths)
        total_pkts = total_fwd_pkts + total_bwd_pkts
        total_bytes = total_fwd_bytes + total_bwd_bytes

        # Packet length statistics
        fwd_min, fwd_max, fwd_mean, fwd_std = self._stats(self.fwd_pkt_lengths)
        bwd_min, bwd_max, bwd_mean, bwd_std = self._stats(self.bwd_pkt_lengths)
        all_min, all_max, all_mean, all_std = self._stats(self.all_pkt_lengths)
        all_var = float(all_std**2)

        # Rates (safely handling zero duration)
        if dur_sec > 0:
            flow_bytes_per_sec = total_bytes / dur_sec
            flow_pkts_per_sec = total_pkts / dur_sec
            fwd_pkts_per_sec = total_fwd_pkts / dur_sec
            bwd_pkts_per_sec = total_bwd_pkts / dur_sec
        else:
            flow_bytes_per_sec = 0.0
            flow_pkts_per_sec = 0.0
            fwd_pkts_per_sec = 0.0
            bwd_pkts_per_sec = 0.0

        # IAT statistics
        flow_iat_min, flow_iat_max, flow_iat_mean, flow_iat_std = self._stats(self.flow_iats)
        fwd_iat_min, fwd_iat_max, fwd_iat_mean, fwd_iat_std = self._stats(self.fwd_iats)
        fwd_iat_total = float(sum(self.fwd_iats))
        bwd_iat_min, bwd_iat_max, bwd_iat_mean, bwd_iat_std = self._stats(self.bwd_iats)
        bwd_iat_total = float(sum(self.bwd_iats))

        # Averages & Ratios
        down_up_ratio = (total_bwd_pkts / total_fwd_pkts) if total_fwd_pkts > 0 else 0.0
        avg_pkt_size = (total_bytes / total_pkts) if total_pkts > 0 else 0.0
        avg_fwd_seg_size = (total_fwd_bytes / total_fwd_pkts) if total_fwd_pkts > 0 else 0.0
        avg_bwd_seg_size = (total_bwd_bytes / total_bwd_pkts) if total_bwd_pkts > 0 else 0.0

        # Active / Idle statistics
        # Finalize last active period if not closed
        if not self.active_times and dur_us > 0:
            self.active_times.append(dur_us)

        act_min, act_max, act_mean, act_std = self._stats(self.active_times)
        idle_min, idle_max, idle_mean, idle_std = self._stats(self.idle_times)

        raw_features = {
            "destination_port": float(self.destination_port),
            "flow_duration": float(dur_us),
            "total_fwd_packets": float(total_fwd_pkts),
            "total_bwd_packets": float(total_bwd_pkts),
            "total_fwd_bytes": float(total_fwd_bytes),
            "total_bwd_bytes": float(total_bwd_bytes),
            "fwd_packet_length_max": float(fwd_max),
            "fwd_packet_length_min": float(fwd_min),
            "fwd_packet_length_mean": float(fwd_mean),
            "fwd_packet_length_std": float(fwd_std),
            "bwd_packet_length_max": float(bwd_max),
            "bwd_packet_length_min": float(bwd_min),
            "bwd_packet_length_mean": float(bwd_mean),
            "bwd_packet_length_std": float(bwd_std),
            "flow_bytes_per_sec": float(flow_bytes_per_sec),
            "flow_packets_per_sec": float(flow_pkts_per_sec),
            "flow_iat_mean": float(flow_iat_mean),
            "flow_iat_std": float(flow_iat_std),
            "flow_iat_max": float(flow_iat_max),
            "flow_iat_min": float(flow_iat_min),
            "fwd_iat_total": float(fwd_iat_total),
            "fwd_iat_mean": float(fwd_iat_mean),
            "fwd_iat_std": float(fwd_iat_std),
            "fwd_iat_max": float(fwd_iat_max),
            "fwd_iat_min": float(fwd_iat_min),
            "bwd_iat_total": float(bwd_iat_total),
            "bwd_iat_mean": float(bwd_iat_mean),
            "bwd_iat_std": float(bwd_iat_std),
            "bwd_iat_max": float(bwd_iat_max),
            "bwd_iat_min": float(bwd_iat_min),
            "fwd_psh_flags": float(self.fwd_psh_flags),
            "bwd_psh_flags": float(self.bwd_psh_flags),
            "fwd_urg_flags": float(self.fwd_urg_flags),
            "bwd_urg_flags": float(self.bwd_urg_flags),
            "fwd_header_length": float(self.fwd_header_bytes),
            "bwd_header_length": float(self.bwd_header_bytes),
            "fwd_packets_per_sec": float(fwd_pkts_per_sec),
            "bwd_packets_per_sec": float(bwd_pkts_per_sec),
            "min_packet_length": float(all_min),
            "max_packet_length": float(all_max),
            "packet_length_mean": float(all_mean),
            "packet_length_std": float(all_std),
            "packet_length_variance": float(all_var),
            "fin_flag_count": float(self.fin_count),
            "syn_flag_count": float(self.syn_count),
            "rst_flag_count": float(self.rst_count),
            "psh_flag_count": float(self.psh_count),
            "ack_flag_count": float(self.ack_count),
            "urg_flag_count": float(self.urg_count),
            "cwe_flag_count": float(self.cwe_count),
            "ece_flag_count": float(self.ece_count),
            "down_up_ratio": float(down_up_ratio),
            "average_packet_size": float(avg_pkt_size),
            "avg_fwd_segment_size": float(avg_fwd_seg_size),
            "avg_bwd_segment_size": float(avg_bwd_seg_size),
            "fwd_avg_bytes_bulk": 0.0,
            "fwd_avg_packets_bulk": 0.0,
            "fwd_avg_bulk_rate": 0.0,
            "bwd_avg_bytes_bulk": 0.0,
            "bwd_avg_packets_bulk": 0.0,
            "bwd_avg_bulk_rate": 0.0,
            "subflow_fwd_packets": float(total_fwd_pkts),
            "subflow_fwd_bytes": float(total_fwd_bytes),
            "subflow_bwd_packets": float(total_bwd_pkts),
            "subflow_bwd_bytes": float(total_bwd_bytes),
            "init_win_bytes_fwd": float(self.init_win_bytes_fwd),
            "init_win_bytes_bwd": float(self.init_win_bytes_bwd),
            "act_data_pkt_fwd": float(self.fwd_act_data_pkts),
            "min_seg_size_fwd": float(self.min_seg_size_fwd),
            "active_mean": float(act_mean),
            "active_std": float(act_std),
            "active_max": float(act_max),
            "active_min": float(act_min),
            "idle_mean": float(idle_mean),
            "idle_std": float(idle_std),
            "idle_max": float(idle_max),
            "idle_min": float(idle_min),
        }

        # Validate and return strict canonical 77-feature dictionary
        return FeatureSchemaValidator.build_ordered_vector(raw_features)

    def to_network_flow_metadata(self) -> Dict[str, Any]:
        """Synthesizes high-level NetworkFlow metadata for frontend SOC display."""
        return {
            "id": self.flow_id,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(self.start_time)),
            "sourceIp": self.initiator_src_ip,
            "destinationIp": self.destination_ip,
            "sourcePort": self.initiator_src_port,
            "destinationPort": self.destination_port,
            "protocol": self.protocol,
            "durationMs": self.duration_microseconds / 1000.0,
            "totalFwdPackets": len(self.fwd_pkt_lengths),
            "totalBwdPackets": len(self.bwd_pkt_lengths),
            "totalFwdBytes": float(sum(self.fwd_pkt_lengths)),
            "totalBwdBytes": float(sum(self.bwd_pkt_lengths)),
            "fwdPacketLengthMean": float(np.mean(self.fwd_pkt_lengths)) if self.fwd_pkt_lengths else 0.0,
            "bwdPacketLengthMean": float(np.mean(self.bwd_pkt_lengths)) if self.bwd_pkt_lengths else 0.0,
            "flowBytesPerSec": (
                (sum(self.fwd_pkt_lengths) + sum(self.bwd_pkt_lengths)) / self.duration_seconds
                if self.duration_seconds > 0
                else 0.0
            ),
            "flowPacketsPerSec": (
                (len(self.fwd_pkt_lengths) + len(self.bwd_pkt_lengths)) / self.duration_seconds
                if self.duration_seconds > 0
                else 0.0
            ),
            "synFlagCount": self.syn_count,
            "finFlagCount": self.fin_count,
            "rstFlagCount": self.rst_count,
            "pshFlagCount": self.psh_count,
            "ackFlagCount": self.ack_count,
            "source": "live",
        }
