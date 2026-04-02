from fastapi import APIRouter, UploadFile, File, HTTPException
import os
import uuid
import shutil
from typing import Dict

router = APIRouter(prefix="/upload", tags=["upload"])

# Base directory for uploads
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "static", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Base URL for serving files (in production this should be the public domain)
# For local dev/internal use, we return the relative path or host-based URL
BASE_URL = os.getenv("APP_URL", "http://10.246.145.251:8000")

def get_file_extension(filename: str) -> str:
    return os.path.splitext(filename)[1].lower()

@router.post("/image")
async def upload_image(file: UploadFile = File(...)) -> Dict[str, str]:
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    ext = get_file_extension(file.filename)
    if not ext:
        ext = ".jpg"
    
    unique_filename = f"{uuid.uuid4()}{ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
    return {"status": "success", "url": f"{BASE_URL}/uploads/{unique_filename}", "filename": unique_filename}

@router.post("/file")
@router.post("/video")
async def upload_video(file: UploadFile = File(...)) -> Dict[str, str]:
    # Support common video types or general files
    ext = get_file_extension(file.filename)
    unique_filename = f"{uuid.uuid4()}{ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
    return {"status": "success", "url": f"{BASE_URL}/uploads/{unique_filename}", "filename": unique_filename}
