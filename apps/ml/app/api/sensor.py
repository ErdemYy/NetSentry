from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.sensor.capture import LiveSensorEngine
from app.sensor.interfaces import InterfaceManager

router = APIRouter(prefix="/api/v1/sensor", tags=["Live Sensor"])


class StartCaptureRequest(BaseModel):
    interface: Optional[str] = Field(None, description="Network interface name (e.g. Wi-Fi, Ethernet). If omitted, default active interface is used.")
    filter: str = Field("ip and (tcp or udp)", description="BPF capture filter expression")


class ProcessPcapRequest(BaseModel):
    filepath: str = Field(..., description="Absolute or relative path to PCAP/PCAPNG file")


@router.get("/status")
def get_sensor_status():
    """
    Returns real-time operational status, metrics, and state of the Live Sensor subsystem.
    """
    engine = LiveSensorEngine.get_instance()
    return engine.get_status()


@router.get("/interfaces")
def get_sensor_interfaces():
    """
    Lists discovered physical/virtual network adapters on the host machine.
    Includes Npcap driver availability status.
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
    """
    engine = LiveSensorEngine.get_instance()
    iface = req.interface if req else None
    bpf = req.filter if req else "ip and (tcp or udp)"

    result = engine.start_capture(interface_name=iface, bpf_filter=bpf)
    if not result.get("success", False):
        # Do not throw 500 error; return structured operational failure code
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
    """
    engine = LiveSensorEngine.get_instance()
    result = engine.stop_capture()
    return result


@router.post("/process-pcap")
def process_pcap(req: ProcessPcapRequest):
    """
    Processes an offline PCAP/PCAPNG file through the bidirectional flow reconstruction
    and canonical 77-feature extraction engine, publishing completed flows to Redis.
    Works without Npcap or elevated privileges.
    """
    engine = LiveSensorEngine.get_instance()
    try:
        result = engine.process_pcap_file(req.filepath)
        return result
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
