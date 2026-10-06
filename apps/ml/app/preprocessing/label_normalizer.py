import json
from pathlib import Path
from typing import Dict

# Exact canonical mapping from CIC-IDS2017 raw labels to semantic attack categories
RAW_TO_NORMALIZED_MAPPING: Dict[str, str] = {
    "BENIGN": "BENIGN",
    "DDoS": "DDoS",
    "PortScan": "PortScan",
    "DoS Hulk": "DoS",
    "DoS GoldenEye": "DoS",
    "DoS slowloris": "DoS",
    "DoS Slowhttptest": "DoS",
    "FTP-Patator": "BruteForce",
    "SSH-Patator": "BruteForce",
    "Bot": "Botnet",
    "Web Attack  Brute Force": "WebAttack",
    "Web Attack – Brute Force": "WebAttack",
    "Web Attack - Brute Force": "WebAttack",
    "Web Attack  XSS": "WebAttack",
    "Web Attack – XSS": "WebAttack",
    "Web Attack - XSS": "WebAttack",
    "Web Attack  Sql Injection": "WebAttack",
    "Web Attack – Sql Injection": "WebAttack",
    "Web Attack - Sql Injection": "WebAttack",
    "Infiltration": "Infiltration",
    "Heartbleed": "Heartbleed",
}

# Rationale documentation for merged classes
MAPPING_RATIONALE = {
    "DoS": "Consolidates Denial of Service attack tools (Hulk, GoldenEye, Slowloris, Slowhttptest) into a cohesive DoS category.",
    "BruteForce": "Combines network service credential guessing attacks (FTP-Patator and SSH-Patator).",
    "WebAttack": "Aggregates application-layer attacks (SQL Injection, Cross-Site Scripting, and Web Brute Force).",
    "Botnet": "Maps the ARES Bot traffic into a recognized industry threat category.",
    "BENIGN": "Retains clean, non-malicious network activity as the negative class.",
    "DDoS": "Preserves volumetric distributed denial of service (LOIC) as a distinct threat class.",
    "PortScan": "Preserves network reconnaissance and port scanning as a distinct threat class.",
    "Infiltration": "Preserves lateral movement and exploit payloads as a distinct threat class.",
    "Heartbleed": "Preserves the OpenSSL memory leakage exploit as an acute vulnerability class.",
}


def normalize_label(raw_label: str) -> str:
    cleaned = str(raw_label).strip()
    if cleaned in RAW_TO_NORMALIZED_MAPPING:
        return RAW_TO_NORMALIZED_MAPPING[cleaned]

    # Handle encoding variations for web attacks
    cleaned_lower = cleaned.lower()
    if "web attack" in cleaned_lower:
        return "WebAttack"
    if "dos" in cleaned_lower:
        return "DoS"
    if "patator" in cleaned_lower:
        return "BruteForce"
    if "bot" in cleaned_lower:
        return "Botnet"
    if "portscan" in cleaned_lower:
        return "PortScan"
    if "ddos" in cleaned_lower:
        return "DDoS"
    if "infiltration" in cleaned_lower:
        return "Infiltration"
    if "heartbleed" in cleaned_lower:
        return "Heartbleed"
    if "benign" in cleaned_lower:
        return "BENIGN"

    return "Other"


def export_mapping_metadata(output_path: Path):
    data = {
        "mapping": RAW_TO_NORMALIZED_MAPPING,
        "rationale": MAPPING_RATIONALE,
        "target_classes": sorted(list(set(RAW_TO_NORMALIZED_MAPPING.values()))),
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    return data
