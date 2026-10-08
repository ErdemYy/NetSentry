import hmac
import os
from fastapi import HTTPException, Request, status


def is_internal_auth_enabled() -> bool:
    """
    Returns True if service-to-service internal authentication is active.
    Defaults to True in production or whenever INTERNAL_SERVICE_TOKEN is provided.
    Can be explicitly disabled for local standalone development via ML_INTERNAL_AUTH_ENABLED=false.
    """
    val = os.getenv("ML_INTERNAL_AUTH_ENABLED", "").strip().lower()
    if val in ("1", "true", "yes"):
        return True
    if val in ("0", "false", "no"):
        return False
    # Safe default: enabled if token is provided or production environment
    token = os.getenv("INTERNAL_SERVICE_TOKEN", "").strip()
    return bool(token or os.getenv("NODE_ENV") == "production" or os.getenv("ENVIRONMENT") == "production")


def verify_internal_service_token(request: Request) -> bool:
    """
    FastAPI dependency enforcing that callers possess a valid internal service token.
    Blocks direct unauthorized external access to administrative/sensor endpoints.
    Accepts 'Authorization: Bearer <token>' or 'X-Internal-Service-Token: <token>'.
    """
    if not is_internal_auth_enabled():
        return True

    expected_token = os.getenv("INTERNAL_SERVICE_TOKEN", "").strip()
    if not expected_token:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server configuration error: INTERNAL_SERVICE_TOKEN is required but not set.",
        )

    auth_header = request.headers.get("Authorization", "").strip()
    custom_header = request.headers.get("X-Internal-Service-Token", "").strip()

    provided_token = ""
    if auth_header.lower().startswith("bearer "):
        provided_token = auth_header[7:].strip()
    elif custom_header:
        provided_token = custom_header

    if not provided_token or not hmac.compare_digest(provided_token, expected_token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: Valid internal service token required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return True
