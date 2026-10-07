import json
import os
import sys

# Ensure apps/ml root is in pythonpath
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import tempfile
import time
import numpy as np
import redis
import scapy.all as scapy

from app.sensor.packet_parser import PacketParser, ParsedPacket
from app.sensor.flow_accumulator import BidirectionalFlow
from app.sensor.flow_manager import FlowManager
from app.sensor.capture import LiveSensorEngine
from app.streaming.config import STREAMING_CONFIG
from app.streaming.worker import MLStreamWorker
from app.inference.service import InferenceService


def generate_benchmark_pcap(filepath: str, flow_count: int = 50) -> int:
    """Generates a multi-flow synthetic PCAP fixture for accurate latency profiling."""
    packets = []
    base_time = 1700000000.0
    eth = scapy.Ether(src="00:11:22:33:44:55", dst="66:77:88:99:aa:bb")

    for f_idx in range(flow_count):
        src_port = 10000 + f_idx
        dst_port = 80 if f_idx % 2 == 0 else 443
        t_offset = f_idx * 0.05

        # 1. SYN
        p1 = eth / scapy.IP(src="192.168.1.50", dst="192.168.1.1") / scapy.TCP(sport=src_port, dport=dst_port, flags="S", seq=100, window=65535)
        p1.time = base_time + t_offset + 0.001
        packets.append(p1)

        # 2. SYN-ACK
        p2 = eth / scapy.IP(src="192.168.1.1", dst="192.168.1.50") / scapy.TCP(sport=dst_port, dport=src_port, flags="SA", seq=500, ack=101, window=32768)
        p2.time = base_time + t_offset + 0.005
        packets.append(p2)

        # 3. ACK
        p3 = eth / scapy.IP(src="192.168.1.50", dst="192.168.1.1") / scapy.TCP(sport=src_port, dport=dst_port, flags="A", seq=101, ack=501, window=65535)
        p3.time = base_time + t_offset + 0.008
        packets.append(p3)

        # 4. PSH-ACK (Data Fwd)
        p4 = eth / scapy.IP(src="192.168.1.50", dst="192.168.1.1") / scapy.TCP(sport=src_port, dport=dst_port, flags="PA", seq=101, ack=501, window=65535) / scapy.Raw(b"G" * 150)
        p4.time = base_time + t_offset + 0.015
        packets.append(p4)

        # 5. PSH-ACK (Data Bwd)
        p5 = eth / scapy.IP(src="192.168.1.1", dst="192.168.1.50") / scapy.TCP(sport=dst_port, dport=src_port, flags="PA", seq=501, ack=251, window=32768) / scapy.Raw(b"R" * 450)
        p5.time = base_time + t_offset + 0.025
        packets.append(p5)

        # 6. FIN-ACK Fwd
        p6 = eth / scapy.IP(src="192.168.1.50", dst="192.168.1.1") / scapy.TCP(sport=src_port, dport=dst_port, flags="FA", seq=251, ack=951, window=65535)
        p6.time = base_time + t_offset + 0.035
        packets.append(p6)

        # 7. FIN-ACK Bwd
        p7 = eth / scapy.IP(src="192.168.1.1", dst="192.168.1.50") / scapy.TCP(sport=dst_port, dport=src_port, flags="FA", seq=951, ack=252, window=32768)
        p7.time = base_time + t_offset + 0.040
        packets.append(p7)

    scapy.wrpcap(filepath, packets)
    return len(packets)


