
import os
import secrets
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import Header, HTTPException, Request

_THIS_DIR = Path(__file__).resolve().parent
# Optional Backend/.env for local overrides; repo-root .env wins (same file Expo uses).
load_dotenv(_THIS_DIR / ".env", override=False)
load_dotenv(_THIS_DIR.parent / ".env", override=True)


def _get_expected_api_key() -> str:
    # Prefer EXPO_PUBLIC_API_KEY so one value in repo-root .env matches the bundled app.
    api_key = os.getenv("EXPO_PUBLIC_API_KEY", "").strip() or os.getenv("API_KEY", "").strip()
    if not api_key:
        raise HTTPException(status_code=500, detail="Missing required environment variable: API_KEY")
    return api_key


def require_api_key(
    request: Request,
    x_api_key: Optional[str] = Header(default=None, alias="x-api-key"),
) -> None:
    if getattr(request.state, "api_key_verified", False):
        return

    expected_api_key = _get_expected_api_key()
    if not x_api_key or not secrets.compare_digest(x_api_key, expected_api_key):
        raise HTTPException(status_code=403, detail="Invalid API key")

    request.state.api_key_verified = True
