from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.api.internal_auth import verify_internal_service_token
from app.sensor.capture import LiveSensorEngine
from app.sensor.interfaces import InterfaceManager
from app.sensor.sandbox import resolve_and_validate_pcap_path

router = APIRouter(
    prefix="/api/v1/sensor",
    tags=["Live Sensor"],
    dependencies=[Depends(verify_internal_service_token)],
)


class StartCaptureRequest(BaseModel):
    interface: Optional[str] = Field(None, description="Network interface name (e.g. Wi-Fi, Ethernet). If omitted, default active interface is used.")
    filter: str = Field("ip and (tcp or udp)", description="BPF capture filter expression")


class ProcessPcapRequest(BaseModel):
    filename: Optional[str] = Field(None, description="Filename within the sandboxed PCAP directory (e.g., sample.pcap)")
    filepath: Optional[str] = Field(None, description="Alias for filename (strictly sandboxed)")


@router.get("/status")
def get_sensor_status():
    """
    Returns real-time operational status, metrics, and state of the Live Sensor subsystem.
    Protected by internal service authentication.
    """
    engine = LiveSensorEngine.get_instance()
    return engine.get_status()


@router.get("/interfaces")
def get_sensor_interfaces():
    """
    Lists discovered physical/virtual network adapters on the host machine.
    Includes Npcap driver availability status.
    Protected by internal service authentication.
    """
    interfaces = InterfaceManager.list_interfaces()
    npcap_installed = InterfaceManager.is_npcap_installed()
    default_iface = InterfaceManager.get_default_interface()

    return {
        "npcap_installed": npcap_installed,
        "default_interface": default_iface["name"] if default_iface else None,
        "interfaces_count": len(interfaces),
        "interfaces": interfaces,
    }


@router.post("/start")
def start_capture(req: Optional[StartCaptureRequest] = None):
    """
    Starts live network packet capture on designated interface.
    Gracefully returns SENSOR_UNAVAILABLE if Npcap is missing or CAPTURE_PERMISSION_DENIED.
    Protected by internal service authentication.
    """
    engine = LiveSensorEngine.get_instance()
    iface = req.interface if req else None
    bpf = req.filter if req else "ip and (tcp or udp)"

    result = engine.start_capture(interface_name=iface, bpf_filter=bpf)
    if not result.get("success", False):
        return {
            "success": False,
            "status": result.get("status"),
            "error": result.get("error"),
            "telemetry": engine.get_status(),
        }

    return result


@router.post("/stop")
def stop_capture():
    """
    Stops live network packet capture and flushes pending flows to Redis.
    Protected by internal service authentication.
    """
    engine = LiveSensorEngine.get_instance()
    result = engine.stop_capture()
    return result


@router.post("/process-pcap")
def process_pcap(req: ProcessPcapRequest):
    """
    Processes an offline PCAP/PCAPNG file through the bidirectional flow reconstruction
    and canonical 77-feature extraction engine, publishing completed flows to Redis.
    Strictly restricted to sandboxed PCAP files (NETSENTRY_PCAP_ROOT).
    Protected by internal service authentication.
    """
    target = req.filename or req.filepath
    if not target:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either 'filename' or 'filepath' must be provided.",
        )

    try:
        safe_path = resolve_and_validate_pcap_path(target)
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Security violation / Invalid PCAP parameter: {str(ve)}",
        )
    except FileNotFoundError as fnf:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(fnf),
        )

    engine = LiveSensorEngine.get_instance()
    try:
        result = engine.process_pcap_file(str(safe_path))
        # Mask absolute server filesystem path from response
        result["filename"] = safe_path.name
        if "pcap_file" in result:
            result["pcap_file"] = safe_path.name
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"PCAP processing engine error: {str(e)}",
        )