def run_benchmarks():
    print("=" * 70)
    print("   NETSENTRY AI — PHASE 6 LIVE SENSOR BENCHMARK SUITE")
    print("=" * 70)

    with tempfile.NamedTemporaryFile(suffix=".pcap", delete=False) as f:
        pcap_file = f.name

    flow_count = 100
    pkt_count = generate_benchmark_pcap(pcap_file, flow_count=flow_count)
    print(f"[*] Generated benchmark PCAP with {pkt_count} packets ({flow_count} conversations).")

    # -------------------------------------------------------------
    # BENCHMARK 1: Packet Parsing & Feature Extraction Throughput
    # -------------------------------------------------------------
    print("\n--- 1. FLOW RECONSTRUCTION & FEATURE EXTRACTION BENCHMARK ---")
    extraction_latencies_ms = []

    def on_flow_finalized(flow, feats):
        pass

    manager = FlowManager(flow_timeout_sec=30.0, on_flow_finalized=on_flow_finalized)
    parser = PacketParser()

    # Pre-parse packets to isolate pure reconstruction & extraction
    packets_scapy = list(scapy.PcapReader(pcap_file))

    t0 = time.perf_counter()
    flows_reconstructed = 0
    for spkt in packets_scapy:
        parsed = parser.parse_scapy(spkt)
        if parsed:
            completed = manager.on_packet(parsed)
            if completed:
                flows_reconstructed += 1

    total_pipeline_time = time.perf_counter() - t0
    pkts_per_sec = len(packets_scapy) / max(total_pipeline_time, 0.0001)
    flows_per_sec = flows_reconstructed / max(total_pipeline_time, 0.0001)

    # Micro-benchmark for 77-feature extraction isolated call
    active_sample_flow = BidirectionalFlow(parser.parse_scapy(packets_scapy[0]))
    for spkt in packets_scapy[1:7]:
        p = parser.parse_scapy(spkt)
        if p:
            active_sample_flow.add_packet(p)

    for _ in range(500):
        t_start = time.perf_counter()
        feats = active_sample_flow.extract_features()
        extraction_latencies_ms.append((time.perf_counter() - t_start) * 1000.0)

    ext_arr = np.array(extraction_latencies_ms)
    print(f"Total Packets Processed:        {len(packets_scapy)}")
    print(f"Flows Reconstructed:            {flows_reconstructed}")
    print(f"Packet Ingestion Throughput:    {pkts_per_sec:,.1f} pkts/sec")
    print(f"Flow Reconstruction Throughput: {flows_per_sec:,.1f} flows/sec")
    print(f"Feature Extraction Mean:        {np.mean(ext_arr):.4f} ms")
    print(f"Feature Extraction P50:         {np.percentile(ext_arr, 50):.4f} ms")
    print(f"Feature Extraction P95:         {np.percentile(ext_arr, 95):.4f} ms")
    print(f"Feature Extraction P99:         {np.percentile(ext_arr, 99):.4f} ms")

    # -------------------------------------------------------------
    # BENCHMARK 2: End-to-End Pipeline Latency (Redis + ML)
    # -------------------------------------------------------------
    print("\n--- 2. END-TO-END PIPELINE LATENCY PROFILE (Sensor -> Redis -> ML) ---")
    try:
        r = redis.Redis(
            host=STREAMING_CONFIG.redis_host,
            port=STREAMING_CONFIG.redis_port,
            db=STREAMING_CONFIG.redis_db,
            decode_responses=True,
            socket_timeout=2.0,
        )
        r.ping()
        redis_available = True
    except Exception as e:
        redis_available = False
        print(f"[!] Redis not connected: {e}. Skipping end-to-end streaming latency.")

    e2e_latencies_ms = []
    if redis_available:
        worker = MLStreamWorker(config=STREAMING_CONFIG, worker_id="bench-worker")
        worker.setup_stream_group()

        engine = LiveSensorEngine.get_instance()
        engine.redis_client = r
        engine.flow_manager.redis_client = r

        # Benchmark 20 completed flows end-to-end
        for i in range(20):
            t_flow_start = time.perf_counter()
            # Send single flow's packets
            f_offset = i * 7
            for spkt in packets_scapy[f_offset : f_offset + 7]:
                engine._on_scapy_packet(spkt)

            # Read from netsentry:flows
            entries = r.xrevrange(STREAMING_CONFIG.stream_flows, count=1)
            if entries:
                msg_id, fields = entries[0]
                worker.process_message(msg_id, fields)
                e2e_latency = (time.perf_counter() - t_flow_start) * 1000.0
                e2e_latencies_ms.append(e2e_latency)

        e2e_arr = np.array(e2e_latencies_ms)
        print(f"End-to-End Samples Measured:    {len(e2e_arr)}")
        print(f"End-to-End Latency Mean:        {np.mean(e2e_arr):.2f} ms")
        print(f"End-to-End Latency P50:         {np.percentile(e2e_arr, 50):.2f} ms")
        print(f"End-to-End Latency P95:         {np.percentile(e2e_arr, 95):.2f} ms")
        print(f"End-to-End Latency P99:         {np.percentile(e2e_arr, 99):.2f} ms")

    # Cleanup
    if os.path.exists(pcap_file):
        os.remove(pcap_file)

    benchmark_results = {
        "benchmark": "Phase 6 Live Sensor & Feature Extractor",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "packet_throughput_pkts_sec": round(pkts_per_sec, 1),
        "flow_throughput_flows_sec": round(flows_per_sec, 1),
        "feature_extraction": {
            "mean_ms": round(float(np.mean(ext_arr)), 4),
            "p50_ms": round(float(np.percentile(ext_arr, 50)), 4),
            "p95_ms": round(float(np.percentile(ext_arr, 95)), 4),
            "p99_ms": round(float(np.percentile(ext_arr, 99)), 4),
        },
        "end_to_end_streaming": {
            "mean_ms": round(float(np.mean(e2e_arr)), 2) if e2e_latencies_ms else None,
            "p50_ms": round(float(np.percentile(e2e_arr, 50)), 2) if e2e_latencies_ms else None,
            "p95_ms": round(float(np.percentile(e2e_arr, 95)), 2) if e2e_latencies_ms else None,
            "p99_ms": round(float(np.percentile(e2e_arr, 99)), 2) if e2e_latencies_ms else None,
        },
    }

    report_path = os.path.join(os.path.dirname(__file__), "..", "reports", "phase6_benchmark.json")
    os.makedirs(os.path.dirname(report_path), exist_ok=True)
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(benchmark_results, f, indent=2)

    print(f"\n[+] Saved benchmark metrics to {report_path}")
    print("=" * 70)
    return benchmark_results


if __name__ == "__main__":
    run_benchmarks()
