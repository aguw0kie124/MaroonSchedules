from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
import os
import uuid
from typing import Dict
from auth.clerk_middleware import require_auth

router = APIRouter(prefix="/upload", tags=["upload"])

# Store uploaded media outside the repo by default so user content lives with backend data,
# not in the source tree. This can be overridden in production with UPLOAD_DIR.
DEFAULT_UPLOAD_ROOT = os.path.join(os.path.expanduser("~"), ".maroonlife")
UPLOAD_DIR = os.getenv("UPLOAD_DIR", os.path.join(DEFAULT_UPLOAD_ROOT, "uploads"))
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Base URL for serving files (in production this should be the public domain)
# For local dev/internal use, we return the relative path or host-based URL
BASE_URL = os.getenv("APP_URL", "http://127.0.0.1:8000").rstrip("/")
MAX_IMAGE_BYTES = int(os.getenv("MAX_IMAGE_UPLOAD_BYTES", str(10 * 1024 * 1024)))
MAX_VIDEO_BYTES = int(os.getenv("MAX_VIDEO_UPLOAD_BYTES", str(50 * 1024 * 1024)))

ALLOWED_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/heic": ".heic",
    "image/heif": ".heif",
}

ALLOWED_VIDEO_TYPES = {
    "video/mp4": ".mp4",
    "video/quicktime": ".mov",
    "video/webm": ".webm",
}

def get_file_extension(filename: str) -> str:
    return os.path.splitext(filename)[1].lower()


async def _save_upload(file: UploadFile, allowed_types: dict[str, str], max_bytes: int) -> Dict[str, str]:
    content_type = (file.content_type or "").lower()
    if content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Unsupported file type")

    ext = allowed_types[content_type] or get_file_extension(file.filename or "")
    unique_filename = f"{uuid.uuid4()}{ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    total_bytes = 0

    try:
        with open(file_path, "wb") as buffer:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                total_bytes += len(chunk)
                if total_bytes > max_bytes:
                    raise HTTPException(status_code=413, detail="File is too large")
                buffer.write(chunk)
    except HTTPException:
        if os.path.exists(file_path):
            os.remove(file_path)
        raise
    except Exception as e:
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        await file.close()

    return {"status": "success", "url": f"{BASE_URL}/uploads/{unique_filename}", "filename": unique_filename}

@router.post("/image")
async def upload_image(file: UploadFile = File(...), _auth_user_id: str = Depends(require_auth)) -> Dict[str, str]:
    return await _save_upload(file, ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES)

@router.post("/file")
@router.post("/video")
async def upload_video(file: UploadFile = File(...), _auth_user_id: str = Depends(require_auth)) -> Dict[str, str]:
    return await _save_upload(file, ALLOWED_VIDEO_TYPES, MAX_VIDEO_BYTES)
