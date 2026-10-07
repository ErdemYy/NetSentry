import math
from typing import Dict, List, Any, Tuple
import numpy as np

# Canonical feature list established in Phase 1 and frozen in metadata.json
CANONICAL_77_FEATURES: List[str] = [
    "destination_port",
    "flow_duration",
    "total_fwd_packets",
    "total_bwd_packets",
    "total_fwd_bytes",
    "total_bwd_bytes",
    "fwd_packet_length_max",
    "fwd_packet_length_min",
    "fwd_packet_length_mean",
    "fwd_packet_length_std",
    "bwd_packet_length_max",
    "bwd_packet_length_min",
    "bwd_packet_length_mean",
    "bwd_packet_length_std",
    "flow_bytes_per_sec",
    "flow_packets_per_sec",
    "flow_iat_mean",
    "flow_iat_std",
    "flow_iat_max",
    "flow_iat_min",
    "fwd_iat_total",
    "fwd_iat_mean",
    "fwd_iat_std",
    "fwd_iat_max",
    "fwd_iat_min",
    "bwd_iat_total",
    "bwd_iat_mean",
    "bwd_iat_std",
    "bwd_iat_max",
    "bwd_iat_min",
    "fwd_psh_flags",
    "bwd_psh_flags",
    "fwd_urg_flags",
    "bwd_urg_flags",
    "fwd_header_length",
    "bwd_header_length",
    "fwd_packets_per_sec",
    "bwd_packets_per_sec",
    "min_packet_length",
    "max_packet_length",
    "packet_length_mean",
    "packet_length_std",
    "packet_length_variance",
    "fin_flag_count",
    "syn_flag_count",
    "rst_flag_count",
    "psh_flag_count",
    "ack_flag_count",
    "urg_flag_count",
    "cwe_flag_count",
    "ece_flag_count",
    "down_up_ratio",
    "average_packet_size",
    "avg_fwd_segment_size",
    "avg_bwd_segment_size",
    "fwd_avg_bytes_bulk",
    "fwd_avg_packets_bulk",
    "fwd_avg_bulk_rate",
    "bwd_avg_bytes_bulk",
    "bwd_avg_packets_bulk",
    "bwd_avg_bulk_rate",
    "subflow_fwd_packets",
    "subflow_fwd_bytes",
    "subflow_bwd_packets",
    "subflow_bwd_bytes",
    "init_win_bytes_fwd",
    "init_win_bytes_bwd",
    "act_data_pkt_fwd",
    "min_seg_size_fwd",
    "active_mean",
    "active_std",
    "active_max",
    "active_min",
    "idle_mean",
    "idle_std",
    "idle_max",
    "idle_min",
]

SCHEMA_VERSION: str = "feature-schema-v1"


class FeatureSchemaValidator:
    """
    Validates that an extracted flow feature dictionary strictly satisfies
    feature-schema-v1 before transmission to Redis Streams.
    """

    @staticmethod
    def validate(features: Dict[str, Any]) -> Tuple[bool, List[str]]:
        errors = []

        if len(features) != len(CANONICAL_77_FEATURES):
            errors.append(
                f"Feature count mismatch: expected {len(CANONICAL_77_FEATURES)}, received {len(features)}"
            )

        for feat in CANONICAL_77_FEATURES:
            if feat not in features:
                errors.append(f"Missing required feature: '{feat}'")
                continue

            val = features[feat]
            if not isinstance(val, (int, float, np.number)) or isinstance(val, bool):
                errors.append(f"Feature '{feat}' must be numeric, got {type(val).__name__}")
                continue

            f_val = float(val)
            if math.isnan(f_val):
                errors.append(f"Feature '{feat}' contains NaN")
            elif math.isinf(f_val):
                errors.append(f"Feature '{feat}' contains Infinity")

        return len(errors) == 0, errors

    @staticmethod
    def build_ordered_vector(features: Dict[str, Any]) -> Dict[str, float]:
        """
        Builds a guaranteed ordered dictionary of the 77 features.
        """
        is_valid, errors = FeatureSchemaValidator.validate(features)
        if not is_valid:
            raise ValueError(f"Feature schema validation failed: {'; '.join(errors[:3])}")

        return {feat: float(features[feat]) for feat in CANONICAL_77_FEATURES}
