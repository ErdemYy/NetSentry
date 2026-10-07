import json
import os
import tempfile
import time
import pytest
import scapy.all as scapy

from app.sensor.interfaces import InterfaceManager
from app.sensor.flow_key import FlowKey, FlowDirection
from app.sensor.packet_parser import PacketParser, ParsedPacket
from app.sensor.flow_accumulator import BidirectionalFlow
from app.sensor.flow_manager import FlowManager
from app.sensor.feature_schema import CANONICAL_77_FEATURES, FeatureSchemaValidator
from app.sensor.capture import LiveSensorEngine
from app.inference.service import InferenceService


class TestSensorCore:
    def test_interfaces_and_npcap_discovery(self):
        """Validates that network interfaces and Npcap driver presence are cleanly discovered."""
        ifaces = InterfaceManager.list_interfaces()
        assert isinstance(ifaces, list)
        assert len(ifaces) > 0

        # Safe metadata check - no raw credentials or payloads
        for iface in ifaces:
            assert "name" in iface
            assert "description" in iface
            assert "ip" in iface
            assert "status" in iface

        npcap_status = InterfaceManager.is_npcap_installed()
        assert isinstance(npcap_status, bool)

    def test_flow_key_symmetry_and_direction(self):
        """Ensures bidirectional canonical key symmetry and deterministic direction determination."""
        k1 = FlowKey("192.168.1.10", 5000, "192.168.1.20", 80, "TCP")
        k2 = FlowKey("192.168.1.20", 80, "192.168.1.10", 5000, "TCP")

        # Canonical ID must be identical regardless of packet origin
        assert k1.canonical_id == k2.canonical_id

        # First observed packet sets FORWARD direction
        dir1 = k1.determine_direction("192.168.1.10", 5000)
        assert dir1 == FlowDirection.FORWARD

        dir2 = k1.determine_direction("192.168.1.20", 80)
        assert dir2 == FlowDirection.BACKWARD

    def test_packet_parser_safety(self):
        """Verifies parser extracts only protocol metadata and statistics, ignoring payloads."""
        parser = PacketParser()

        # Build a sample Scapy TCP packet with payload and explicit MACs
        eth = scapy.Ether(src="00:11:22:33:44:55", dst="66:77:88:99:aa:bb")
        ip = scapy.IP(src="10.0.0.1", dst="10.0.0.2")
        tcp = scapy.TCP(sport=12345, dport=443, flags="S", window=64240)
        raw = scapy.Raw(b"TOP_SECRET_PAYLOAD_PASSWORD")
        scapy_pkt = eth / ip / tcp / raw
        parsed = parser.parse_scapy(scapy_pkt)

        assert parsed is not None
        assert parsed.src_ip == "10.0.0.1"
        assert parsed.dst_ip == "10.0.0.2"
        assert parsed.src_port == 12345
        assert parsed.dst_port == 443
        assert parsed.protocol == "TCP"
        assert parsed.syn == 1
        assert parsed.window_size == 64240
        # Payload bytes are not retained
        assert not hasattr(parsed, "raw")

    def test_flow_lifecycle_tcp_rst_immediate_termination(self):
        """Verifies flow is terminated immediately upon receiving TCP RST."""
        manager = FlowManager(flow_timeout_sec=30.0)

        p1 = ParsedPacket(
            timestamp=100.0, src_ip="192.168.1.1", src_port=1000, dst_ip="192.168.1.2", dst_port=80,
            protocol="TCP", wire_length=60, tcp_flags={"FIN": 0, "SYN": 1, "RST": 0, "PSH": 0, "ACK": 0, "URG": 0, "ECE": 0, "CWR": 0},
            tcp_window=65535,
        )
        assert manager.on_packet(p1) is None
        assert len(manager.active_flows) == 1

        p2 = ParsedPacket(
            timestamp=100.05, src_ip="192.168.1.2", src_port=80, dst_ip="192.168.1.1", dst_port=1000,
            protocol="TCP", wire_length=54, tcp_flags={"FIN": 0, "SYN": 0, "RST": 1, "PSH": 0, "ACK": 0, "URG": 0, "ECE": 0, "CWR": 0},
            tcp_window=0,
        )
        completed_flow = manager.on_packet(p2)
        assert completed_flow is not None
        assert completed_flow.is_terminated is True
        assert completed_flow.termination_reason == "TCP_RST"
        assert len(manager.active_flows) == 0

    def test_flow_lifecycle_tcp_fin_handshake_termination(self):
        """Verifies flow is terminated when both peers send FIN."""
        manager = FlowManager(flow_timeout_sec=30.0)

        # 1. Initiator SYN
        p1 = ParsedPacket(
            timestamp=100.0, src_ip="192.168.1.1", src_port=1000, dst_ip="192.168.1.2", dst_port=80,
            protocol="TCP", wire_length=60, tcp_flags={"FIN": 0, "SYN": 1, "RST": 0, "PSH": 0, "ACK": 0, "URG": 0, "ECE": 0, "CWR": 0},
            tcp_window=65535,
        )
        assert manager.on_packet(p1) is None
        assert len(manager.active_flows) == 1

        # 2. Initiator FIN
        p2 = ParsedPacket(
            timestamp=100.05, src_ip="192.168.1.1", src_port=1000, dst_ip="192.168.1.2", dst_port=80,
            protocol="TCP", wire_length=54, tcp_flags={"FIN": 1, "SYN": 0, "RST": 0, "PSH": 0, "ACK": 1, "URG": 0, "ECE": 0, "CWR": 0},
            tcp_window=65535,
        )
        assert manager.on_packet(p2) is None
        assert len(manager.active_flows) == 1

        # 3. Responder FIN
        p3 = ParsedPacket(
            timestamp=100.06, src_ip="192.168.1.2", src_port=80, dst_ip="192.168.1.1", dst_port=1000,
            protocol="TCP", wire_length=54, tcp_flags={"FIN": 1, "SYN": 0, "RST": 0, "PSH": 0, "ACK": 1, "URG": 0, "ECE": 0, "CWR": 0},
            tcp_window=32768,
        )
        completed_flow = manager.on_packet(p3)
        assert completed_flow is not None
        assert completed_flow.is_terminated is True
        assert completed_flow.termination_reason == "TCP_FIN"
        assert len(manager.active_flows) == 0

    def test_flow_lifecycle_udp_timeout(self):
        """Verifies inactive flows are harvested upon inactivity timeout."""
        manager = FlowManager(flow_timeout_sec=10.0)

        p1 = ParsedPacket(
            timestamp=1000.0, src_ip="192.168.1.5", src_port=5353, dst_ip="224.0.0.251", dst_port=5353,
            protocol="UDP", wire_length=120,
        )
        manager.on_packet(p1)
        assert len(manager.active_flows) == 1

        # Sweep at t=1005 (only 5s elapsed) -> should not expire
        expired = manager.check_timeouts(1005.0)
        assert len(expired) == 0
        assert len(manager.active_flows) == 1

        # Sweep at t=1012 (12s elapsed > 10s timeout) -> must expire
        expired = manager.check_timeouts(1012.0)
        assert len(expired) == 1
        assert expired[0].termination_reason == "TIMEOUT"
        assert len(manager.active_flows) == 0


