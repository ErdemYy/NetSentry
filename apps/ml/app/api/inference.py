from fastapi import APIRouter, HTTPException, status
from app.schemas.flow import NetworkFlowSchema, DetectionResponseSchema

router = APIRouter(prefix="/api/v1", tags=["Inference"])


@router.post(
    "/predict",
    response_model=DetectionResponseSchema,
    summary="Inference endpoint for network flow classification and anomaly scoring",
)
def predict_flow(flow: NetworkFlowSchema):
    """
    In Phase 0, models are uninitialized. Real inference will be activated
    in Phase 1 after baseline training on the validated CIC-IDS2017 dataset.
    """
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="ML models are pending Phase 1 dataset ingestion and training. Real weights not yet mounted.",
    )
