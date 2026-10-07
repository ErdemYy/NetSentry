import struct
import time
from typing import Optional, Dict, Any


class ParsedPacket:
    """
    Lightweight, privacy-preserving packet descriptor containing only
    statistical and structural protocol metadata. Raw payloads are NEVER retained.
    """

    def __init__(
        self,
        timestamp: float,
        src_ip: str,
        dst_ip: str,
        src_port: int,
        dst_port: int,
        protocol: str,
        wire_length: int = 60,
        ip_header_length: int = 20,
        transport_header_length: int = 20,
        payload_length: int = 0,
        tcp_flags: Optional[Dict[str, int]] = None,
        tcp_window: int = 0,
        **kwargs,
    ):
        self.timestamp = timestamp
        self.src_ip = src_ip
        self.dst_ip = dst_ip
        self.src_port = int(src_port)
        self.dst_port = int(dst_port)
        self.protocol = protocol.upper()
        self.wire_length = wire_length or kwargs.get("wire_len", 60)
        self.ip_header_length = ip_header_length or kwargs.get("ip_header_len", 20)
        self.transport_header_length = transport_header_length or kwargs.get("tcp_header_len", 20)
        self.header_length = self.ip_header_length + self.transport_header_length
        self.payload_length = payload_length

        flags = tcp_flags or {
            "FIN": kwargs.get("fin", 0),
            "SYN": kwargs.get("syn", 0),
            "RST": kwargs.get("rst", 0),
            "PSH": kwargs.get("psh", 0),
            "ACK": kwargs.get("ack", 0),
            "URG": kwargs.get("urg", 0),
            "ECE": kwargs.get("ece", 0),
            "CWR": kwargs.get("cwr", 0),
        }
        self.tcp_flags = flags
        self.tcp_window = tcp_window or kwargs.get("window_size", 0)

    @property
    def syn(self) -> int:
        return self.tcp_flags.get("SYN", 0)

    @property
    def fin(self) -> int:
        return self.tcp_flags.get("FIN", 0)

    @property
    def rst(self) -> int:
        return self.tcp_flags.get("RST", 0)

    @property
    def psh(self) -> int:
        return self.tcp_flags.get("PSH", 0)

    @property
    def ack(self) -> int:
        return self.tcp_flags.get("ACK", 0)

    @property
    def urg(self) -> int:
        return self.tcp_flags.get("URG", 0)

    @property
    def window_size(self) -> int:
        return self.tcp_window

    @property
    def is_tcp_fin_or_rst(self) -> bool:
        return bool(self.tcp_flags.get("FIN", 0) or self.tcp_flags.get("RST", 0))

    def __repr__(self) -> str:
        return (
            f"ParsedPacket({self.src_ip}:{self.src_port} -> {self.dst_ip}:{self.dst_port} "
            f"[{self.protocol}] len={self.wire_length})"
        )


