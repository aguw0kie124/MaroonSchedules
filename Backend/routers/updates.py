from fastapi import APIRouter
from pydantic import BaseModel, HttpUrl
from typing import Optional
from services import update_service

router = APIRouter(prefix="/api/app", tags=["App Config"])

class PlatformVersionConfig(BaseModel):
    latestVersion: str
    minimumSupportedVersion: str
    storeUrl: str

class AppVersionConfigResponse(BaseModel):
    ios: Optional[PlatformVersionConfig] = None
    android: Optional[PlatformVersionConfig] = None

@router.get("/version-config", response_model=AppVersionConfigResponse)
def get_version_config():
    """
    Returns the application update configuration, including the latest version,
    minimum supported version, and store URLs for both iOS and Android.
    """
    config = update_service.get_app_version_config()
    return config
