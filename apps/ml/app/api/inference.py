from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.api.internal_auth import verify_internal_service_token
from app.inference.service import InferenceService

router = APIRouter(
    prefix="/api/v1",
    tags=["Inference"],
    dependencies=[Depends(verify_internal_service_token)],
)
inference_service = InferenceService()


class PredictRequest(BaseModel):
    flow_id: str = Field(..., description="Unique flow identifier")
    features: Dict[str, Any] = Field(..., description="Key-value mapping of all 77 flow attributes")
    compute_shap: bool = Field(default=True, description="Whether to calculate SHAP feature attributions")
    timestamp: Optional[str] = Field(default=None, description="ISO timestamp")


@router.post(
    "/predict",
    summary="Real-time flow classification and anomaly scoring",
    status_code=status.HTTP_200_OK,
)
def predict_flow(request: PredictRequest):
    try:
        result = inference_service.predict(
            flow_id=request.flow_id,
            features=request.features,
            compute_shap=request.compute_shap,
            timestamp=request.timestamp,
        )
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Inference execution failed: {str(e)}",
        )
