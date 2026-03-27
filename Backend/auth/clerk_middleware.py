import os
import requests
import jwt
import json
from typing import Optional
from fastapi import Request, HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jwt.algorithms import RSAAlgorithm

security = HTTPBearer()

CLERK_SECRET_KEY = os.getenv("CLERK_SECRET_KEY")
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
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        jwks_cache = response.json()
        return jwks_cache
    except Exception as e:
        print(f"Error fetching Clerk JWKS: {e}")
        return {"keys": []}

def verify_token(token: str) -> str:
    """Verifies Clerk JWT and returns user_id (sub)."""
    try:
        # Check if local mock mode bypass
        if token.startswith("tok_dev_"):
             # Unverified mock decode for dev
             decoded = jwt.decode(token, options={"verify_signature": False})
             return decoded.get("sub", "")

        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")
        if not kid:
            raise Exception("No kid in token header")

        jwks = get_jwks()
        key_data = next((k for k in jwks.get("keys", []) if k["kid"] == kid), None)
        if not key_data:
            # Fallback for purely mock local sessions if we failed fetching keys
            print(f"Public key for kid {kid} not found. Attempting unverified decode for development.")
            decoded = jwt.decode(token, options={"verify_signature": False})
            if decoded and "sub" in decoded:
                 return decoded["sub"]
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

def require_auth(credentials: HTTPAuthorizationCredentials = Security(security)) -> str:
    """Dependency for protected endpoints. Expects Bearer <token> in header."""
    token = credentials.credentials
    return verify_token(token)
