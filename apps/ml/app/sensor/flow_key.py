from enum import Enum
from typing import Tuple, NamedTuple


class FlowDirection(str, Enum):
    FORWARD = "FORWARD"
    BACKWARD = "BACKWARD"


class ConversationEndpoint(NamedTuple):
    ip: str
    port: int


class FlowKey:
    """
    Deterministic Bidirectional Flow Key representation for IPv4 TCP/UDP conversations.
    Maps A -> B and B -> A into the exact same canonical conversation.
    """

    def __init__(
        self,
        src_ip: str,
        src_port: int,
        dst_ip: str,
        dst_port: int,
        protocol: str,
    ):
        self.src_ip = src_ip
        self.src_port = int(src_port)
        self.dst_ip = dst_ip
        self.dst_port = int(dst_port)
        self.protocol = protocol.upper()

        # Canonical ordering for conversation grouping: (min_endpoint, max_endpoint, protocol)
        endpoint_a = (self.src_ip, self.src_port)
        endpoint_b = (self.dst_ip, self.dst_port)
        if endpoint_a <= endpoint_b:
            self._canonical_id = (endpoint_a, endpoint_b, self.protocol)
        else:
            self._canonical_id = (endpoint_b, endpoint_a, self.protocol)

    @property
    def canonical_id(self) -> Tuple[Tuple[str, int], Tuple[str, int], str]:
        """Unique hashable identifier representing the bidirectional conversation."""
        return self._canonical_id

    def determine_direction(self, pkt_src_ip: str, pkt_src_port: int) -> FlowDirection:
        """
        Determines whether the incoming packet is FORWARD or BACKWARD relative to the conversation initiator.
        The very first packet observed in the flow establishes the initiator (FORWARD direction).
        """
        if self.src_ip == pkt_src_ip and self.src_port == int(pkt_src_port):
            return FlowDirection.FORWARD
        return FlowDirection.BACKWARD

    def __hash__(self) -> int:
        return hash(self._canonical_id)

    def __eq__(self, other) -> bool:
        if not isinstance(other, FlowKey):
            return False
        return self._canonical_id == other._canonical_id

    def __repr__(self) -> str:
        return f"FlowKey({self.src_ip}:{self.src_port} <-> {self.dst_ip}:{self.dst_port} [{self.protocol}])"
