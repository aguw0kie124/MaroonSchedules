from __future__ import annotations

import json
import os
import threading
import time
from base64 import urlsafe_b64decode
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional
from urllib.parse import urlparse

import jwt
import requests
from dotenv import load_dotenv
from fastapi import HTTPException, Request, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt.algorithms import RSAAlgorithm

_THIS_DIR = Path(__file__).resolve().parent
load_dotenv(_THIS_DIR.parent / ".env", override=False)
load_dotenv(_THIS_DIR.parent.parent / ".env", override=False)

security = HTTPBearer(auto_error=False)
_JWKS_CACHE_TTL_SECONDS = int(os.getenv("CLERK_JWKS_CACHE_TTL_SECONDS", "3600"))
_JWKS_TIMEOUT_SECONDS = float(os.getenv("CLERK_JWKS_TIMEOUT_SECONDS", "5"))
_JWKS_SESSION = requests.Session()
_JWKS_LOCK = threading.Lock()
_JWKS_CACHE: dict[str, Any] | None = None
_JWKS_CACHE_EXPIRES_AT = 0.0


@dataclass(frozen=True)
class AuthenticatedUser:
    user_id: str
    email: Optional[str]
    claims: dict[str, Any]

    def as_dict(self) -> dict[str, Any]:
        return {
            "user_id": self.user_id,
            "email": self.email,
            "claims": self.claims,
        }


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=401,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def _get_required_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise HTTPException(status_code=500, detail=f"Missing required environment variable: {name}")
    return value


def _get_optional_env(*names: str) -> Optional[str]:
    for name in names:
        value = os.getenv(name, "").strip()
        if value:
            return value
    return None


def _decode_publishable_key_host(publishable_key: str) -> Optional[str]:
    parts = publishable_key.split("_", 2)
    if len(parts) < 3:
        return None

    encoded = parts[2]
    padding = "=" * ((4 - len(encoded) % 4) % 4)
    try:
        decoded = urlsafe_b64decode(f"{encoded}{padding}").decode("utf-8").strip()
    except Exception:
        return None

    if decoded.endswith("$"):
        decoded = decoded[:-1]

    return decoded or None


def _derive_clerk_issuer() -> Optional[str]:
    explicit_issuer = _get_optional_env("CLERK_ISSUER")
    if explicit_issuer:
        return explicit_issuer.rstrip("/")

    frontend_api = _get_optional_env("CLERK_FRONTEND_API", "CLERK_DOMAIN")
    if frontend_api:
        frontend_api = frontend_api.rstrip("/")
        if frontend_api.startswith("http://") or frontend_api.startswith("https://"):
            return frontend_api
        return f"https://{frontend_api}"

    publishable_key = _get_optional_env("CLERK_PUBLISHABLE_KEY", "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY")
    if publishable_key:
        host = _decode_publishable_key_host(publishable_key)
        if host:
            if host.startswith("http://") or host.startswith("https://"):
                return host.rstrip("/")
            return f"https://{host}".rstrip("/")

    return None


def get_clerk_jwks_url() -> str:
    configured = _get_optional_env("CLERK_JWKS_URL")
    if configured:
        return configured

    issuer = _derive_clerk_issuer()
    if issuer:
        return f"{issuer.rstrip('/')}/.well-known/jwks.json"

    clerk_secret = _get_optional_env("CLERK_SECRET_KEY")
    if clerk_secret:
        return "https://api.clerk.com/v1/jwks"

    raise HTTPException(
        status_code=500,
        detail="Missing Clerk configuration. Set CLERK_JWKS_URL or provide Clerk issuer/publishable key env vars.",
    )


def _get_expected_issuer() -> Optional[str]:
    derived = _derive_clerk_issuer()
    if derived:
        return derived.rstrip("/")

    configured_jwks_url = _get_optional_env("CLERK_JWKS_URL")
    if configured_jwks_url:
        parsed = urlparse(configured_jwks_url)
        if not parsed.scheme or not parsed.netloc:
            raise HTTPException(status_code=500, detail="CLERK_JWKS_URL must be a valid absolute URL")
        return f"{parsed.scheme}://{parsed.netloc}".rstrip("/")

    return None


def _get_expected_audience() -> Optional[str]:
    audience = os.getenv("CLERK_JWT_AUDIENCE", "").strip()
    return audience or None


def _get_cached_jwks(force_refresh: bool = False) -> dict[str, Any]:
    global _JWKS_CACHE, _JWKS_CACHE_EXPIRES_AT

    now = time.monotonic()
    if not force_refresh and _JWKS_CACHE and now < _JWKS_CACHE_EXPIRES_AT:
        return _JWKS_CACHE

    with _JWKS_LOCK:
        now = time.monotonic()
        if not force_refresh and _JWKS_CACHE and now < _JWKS_CACHE_EXPIRES_AT:
            return _JWKS_CACHE

        jwks_url = get_clerk_jwks_url()
        headers = {}
        if jwks_url == "https://api.clerk.com/v1/jwks":
            clerk_secret = _get_optional_env("CLERK_SECRET_KEY")
            if not clerk_secret:
                raise HTTPException(status_code=500, detail="CLERK_SECRET_KEY is required when using Clerk API JWKS fallback")
            headers["Authorization"] = f"Bearer {clerk_secret}"

        response = _JWKS_SESSION.get(jwks_url, headers=headers, timeout=_JWKS_TIMEOUT_SECONDS)
        response.raise_for_status()
        jwks = response.json()
        if not isinstance(jwks, dict) or not isinstance(jwks.get("keys"), list):
            raise HTTPException(status_code=500, detail="Clerk JWKS response is malformed")

        _JWKS_CACHE = jwks
        _JWKS_CACHE_EXPIRES_AT = time.monotonic() + max(_JWKS_CACHE_TTL_SECONDS, 60)
        return jwks


