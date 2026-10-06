import os
import platform
import sys
from datetime import datetime, timezone
from fastapi import APIRouter
import redis

from app.inference.model_loader import ModelArtifactLoader

router = APIRouter(tags=["Health"])


@router.get("/health")
def health_check():
    # 1. Check ML Models status
    try:
        loader = ModelArtifactLoader.get_instance()
        models_loaded = {
            "supervised": loader.supervised_model is not None,
            "unsupervised": loader.anomaly_model is not None,
            "explainer": loader.shap_explainer is not None,
            "scaler": loader.scaler is not None,
            "classes_count": len(loader.classes),
            "anomaly_threshold": loader.anomaly_threshold,
        }
        all_models_ready = all([
            models_loaded["supervised"],
            models_loaded["unsupervised"],
            models_loaded["scaler"],
        ])
    except Exception as e:
        models_loaded = {"error": str(e)}
        all_models_ready = False

    # 2. Check Real Redis connection
    redis_host = os.getenv("REDIS_HOST", "localhost")
    redis_port = int(os.getenv("REDIS_PORT", "6380"))
    try:
        r = redis.Redis(host=redis_host, port=redis_port, socket_timeout=1.0)
        redis_connected = bool(r.ping())
    except Exception:
        redis_connected = False

    return {
        "status": "ok" if (all_models_ready and redis_connected) else "degraded",
        "service": "NetSentry ML Inference Engine",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "python_version": sys.version.split(" ")[0],
        "platform": platform.platform(),
        "phase": "PHASE_2_REALTIME_INFERENCE",
        "models_ready": all_models_ready,
        "models_loaded": models_loaded,
        "redis_connected": redis_connected,
        "redis_host": f"{redis_host}:{redis_port}",
    }