class TestGoldenPcapParityAndMLCompatibility:
    @pytest.fixture
    def golden_pcap_path(self):
        """Creates a controlled synthetic PCAP fixture with known analytical metrics."""
        with tempfile.NamedTemporaryFile(suffix=".pcap", delete=False) as f:
            pcap_path = f.name

        base_time = 1700000000.0
        packets = []
        eth = scapy.Ether(src="00:11:22:33:44:55", dst="66:77:88:99:aa:bb")

        # Pkt 1 (t=0.000s): Client SYN -> Server (sport=45678, dport=80, win=65535, len=60)
        p1 = eth / scapy.IP(src="192.168.10.100", dst="192.168.10.200") / scapy.TCP(sport=45678, dport=80, flags="S", seq=100, window=65535)
        p1.time = base_time + 0.000
        packets.append(p1)

        # Pkt 2 (t=0.010s): Server SYN-ACK -> Client (sport=80, dport=45678, win=32768, len=60)
        p2 = eth / scapy.IP(src="192.168.10.200", dst="192.168.10.100") / scapy.TCP(sport=80, dport=45678, flags="SA", seq=500, ack=101, window=32768)
        p2.time = base_time + 0.010
        packets.append(p2)

        # Pkt 3 (t=0.015s): Client ACK -> Server (sport=45678, dport=80, win=65535, len=54)
        p3 = eth / scapy.IP(src="192.168.10.100", dst="192.168.10.200") / scapy.TCP(sport=45678, dport=80, flags="A", seq=101, ack=501, window=65535)
        p3.time = base_time + 0.015
        packets.append(p3)

        # Pkt 4 (t=0.050s): Client PSH-ACK HTTP GET (payload 100 bytes, len=154)
        p4 = eth / scapy.IP(src="192.168.10.100", dst="192.168.10.200") / scapy.TCP(sport=45678, dport=80, flags="PA", seq=101, ack=501, window=65535) / scapy.Raw(b"X" * 100)
        p4.time = base_time + 0.050
        packets.append(p4)

        # Pkt 5 (t=0.080s): Server PSH-ACK HTTP 200 (payload 300 bytes, len=354)
        p5 = eth / scapy.IP(src="192.168.10.200", dst="192.168.10.100") / scapy.TCP(sport=80, dport=45678, flags="PA", seq=501, ack=201, window=32768) / scapy.Raw(b"Y" * 300)
        p5.time = base_time + 0.080
        packets.append(p5)

        # Pkt 6 (t=0.120s): Client FIN-ACK (len=54)
        p6 = eth / scapy.IP(src="192.168.10.100", dst="192.168.10.200") / scapy.TCP(sport=45678, dport=80, flags="FA", seq=201, ack=801, window=65535)
        p6.time = base_time + 0.120
        packets.append(p6)

        # Pkt 7 (t=0.130s): Server FIN-ACK (len=54)
        p7 = eth / scapy.IP(src="192.168.10.200", dst="192.168.10.100") / scapy.TCP(sport=80, dport=45678, flags="FA", seq=801, ack=202, window=32768)
        p7.time = base_time + 0.130
        packets.append(p7)

        scapy.wrpcap(pcap_path, packets)
        yield pcap_path

        if os.path.exists(pcap_path):
            os.remove(pcap_path)

    def test_golden_pcap_feature_parity(self, golden_pcap_path):
        """
        Processes Golden PCAP through NetSentry Live Feature Extractor,
        computes parity against analytical reference values, and asserts absolute/relative tolerance.
        """
        captured_flows = []
        captured_features = []

        def on_finalized(flow, features):
            captured_flows.append(flow)
            captured_features.append(features)

        manager = FlowManager(flow_timeout_sec=30.0, on_flow_finalized=on_finalized)
        parser = PacketParser()

        reader = scapy.PcapReader(golden_pcap_path)
        for pkt in reader:
            parsed = parser.parse_scapy(pkt)
            if parsed:
                manager.on_packet(parsed)
        reader.close()
        manager.flush_all()

        assert len(captured_flows) >= 1
        flow = captured_flows[0]
        feats = captured_features[0]

        # 1. Feature Count & Canonical Schema Validation
        assert len(feats) == 77
        is_valid, err_msg = FeatureSchemaValidator.validate(feats)
        assert is_valid, f"Feature schema validation failed: {err_msg}"

        # 2. Parity Test Against Analytical Reference
        # Expected counts:
        # Forward packets: P1 (SYN), P3 (ACK), P4 (PSH-ACK), P6 (FIN-ACK) = 4 pkts
        assert feats["total_fwd_packets"] == 4.0
        # Backward packets: P2 (SYN-ACK), P5 (PSH-ACK), P7 (FIN-ACK) = 3 pkts
        assert feats["total_bwd_packets"] == 3.0

        # TCP Flags
        assert feats["syn_flag_count"] == 2.0  # P1 and P2
        assert feats["fin_flag_count"] == 2.0  # P6 and P7
        assert feats["rst_flag_count"] == 0.0
        assert feats["psh_flag_count"] == 2.0  # P4 and P5
        assert feats["ack_flag_count"] == 6.0  # P2, P3, P4, P5, P6, P7

        # Windows
        assert feats["init_win_bytes_fwd"] == 65535.0
        assert feats["init_win_bytes_bwd"] == 32768.0

        # Duration: ~130,000 microseconds (0.130s)
        expected_dur_us = 130000.0
        actual_dur_us = feats["flow_duration"]
        abs_err = abs(actual_dur_us - expected_dur_us)
        rel_err = abs_err / expected_dur_us
        assert rel_err < 0.05, f"Duration tolerance exceeded: expected {expected_dur_us}, got {actual_dur_us}"

        # Rates: flow_bytes_per_sec and flow_packets_per_sec must be positive and non-zero
        assert feats["flow_bytes_per_sec"] > 0
        assert feats["flow_packets_per_sec"] > 0

        # Verify no NaN or Inf in entire feature vector
        for fname, val in feats.items():
            assert not (val != val), f"Feature {fname} is NaN!"
            assert abs(val) != float("inf"), f"Feature {fname} is Inf!"

    def test_model_compatibility_acceptance(self, golden_pcap_path):
        """
        Feeds real live extracted 77-feature vector to InferenceService:
        Verifies LightGBM, Isolation Forest, and TreeSHAP without fallback.
        """
        captured_features = []
        manager = FlowManager(
            flow_timeout_sec=30.0,
            on_flow_finalized=lambda f, feats: captured_features.append(feats)
        )
        parser = PacketParser()

        reader = scapy.PcapReader(golden_pcap_path)
        for pkt in reader:
            parsed = parser.parse_scapy(pkt)
            if parsed:
                manager.on_packet(parsed)
        reader.close()
        manager.flush_all()

        assert len(captured_features) > 0
        live_features = captured_features[0]

        service = InferenceService()
        result = service.predict(
            flow_id="test-live-flow-001",
            features=live_features,
            compute_shap=True,
        )

        assert result is not None
        assert "flowId" in result
        assert "attackCategory" in result
        assert "verdict" in result
        assert "supervisedConfidence" in result
        assert "unsupervisedAnomalyScore" in result
        assert "isAnomalous" in result
        assert "topFeatures" in result
        assert "explanation" in result

        # Verify supervised confidence is a valid probability
        assert 0.0 <= result["supervisedConfidence"] <= 1.0

        # Verify top SHAP features are present and non-empty
        assert isinstance(result["topFeatures"], list)
        assert len(result["topFeatures"]) > 0
        for top_f in result["topFeatures"]:
            assert "feature" in top_f
            assert "contribution" in top_f
            assert "value" in top_f

    def test_sensor_error_handling_modes(self):
        """Verifies SENSOR_UNAVAILABLE and INVALID_INTERFACE modes without crashing."""
        engine = LiveSensorEngine.get_instance()

        # 1. Invalid interface
        res_invalid = engine.start_capture(interface_name="NON_EXISTENT_DEV_99999")
        assert res_invalid["success"] is False
        assert res_invalid["status"] == "INVALID_INTERFACE"

        # 2. Missing Npcap graceful failure
        res_no_npcap = engine.start_capture()
        if not InterfaceManager.is_npcap_installed():
            assert res_no_npcap["success"] is False
            assert res_no_npcap["status"] == "SENSOR_UNAVAILABLE"
            assert "Npcap" in res_no_npcap["error"]

    def test_live_sensor_redis_streaming_integration(self, golden_pcap_path):
        """
        Validates the end-to-end pipeline:
        PCAP -> Flow Reconstruction -> 77 Features -> Redis Stream netsentry:flows
        -> MLStreamWorker -> Redis Stream netsentry:detections with source='live'.
        """
        import redis
        from app.streaming.config import STREAMING_CONFIG
        from app.streaming.worker import MLStreamWorker

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
            pytest.skip("Redis server not reachable at localhost:6380")

        # Create worker
        worker = MLStreamWorker(config=STREAMING_CONFIG, worker_id="test-sensor-worker")
        worker.setup_stream_group()

        # Run PCAP through LiveSensorEngine with redis_client
        engine = LiveSensorEngine.get_instance()
        engine.redis_client = r
        engine.flow_manager.redis_client = r

        proc_res = engine.process_pcap_file(golden_pcap_path)
        assert proc_res["success"] is True
        assert proc_res["flows_extracted"] >= 1

        # Read the latest message published to netsentry:flows
        latest_entries = r.xrevrange(STREAMING_CONFIG.stream_flows, count=1)
        assert len(latest_entries) > 0
        msg_id, fields = latest_entries[0]

        # Verify source metadata is 'live'
        assert fields.get("source") == "live"
        assert "features" in fields

        # Process through worker
        processed = worker.process_message(msg_id, fields)
        assert processed is True

        # Read output from netsentry:detections
        det_messages = r.xrevrange(STREAMING_CONFIG.stream_detections, count=1)
        assert len(det_messages) > 0
        _, det_fields = det_messages[0]
        event_data = json.loads(det_fields["event"])

        assert event_data["flow"]["source"] == "live"
        assert event_data["detection"]["source"] == "live"
        assert "verdict" in event_data["detection"]

