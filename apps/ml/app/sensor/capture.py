import logging
import os
import threading
import time
from typing import Dict, Any, Optional

import redis

from app.sensor.interfaces import InterfaceManager
from app.sensor.packet_parser import PacketParser
from app.sensor.flow_manager import FlowManager
from app.streaming.config import STREAMING_CONFIG

logger = logging.getLogger("NetSentryLiveSensor")

try:
    import scapy.all as scapy
    SCAPY_AVAILABLE = True
except ImportError:
    SCAPY_AVAILABLE = False


class LiveSensorEngine:
    """
    Live Network Sensor Subsystem (Phase 6).
    Captures live network packets or reads PCAP files, reconstructs bidirectional flows,
    extracts canonical 77-feature vectors, and injects them into Redis Streams for ML inference.
    """

    _instance: Optional["LiveSensorEngine"] = None
    _lock = threading.Lock()

    @classmethod
    def get_instance(cls) -> "LiveSensorEngine":
        with cls._lock:
            if cls._instance is None:
                cls._instance = cls()
            return cls._instance

    def __init__(self, config=STREAMING_CONFIG):
        self.config = config
        self.parser = PacketParser()

        # Connect to Redis for publishing live flows
        try:
            self.redis_client = redis.Redis(
                host=self.config.redis_host,
                port=self.config.redis_port,
                password=self.config.redis_password or None,
                db=self.config.redis_db,
                decode_responses=True,
            )
        except Exception as e:
            logger.warning(f"Could not connect to Redis: {e}")
            self.redis_client = None

        flow_timeout = float(os.environ.get("NETSENTRY_FLOW_TIMEOUT_MS", 30_000)) / 1000.0
        max_flows = int(os.environ.get("NETSENTRY_MAX_ACTIVE_FLOWS", 10_000))

        self.flow_manager = FlowManager(
            flow_timeout_sec=flow_timeout,
            max_active_flows=max_flows,
            redis_client=self.redis_client,
            stream_name=self.config.stream_flows,
        )

        # Operational state
        self.state: str = "STOPPED"  # STOPPED, RUNNING, SENSOR_UNAVAILABLE, CAPTURE_PERMISSION_DENIED, INVALID_INTERFACE
        self.active_interface: Optional[str] = None
        self.active_filter: str = "ip and (tcp or udp)"
        self.error_message: Optional[str] = None

        # Background threads
        self._sniff_thread: Optional[threading.Thread] = None
        self._sweep_thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()

    def start_capture(
        self,
        interface_name: Optional[str] = None,
        bpf_filter: str = "ip and (tcp or udp)",
    ) -> Dict[str, Any]:
        """
        Initiates live packet capture on the designated network interface.
        Handles missing Npcap or permission errors gracefully without crashing.
        """
        if self.state == "RUNNING":
            return {"success": True, "message": "Sensor is already running", "status": self.get_status()}

        # 1. Interface resolution
        if not interface_name:
            default_if = InterfaceManager.get_default_interface()
            if not default_if:
                self.state = "INVALID_INTERFACE"
                self.error_message = "No active network interface found on this host."
                return {"success": False, "status": self.state, "error": self.error_message}
            interface_name = default_if["name"]

        # Validate interface
        all_ifaces = InterfaceManager.list_interfaces()
        matched = next((i for i in all_ifaces if i["name"].lower() == interface_name.lower()), None)
        if not matched:
            self.state = "INVALID_INTERFACE"
            self.error_message = f"Interface '{interface_name}' not found."
            return {"success": False, "status": self.state, "error": self.error_message}

        self.active_interface = matched["name"]
        self.active_filter = bpf_filter
        self.error_message = None

        # 2. Check Npcap availability
        has_npcap = InterfaceManager.is_npcap_installed()
        if not has_npcap:
            self.state = "SENSOR_UNAVAILABLE"
            self.error_message = (
                "Npcap kernel packet capture driver is not installed on this Windows system. "
                "Install Npcap from https://npcap.com to enable live promiscuous NIC capture. "
                "Offline PCAP stream processing remains available."
            )
            logger.warning(f"Sensor start halted: {self.error_message}")
            return {"success": False, "status": self.state, "error": self.error_message}

        # 3. Launch capture threads
        self._stop_event.clear()

        def _sweep_worker():
            while not self._stop_event.is_set():
                time.sleep(1.0)
                try:
                    self.flow_manager.check_timeouts(time.time())
                except Exception as e:
                    logger.error(f"Timeout sweep error: {e}")

        def _sniff_worker():
            logger.info(f"Starting Scapy sniffing on interface '{self.active_interface}' [filter='{self.active_filter}']")
            try:
                scapy.sniff(
                    iface=self.active_interface,
                    filter=self.active_filter,
                    prn=self._on_scapy_packet,
                    stop_filter=lambda _: self._stop_event.is_set(),
                    store=False,
                )
            except PermissionError as pe:
                self.state = "CAPTURE_PERMISSION_DENIED"
                self.error_message = f"Insufficient privileges to capture packets: {pe}. Run as Administrator."
                logger.error(self.error_message)
            except Exception as e:
                self.state = "SENSOR_UNAVAILABLE"
                self.error_message = f"Packet capture runtime error: {e}"
                logger.error(self.error_message)

        try:
            self._sweep_thread = threading.Thread(target=_sweep_worker, daemon=True, name="SensorSweepThread")
            self._sweep_thread.start()

            self._sniff_thread = threading.Thread(target=_sniff_worker, daemon=True, name="SensorSniffThread")
            self._sniff_thread.start()

            self.state = "RUNNING"
            return {"success": True, "status": self.get_status()}

        except Exception as e:
            self.state = "SENSOR_UNAVAILABLE"
            self.error_message = str(e)
            return {"success": False, "status": self.state, "error": str(e)}

    def stop_capture(self) -> Dict[str, Any]:
        """
        Stops live packet capture and flushes all pending flows to Redis.
        """
        if self.state != "RUNNING":
            return {"success": True, "message": "Sensor is not running", "status": self.get_status()}

        self._stop_event.set()
        self.state = "STOPPED"

        # Flush active flows
        flushed = self.flow_manager.flush_all()
        logger.info(f"Sensor stopped. Flushed {len(flushed)} active flows to Redis.")

        return {
            "success": True,
            "message": f"Sensor stopped. Flushed {len(flushed)} flows.",
            "status": self.get_status(),
        }

    def process_pcap_file(self, filepath: str) -> Dict[str, Any]:
        """
        Processes an offline PCAP/PCAPNG file, feeding packets into the bidirectional
        flow reconstruction engine and outputting canonical 77-feature flows into Redis.
        Does not require Npcap or root permissions.
        """
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"PCAP file not found: {filepath}")

        if not SCAPY_AVAILABLE:
            raise RuntimeError("Scapy is required for PCAP processing.")

        t0 = time.perf_counter()
        pkt_count = 0
        initial_completed = self.flow_manager.completed_flows_count

        logger.info(f"Reading PCAP file: {filepath}...")
        reader = scapy.PcapReader(filepath)

        for scapy_pkt in reader:
            pkt_count += 1
            self._on_scapy_packet(scapy_pkt)

        reader.close()

        # Flush all remaining active flows
        self.flow_manager.flush_all()
        elapsed = time.perf_counter() - t0
        total_extracted = self.flow_manager.completed_flows_count - initial_completed

        return {
            "success": True,
            "pcap_file": filepath,
            "packets_processed": pkt_count,
            "flows_extracted": total_extracted,
            "elapsed_seconds": round(elapsed, 4),
            "flows_per_second": round(total_extracted / max(elapsed, 0.001), 2),
        }

    def _on_scapy_packet(self, scapy_pkt: Any):
        """Callback for Scapy packet arrival."""
        parsed = self.parser.parse_scapy(scapy_pkt)
        if parsed is not None:
            self.flow_manager.on_packet(parsed)

    def get_status(self) -> Dict[str, Any]:
        """Returns comprehensive status telemetry for API and Dashboard integration."""
        metrics = self.flow_manager.metrics
        return {
            "sensor_enabled": self.state == "RUNNING",
            "capture_state": self.state,
            "capture_interface": self.active_interface or "NONE",
            "capture_filter": self.active_filter,
            "npcap_installed": InterfaceManager.is_npcap_installed(),
            "packets_observed": metrics["packets_observed"],
            "flows_active": metrics["flows_active"],
            "flows_completed": metrics["flows_completed"],
            "flows_expired": metrics["flows_expired"],
            "flows_dropped": metrics["flows_dropped"],
            "feature_extraction_errors": metrics["feature_extraction_errors"],
            "last_packet_at": metrics["last_packet_at"],
            "last_flow_at": metrics["last_flow_at"],
            "error_message": self.error_message,
        }
