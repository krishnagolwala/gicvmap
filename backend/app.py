import asyncio
import os
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from shared.config import settings

SERVICE_NAME = settings.SERVICE_NAME
logger = logging.getLogger("app")


async def _start_alert_worker():
    """Background task: start the alert worker for the alert service."""
    from alert_worker import run_worker
    await run_worker()


async def _start_redis_subscriber():
    """Background task: subscribe to Redis pub/sub for WebSocket broadcasts."""
    from alert.router import _start_redis_subscriber
    await _start_redis_subscriber()


async def _start_camera_status_sync():
    """Background task: reconcile camera online/offline status from MediaMTX."""
    from registry.status_sync import run_status_sync
    await run_status_sync()


@asynccontextmanager
async def lifespan(app: FastAPI):
    background_tasks = []

    # Alert worker + Redis subscriber: alert service only
    if SERVICE_NAME == "alert":
        task1 = asyncio.create_task(_start_alert_worker())
        task2 = asyncio.create_task(_start_redis_subscriber())
        background_tasks = [task1, task2]
        logger.info("Alert worker + Redis subscriber started in background")

    # Camera status reconciler: registry service only
    elif SERVICE_NAME == "registry":
        task = asyncio.create_task(_start_camera_status_sync())
        background_tasks = [task]

    yield

    for task in background_tasks:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


app = FastAPI(
    title=f"GICVMAP — {SERVICE_NAME.replace('_', ' ').title()} Service",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Audit logging middleware (skips reads, logs mutations)
try:
    from shared.audit import AuditMiddleware
    app.add_middleware(AuditMiddleware)
except ImportError:
    logger.warning("Audit middleware not available")


@app.get("/health")
async def health():
    return {"status": "ok", "service": SERVICE_NAME}


# ─── Route registration per service ──────────────────────────
if SERVICE_NAME == "auth":
    from auth.router import router
    app.include_router(router, prefix="/api/v1/auth", tags=["auth"])

elif SERVICE_NAME == "registry":
    from registry.router import router
    app.include_router(router, prefix="/api/v1", tags=["registry"])

elif SERVICE_NAME == "watchlist":
    from watchlist.router import router
    app.include_router(router, prefix="/api/v1/watchlist", tags=["watchlist"])

elif SERVICE_NAME == "alert":
    from alert.router import router
    app.include_router(router, prefix="/api/v1/alerts", tags=["alerts"])

elif SERVICE_NAME == "search":
    from search.router import router
    app.include_router(router, prefix="/api/v1", tags=["search"])
    from integrations.router import router as integrations_router
    app.include_router(integrations_router, prefix="/api/v1", tags=["integrations"])

else:
    pass
