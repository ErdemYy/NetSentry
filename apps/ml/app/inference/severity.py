from typing import Literal

SeverityLevel = Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]


def calculate_severity(
    predicted_class: str,
    confidence: float,
    is_anomalous: bool,
    anomaly_score: float,
) -> SeverityLevel:
    """
    Deterministic rule-based severity calculation based on threat taxonomy,
    model confidence, and anomaly divergence. Documented in docs/THREAT-MODEL.md.
    """
    cls_upper = predicted_class.upper()

    # Volumetric and high-impact acute compromises
    if cls_upper in ("DDOS", "HEARTBLEED", "INFILTRATION"):
        if confidence >= 0.75:
            return "CRITICAL"
        return "HIGH"

    # Recognized service-disrupting or lateral exploitation
    if cls_upper in ("DOS", "PORTSCAN", "BRUTEFORCE", "WEBATTACK", "BOTNET"):
        if confidence >= 0.80:
            return "HIGH"
        return "MEDIUM"

    # Normal traffic with unexpected statistical divergence (potential novel/zero-day vector)
    if cls_upper == "BENIGN":
        if is_anomalous:
            if anomaly_score >= 0.60:
                return "HIGH"
            return "MEDIUM"
        return "LOW"

    return "LOW"
