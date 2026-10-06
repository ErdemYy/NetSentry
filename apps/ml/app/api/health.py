from fastapi import APIRouter
from datetime import datetime, timezone
import sys
import platform

router = APIRouter(tags=["Health"])


@router.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "NetSentry ML Inference Engine",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "python_version": sys.version,
        "platform": platform.platform(),
        "models_loaded": {
            "supervised": False,
            "unsupervised": False,
            "explainer": False,
        },
        "phase": "PHASE_0_FOUNDATION",
    }