class PacketParser:
    """
    High-performance parser for extracting flow statistics from network packets.
    Accepts both Scapy packet instances and raw Ethernet/IP byte buffers.
    """

    def __init__(self):
        self.total_packets_parsed = 0
        self.unsupported_packets_count = 0
        self.parse_errors_count = 0

    def parse_scapy(self, pkt: Any) -> Optional[ParsedPacket]:
        """Parses a Scapy Packet instance into a ParsedPacket."""
        try:
            self.total_packets_parsed += 1

            # Require IPv4 layer
            if not pkt.haslayer("IP"):
                self.unsupported_packets_count += 1
                return None

            ip_layer = pkt["IP"]
            src_ip = ip_layer.src
            dst_ip = ip_layer.dst
            ip_header_len = int(ip_layer.ihl) * 4 if (getattr(ip_layer, "ihl", None) is not None) else 20
            wire_len = int(ip_layer.len) if (getattr(ip_layer, "len", None) is not None) else len(bytes(ip_layer))
            pkt_time = float(pkt.time) if (getattr(pkt, "time", None) is not None) else time.time()

            # TCP
            if pkt.haslayer("TCP"):
                tcp_layer = pkt["TCP"]
                src_port = int(tcp_layer.sport)
                dst_port = int(tcp_layer.dport)
                data_offset = int(tcp_layer.dataofs) * 4 if (getattr(tcp_layer, "dataofs", None) is not None) else 20
                payload_len = max(0, wire_len - (ip_header_len + data_offset))

                # Flags
                raw_flags = int(tcp_layer.flags) if (getattr(tcp_layer, "flags", None) is not None) else 0
                flags = {
                    "FIN": 1 if raw_flags & 0x01 else 0,
                    "SYN": 1 if raw_flags & 0x02 else 0,
                    "RST": 1 if raw_flags & 0x04 else 0,
                    "PSH": 1 if raw_flags & 0x08 else 0,
                    "ACK": 1 if raw_flags & 0x10 else 0,
                    "URG": 1 if raw_flags & 0x20 else 0,
                    "ECE": 1 if raw_flags & 0x40 else 0,
                    "CWR": 1 if raw_flags & 0x80 else 0,
                }
                window = int(tcp_layer.window) if (getattr(tcp_layer, "window", None) is not None) else 0

                return ParsedPacket(
                    timestamp=pkt_time,
                    src_ip=src_ip,
                    dst_ip=dst_ip,
                    src_port=src_port,
                    dst_port=dst_port,
                    protocol="TCP",
                    wire_length=wire_len,
                    ip_header_length=ip_header_len,
                    transport_header_length=data_offset,
                    payload_length=payload_len,
                    tcp_flags=flags,
                    tcp_window=window,
                )

            # UDP
            elif pkt.haslayer("UDP"):
                udp_layer = pkt["UDP"]
                src_port = int(udp_layer.sport)
                dst_port = int(udp_layer.dport)
                udp_header_len = 8
                payload_len = max(0, wire_len - (ip_header_len + udp_header_len))

                return ParsedPacket(
                    timestamp=pkt_time,
                    src_ip=src_ip,
                    dst_ip=dst_ip,
                    src_port=src_port,
                    dst_port=dst_port,
                    protocol="UDP",
                    wire_length=wire_len,
                    ip_header_length=ip_header_len,
                    transport_header_length=udp_header_len,
                    payload_length=payload_len,
                    tcp_flags={k: 0 for k in ["FIN", "SYN", "RST", "PSH", "ACK", "URG", "ECE", "CWR"]},
                    tcp_window=0,
                )

            else:
                self.unsupported_packets_count += 1
                return None

        except Exception:
            self.parse_errors_count += 1
            return None

    def parse_raw_ip(self, raw_bytes: bytes, timestamp: Optional[float] = None) -> Optional[ParsedPacket]:
        """
        Parses raw IPv4 bytes (e.g. from raw socket SIO_RCVALL or stripped ethernet frames).
        """
        try:
            self.total_packets_parsed += 1
            pkt_time = timestamp if timestamp is not None else time.time()

            if len(raw_bytes) < 20:
                self.parse_errors_count += 1
                return None

            # IPv4 Header
            v_ihl = raw_bytes[0]
            version = v_ihl >> 4
            if version != 4:
                self.unsupported_packets_count += 1
                return None

            ihl = (v_ihl & 0x0F) * 4
            total_len = struct.unpack("!H", raw_bytes[2:4])[0]
            protocol_num = raw_bytes[9]
            src_ip = ".".join(str(b) for b in raw_bytes[12:16])
            dst_ip = ".".join(str(b) for b in raw_bytes[16:20])

            if protocol_num == 6:  # TCP
                tcp_offset = ihl
                if len(raw_bytes) < tcp_offset + 20:
                    self.parse_errors_count += 1
                    return None

                src_port, dst_port = struct.unpack("!HH", raw_bytes[tcp_offset : tcp_offset + 4])
                tcp_header_len = ((raw_bytes[tcp_offset + 12] >> 4) & 0x0F) * 4
                flags_byte = raw_bytes[tcp_offset + 13]
                flags_high = raw_bytes[tcp_offset + 12] & 0x01  # NS

                flags = {
                    "FIN": 1 if flags_byte & 0x01 else 0,
                    "SYN": 1 if flags_byte & 0x02 else 0,
                    "RST": 1 if flags_byte & 0x04 else 0,
                    "PSH": 1 if flags_byte & 0x08 else 0,
                    "ACK": 1 if flags_byte & 0x10 else 0,
                    "URG": 1 if flags_byte & 0x20 else 0,
                    "ECE": 1 if flags_byte & 0x40 else 0,
                    "CWR": 1 if flags_byte & 0x80 else 0,
                }
                window_size = struct.unpack("!H", raw_bytes[tcp_offset + 14 : tcp_offset + 16])[0]
                payload_len = max(0, total_len - (ihl + tcp_header_len))

                return ParsedPacket(
                    timestamp=pkt_time,
                    src_ip=src_ip,
                    dst_ip=dst_ip,
                    src_port=src_port,
                    dst_port=dst_port,
                    protocol="TCP",
                    wire_length=total_len,
                    ip_header_length=ihl,
                    transport_header_length=tcp_header_len,
                    payload_length=payload_len,
                    tcp_flags=flags,
                    tcp_window=window_size,
                )

            elif protocol_num == 17:  # UDP
                udp_offset = ihl
                if len(raw_bytes) < udp_offset + 8:
                    self.parse_errors_count += 1
                    return None

                src_port, dst_port, udp_len = struct.unpack("!HHH", raw_bytes[udp_offset : udp_offset + 6])
                payload_len = max(0, udp_len - 8)

                return ParsedPacket(
                    timestamp=pkt_time,
                    src_ip=src_ip,
                    dst_ip=dst_ip,
                    src_port=src_port,
                    dst_port=dst_port,
                    protocol="UDP",
                    wire_length=total_len,
                    ip_header_length=ihl,
                    transport_header_length=8,
                    payload_length=payload_len,
                    tcp_flags={k: 0 for k in ["FIN", "SYN", "RST", "PSH", "ACK", "URG", "ECE", "CWR"]},
                    tcp_window=0,
                )

            else:
                self.unsupported_packets_count += 1
                return None

        except Exception:
            self.parse_errors_count += 1
            return None
