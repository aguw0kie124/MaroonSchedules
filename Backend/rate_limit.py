from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request


def user_or_ip(request: Request) -> str:
    """Rate-limit key: the authenticated Clerk user id when present, else the
    client IP. Use on authenticated routes so many students behind one
    campus-NAT IP don't share (and instantly exhaust) a single per-IP bucket.

    `require_auth` sets `request.state.auth_context` during dependency
    resolution, which runs before the limiter check, so the user id is
    available here; we fall back to IP if it isn't (e.g. unauthenticated call).
    """
    auth_context = getattr(request.state, "auth_context", None)
    user_id = getattr(auth_context, "user_id", None)
    if user_id:
        return f"user:{user_id}"
    return get_remote_address(request)


limiter = Limiter(key_func=get_remote_address, default_limits=["200 per minute"])