def _get_signing_key(token: str):
    try:
        header = jwt.get_unverified_header(token)
    except jwt.InvalidTokenError as exc:
        raise _unauthorized("Invalid token header") from exc

    algorithm = header.get("alg")
    if algorithm != "RS256":
        raise _unauthorized("Unsupported token signing algorithm")

    kid = header.get("kid")
    if not kid:
        raise _unauthorized("Token header is missing key id")

    for force_refresh in (False, True):
        jwks = _get_cached_jwks(force_refresh=force_refresh)
        key_data = next((key for key in jwks.get("keys", []) if key.get("kid") == kid), None)
        if key_data:
            return RSAAlgorithm.from_jwk(json.dumps(key_data))

    raise _unauthorized("Unable to find a valid signing key for this token")


def _validate_issuer(payload: dict[str, Any]) -> None:
    expected = _get_expected_issuer()
    if not expected:
        return
    actual = str(payload.get("iss") or "").rstrip("/")
    if not actual or actual != expected:
        raise _unauthorized("Token issuer is invalid")


def _validate_audience(payload: dict[str, Any]) -> None:
    expected_audience = _get_expected_audience()
    if not expected_audience:
        return

    audience = payload.get("aud")
    if isinstance(audience, str):
        audiences = {audience}
    elif isinstance(audience, list):
        audiences = {str(item) for item in audience}
    else:
        audiences = set()

    if expected_audience not in audiences:
        raise _unauthorized("Token audience is invalid")


def _extract_email(payload: dict[str, Any]) -> Optional[str]:
    for key in ("email", "email_address", "primary_email_address"):
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()

    email_claims = payload.get("email_addresses")
    if isinstance(email_claims, list):
        for item in email_claims:
            if isinstance(item, dict):
                email = item.get("email_address") or item.get("email")
                if isinstance(email, str) and email.strip():
                    return email.strip()

    return None


def verify_clerk_token(token: str) -> AuthenticatedUser:
    if not token or not token.strip():
        raise _unauthorized("Missing bearer token")

    try:
        public_key = _get_signing_key(token)
        payload = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            options={
                "require": ["exp", "iat", "sub"],
                "verify_aud": False,
            },
        )
    except jwt.ExpiredSignatureError as exc:
        raise _unauthorized("Token has expired") from exc
    except jwt.InvalidTokenError as exc:
        raise _unauthorized("Invalid token") from exc
    except requests.RequestException as exc:
        raise HTTPException(status_code=503, detail="Unable to reach Clerk JWKS endpoint") from exc

    _validate_issuer(payload)
    _validate_audience(payload)

    user_id = payload.get("sub")
    if not isinstance(user_id, str) or not user_id.strip():
        raise _unauthorized("Token payload is missing the user id")

    return AuthenticatedUser(
        user_id=user_id,
        email=_extract_email(payload),
        claims=payload,
    )


def get_authenticated_user(request: Request) -> AuthenticatedUser:
    current_user = getattr(request.state, "auth_context", None)
    if isinstance(current_user, AuthenticatedUser):
        return current_user
    raise _unauthorized("Authentication required")


def require_clerk_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security),
) -> AuthenticatedUser:
    cached_user = getattr(request.state, "auth_context", None)
    if isinstance(cached_user, AuthenticatedUser):
        return cached_user

    if not credentials or not credentials.credentials:
        raise _unauthorized("Authentication required")

    current_user = verify_clerk_token(credentials.credentials)
    request.state.auth_context = current_user
    return current_user


def require_auth(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security),
) -> str:
    return require_clerk_user(request, credentials).user_id


def optional_auth(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security),
) -> Optional[str]:
    cached_user = getattr(request.state, "auth_context", None)
    if isinstance(cached_user, AuthenticatedUser):
        return cached_user.user_id

    if not credentials or not credentials.credentials:
        return None

    current_user = verify_clerk_token(credentials.credentials)
    request.state.auth_context = current_user
    return current_user.user_id


def ensure_matching_user(
    auth_user: AuthenticatedUser | str,
    requested_user_id: str,
    detail: str = "Forbidden",
) -> str:
    auth_user_id = auth_user.user_id if isinstance(auth_user, AuthenticatedUser) else auth_user
    if auth_user_id != requested_user_id:
        raise HTTPException(status_code=403, detail=detail)
    return auth_user_id


__all__ = [
    "AuthenticatedUser",
    "ensure_matching_user",
    "get_authenticated_user",
    "optional_auth",
    "require_auth",
    "require_clerk_user",
    "security",
    "verify_clerk_token",
]
