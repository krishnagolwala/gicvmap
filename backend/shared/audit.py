"""Audit logging middleware — logs user actions to audit_log table."""
import json
import time
import logging
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy import text

from shared.database import async_session
from shared.auth import decode_token, TokenPayload

logger = logging.getLogger("audit")

# Skip logging for these paths
SKIP_PATHS = {"/health", "/docs", "/openapi.json", "/redoc"}
SKIP_METHODS = {"OPTIONS", "HEAD"}

# Map HTTP methods to audit actions
METHOD_ACTION = {
    "GET": "read",
    "POST": "create",
    "PUT": "update",
    "PATCH": "update",
    "DELETE": "delete",
}


async def _extract_user(request: Request) -> tuple[str | None, str | None]:
    """Extract username and IP from the request."""
    auth_header = request.headers.get("authorization", "")
    if not auth_header.startswith("Bearer "):
        return None, None

    try:
        token_data: TokenPayload = decode_token(auth_header[7:])
        return str(token_data.sub), None
    except Exception:
        return None, None


def _infer_entity(path: str) -> tuple[str, str | None]:
    """Infer entity type and ID from request path."""
    parts = [p for p in path.split("/") if p]

    if len(parts) >= 3:
        entity_map = {
            "cameras": "camera",
            "watchlist": "watchlist",
            "alerts": "alert",
            "vehicles": "vehicle",
            "users": "user",
            "auth": "auth",
        }
        entity = entity_map.get(parts[2])
        if entity and len(parts) >= 4:
            return entity, parts[3]
        if entity:
            return entity, None

    if "detections" in path:
        return "detection", None
    if "stats" in path:
        return "stats", None

    return "unknown", None


class AuditMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if request.method in SKIP_METHODS or request.url.path in SKIP_PATHS:
            return await call_next(request)

        action = METHOD_ACTION.get(request.method, "unknown")

        if action == "read":
            return await call_next(request)

        start = time.time()
        response = await call_next(request)
        elapsed_ms = int((time.time() - start) * 1000)

        try:
            user_id, _ = await _extract_user(request)
            actor = user_id or "anonymous"
            entity, entity_id = _infer_entity(request.url.path)
            is_error = response.status_code >= 400
            client_ip = request.client.host if request.client else "unknown"

            async with async_session() as db:
                await db.execute(
                    text("""
                        INSERT INTO audit_log (actor, actor_ip, action, entity, entity_id, details)
                        VALUES (:actor, :ip, :action, :entity, :entity_id, CAST(:details AS jsonb))
                    """),
                    {
                        "actor": actor,
                        "ip": client_ip,
                        "action": action,
                        "entity": entity,
                        "entity_id": entity_id,
                        "details": json.dumps({
                            "method": request.method,
                            "path": request.url.path,
                            "status": response.status_code,
                            "elapsed_ms": elapsed_ms,
                            "error": is_error,
                        }),
                    },
                )
                await db.commit()

        except Exception as e:
            logger.warning(f"Audit log write failed: {e}")

        return response
