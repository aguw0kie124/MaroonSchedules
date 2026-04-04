import os
import requests
import jwt
import json
from typing import Optional
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jwt.algorithms import RSAAlgorithm

security = HTTPBearer(auto_error=False)

CLERK_SECRET_KEY = os.getenv("CLERK_SECRET_KEY")
ALLOW_DEV_AUTH_BYPASS = os.getenv("ALLOW_DEV_AUTH_BYPASS", "").strip().lower() in {"1", "true", "yes"}
jwks_cache = None

def get_jwks():
    """Fetch JWKS directly from Clerk Backend API using Secret Key."""
    global jwks_cache
    if jwks_cache:
        return jwks_cache

    if not CLERK_SECRET_KEY:
        print("Warning: Missing CLERK_SECRET_KEY environment variable. Clerk JWKS cannot be fetched.")
        return {"keys": []}
        
    try:
        url = "https://api.clerk.com/v1/jwks"
        headers = {"Authorization": f"Bearer {CLERK_SECRET_KEY}"}
        response = requests.get(url, headers=headers, timeout=5)
        response.raise_for_status()
        jwks_cache = response.json()
        return jwks_cache
    except Exception as e:
        print(f"Error fetching Clerk JWKS: {e}")
        return {"keys": []}

def verify_token(token: str) -> str:
    """Verifies Clerk JWT and returns user_id (sub)."""
    try:
        if token.startswith("tok_dev_"):
            if not ALLOW_DEV_AUTH_BYPASS:
                raise Exception("Development auth bypass is disabled")
            decoded = jwt.decode(token, options={"verify_signature": False, "verify_exp": False})
            user_id = decoded.get("sub")
            if not user_id:
                raise Exception("Token missing 'sub' claim")
            return user_id

        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")
        if not kid:
            raise Exception("No kid in token header")

        jwks = get_jwks()
        key_data = next((k for k in jwks.get("keys", []) if k["kid"] == kid), None)
        if not key_data:
            raise Exception(f"Public key for kid {kid} not found")

        public_key = RSAAlgorithm.from_jwk(json.dumps(key_data))
        
        decoded = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            options={"verify_aud": False}
        )
        user_id = decoded.get("sub")
        if not user_id:
             raise Exception("Token missing 'sub' claim")
        return user_id
    except HTTPException:
        raise
    except Exception as e:
        print(f"Token verification failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")

def require_auth(credentials: Optional[HTTPAuthorizationCredentials] = Security(security)) -> str:
    """Dependency for protected endpoints. Expects Bearer <token> in header."""
    if not credentials or not credentials.credentials:
        raise HTTPException(status_code=401, detail="Authentication required")
    token = credentials.credentials
    return verify_token(token)


def optional_auth(credentials: Optional[HTTPAuthorizationCredentials] = Security(security)) -> Optional[str]:
    if not credentials or not credentials.credentials:
        return None
    return verify_token(credentials.credentials)


def ensure_matching_user(auth_user_id: str, requested_user_id: str, detail: str = "Forbidden") -> str:
    if auth_user_id != requested_user_id:
        raise HTTPException(status_code=403, detail=detail)
    return auth_user_id
