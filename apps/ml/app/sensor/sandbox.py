import os
from pathlib import Path
from typing import Optional, Set

ALLOWED_PCAP_EXTENSIONS: Set[str] = {".pcap", ".pcapng"}


def get_pcap_root() -> Path:
    """
    Returns the resolved canonical directory path for sandboxed PCAP file processing.
    Defaults to apps/ml/data/pcap if NETSENTRY_PCAP_ROOT environment variable is unset.
    """
    env_root = os.getenv("NETSENTRY_PCAP_ROOT", "").strip()
    if env_root:
        root_path = Path(env_root).resolve()
    else:
        # Default: apps/ml/data/pcap
        root_path = (Path(__file__).resolve().parent.parent.parent / "data" / "pcap").resolve()

    root_path.mkdir(parents=True, exist_ok=True)
    return root_path


def resolve_and_validate_pcap_path(
    filename_or_path: str,
    pcap_root: Optional[Path] = None,
) -> Path:
    """
    Canonicalizes and strictly validates a requested PCAP/PCAPNG file against the sandboxed directory.

    Rejects:
    - Path traversal attempts ('..')
    - Absolute or relative paths resolving outside pcap_root
    - Directories
    - Unsupported extensions (only .pcap and .pcapng permitted)
    - Symlinks pointing outside the sandbox root
    """
    raw_str = (filename_or_path or "").strip()
    if not raw_str:
        raise ValueError("Filename or path must be specified.")

    # Guard against obvious path traversal tokens
    if ".." in raw_str.replace("\\", "/").split("/"):
        raise ValueError("Path traversal ('..') is strictly prohibited.")

    root = (pcap_root or get_pcap_root()).resolve()

    # If the caller passed an absolute path, resolve directly; otherwise treat as filename within sandbox root
    candidate = Path(raw_str)
    if candidate.is_absolute():
        resolved_candidate = candidate.resolve()
    else:
        resolved_candidate = (root / candidate).resolve()

    # Sandboxing boundary verification
    try:
        if not resolved_candidate.is_relative_to(root):
            raise ValueError("Access denied: File resolves outside the configured PCAP sandbox.")
    except AttributeError:
        # Fallback for older python Pathlib edge cases
        if not str(resolved_candidate).startswith(str(root)):
            raise ValueError("Access denied: File resolves outside the configured PCAP sandbox.")

    # Check extension before filesystem access
    if resolved_candidate.suffix.lower() not in ALLOWED_PCAP_EXTENSIONS:
        raise ValueError(
            f"Unsupported file extension '{resolved_candidate.suffix}'. Allowed: {', '.join(sorted(ALLOWED_PCAP_EXTENSIONS))}"
        )

    # Check existence
    if not resolved_candidate.exists():
        raise FileNotFoundError(f"PCAP file not found: {resolved_candidate.name}")

    # Reject directories
    if resolved_candidate.is_dir():
        raise ValueError("Target path is a directory, not a valid PCAP file.")

    return resolved_candidate
