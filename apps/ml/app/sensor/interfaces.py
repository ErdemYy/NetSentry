import os
import platform
import socket
from typing import List, Dict, Any, Optional

try:
    import scapy.all as scapy
    SCAPY_AVAILABLE = True
except ImportError:
    SCAPY_AVAILABLE = False


class InterfaceManager:
    """
    Manages platform-safe discovery of network interfaces on Windows and Linux.
    Reports driver availability (Npcap) without exposing sensitive payloads or credentials.
    """

    @staticmethod
    def is_npcap_installed() -> bool:
        """
        Determines whether Npcap / libpcap packet capture driver is installed and accessible.
        """
        if not SCAPY_AVAILABLE:
            return False

        # 1. Scapy's internal conf.use_pcap check
        if getattr(scapy.conf, "use_pcap", False):
            return True

        # 2. Check Windows System32 / Npcap dlls
        if platform.system() == "Windows":
            system32 = os.environ.get("SystemRoot", r"C:\Windows") + r"\System32"
            candidates = [
                os.path.join(system32, "wpcap.dll"),
                os.path.join(system32, "Npcap", "wpcap.dll"),
                os.path.join(system32, "Packet.dll"),
                os.path.join(system32, "Npcap", "Packet.dll"),
            ]
            for dll in candidates:
                if os.path.exists(dll):
                    return True

        return False

    @staticmethod
    def list_interfaces() -> List[Dict[str, Any]]:
        """
        Enumerates all available network adapters with safe operational metadata.
        """
        interfaces: List[Dict[str, Any]] = []

        if SCAPY_AVAILABLE:
            try:
                for idx, iface in enumerate(scapy.conf.ifaces.values()):
                    ip = getattr(iface, "ip", None) or "0.0.0.0"
                    mac = getattr(iface, "mac", None) or "00:00:00:00:00:00"
                    name = getattr(iface, "name", f"iface-{idx}")
                    description = getattr(iface, "description", name)

                    is_loopback = ip == "127.0.0.1" or "loopback" in description.lower()
                    is_active = bool(ip and ip != "0.0.0.0" and not ip.startswith("169.254"))

                    interfaces.append({
                        "index": idx,
                        "name": name,
                        "description": description,
                        "ip": ip,
                        "mac": mac,
                        "status": "UP" if is_active else "DOWN",
                        "is_loopback": is_loopback,
                    })
                return interfaces
            except Exception:
                pass

        # Fallback using standard Python socket
        try:
            hostname = socket.gethostname()
            local_ip = socket.gethostbyname(hostname)
            interfaces.append({
                "index": 0,
                "name": "default",
                "description": f"Host Primary Adapter ({hostname})",
                "ip": local_ip,
                "mac": "00:00:00:00:00:00",
                "status": "UP",
                "is_loopback": False,
            })
        except Exception:
            pass

        return interfaces

    @staticmethod
    def get_default_interface() -> Optional[Dict[str, Any]]:
        """
        Finds the primary active UP interface suitable for packet capture.
        """
        ifaces = InterfaceManager.list_interfaces()
        # Prefer non-loopback UP interface
        for iface in ifaces:
            if iface["status"] == "UP" and not iface["is_loopback"]:
                return iface
        # Fallback to any UP interface
        for iface in ifaces:
            if iface["status"] == "UP":
                return iface
        return ifaces[0] if ifaces else None
