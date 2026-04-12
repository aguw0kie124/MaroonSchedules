from typing import Optional
from fastapi import Depends, Request

from auth import AuthenticatedUser, require_clerk_user, optional_auth
from security import require_api_key


def require_auth(
    request: Request,
    current_user: AuthenticatedUser = Depends(require_clerk_user),
    _api_key_verified: None = Depends(require_api_key),
) -> AuthenticatedUser:
    request.state.auth_context = current_user
    request.state.api_key_verified = True
    return current_user


def optional_api_auth(
    request: Request,
    _user_id: Optional[str] = Depends(optional_auth),
    _api_key_verified: None = Depends(require_api_key),
) -> Optional[str]:
    request.state.api_key_verified = True
    return _user_id
