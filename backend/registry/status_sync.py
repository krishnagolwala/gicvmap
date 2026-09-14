"""
Camera status reconciler (registry service background task).

The registry seed marks all 30 cameras 'online', but only cameras with a
path configured in the MediaMTX relay (`stream-gateway/mediamtx.yml`) are
actually streamable through the platform. A live-manifest probe is too
jittery to drive status — Sentinel upstreams routinely drop RTP packets
or stall an HLS muxer for seconds, which would make cameras flicker
online/offline every pass.

So "online" is defined as: **configured in the MediaMTX relay**. A
configured path means the platform is pulling that feed and the Video Wall
can play it. If a feed is removed from the relay (upstream retired), the
next sync pass marks it offline. Admin 'maintenance' holds are respected.

The config file is mounted read-only into this service by docker-compose.
"""

import asyncio
import logging
import re
from pathlib import Path

from sqlalchemy import text

from shared.database import async_session

logger = logging.getLogger(__name__)

# MediaMTX relay config, mounted read-only (see docker-compose.yml)
MEDIAMTX_CONFIG = Path("/mediamtx.yml")

# Every ~45s is plenty — status only changes when the relay config changes
SYNC_INTERVAL_SECONDS = 45

# Path keys sit at exactly 2-space indent under `paths:` — e.g. `  "cam01":`.
# Nested keys (`    source: ...`) and comments can never match this.
_PATH_RE = re.compile(r'^  "?(cam\d+)"?:$')


def _configured_paths() -> set[str]:
    """Extract the path names configured in the MediaMTX relay config."""
    try:
        text_cfg = MEDIAMTX_CONFIG.read_text(encoding="utf-8")
    except FileNotFoundError:
        logger.warning("MediaMTX config not mounted at %s — status sync inactive",
                       MEDIAMTX_CONFIG)
        return set()
    paths = set()
    in_paths = False
    for line in text_cfg.splitlines():
        if line.strip() == "paths:":
            in_paths = True
            continue
        if in_paths:
            m = _PATH_RE.match(line)
            if m:
                paths.add(m.group(1))
    return paths


async def _sync_once() -> None:
    configured = _configured_paths()
    if not configured:
        return  # config not mounted yet — try again next pass

    async with async_session() as db:
        rows = (await db.execute(
            text("SELECT id, rtsp_url, status FROM cameras")
        )).mappings().all()

    changes: list[tuple[str, str, bool]] = []  # (camera_id, new_status, online)
    for r in rows:
        if r["status"] == "maintenance":
            continue  # never auto-overwrite an admin hold
        match = re.search(r"stream/([^/?]+)", r["rtsp_url"] or "")
        if not match:
            continue  # camera not tied to a relay path — leave untouched
        online = match.group(1) in configured
        new_status = "online" if online else "offline"
        if new_status != r["status"]:
            changes.append((str(r["id"]), new_status, online))

    if changes:
        async with async_session() as db:
            for cam_id, new_status, online in changes:
                if online:
                    await db.execute(
                        text("""
                            UPDATE cameras
                            SET status = :status, last_seen = now(), updated_at = now()
                            WHERE id = CAST(:id AS UUID)
                        """),
                        {"status": new_status, "id": cam_id},
                    )
                else:
                    await db.execute(
                        text("""
                            UPDATE cameras
                            SET status = :status, updated_at = now()
                            WHERE id = CAST(:id AS UUID)
                        """),
                        {"status": new_status, "id": cam_id},
                    )
            await db.commit()

    logger.info(
        "Camera status sync: %d online, %d offline (%d relay paths configured)",
        sum(1 for c in changes if c[2]), sum(1 for c in changes if not c[2]),
        len(configured),
    )


async def run_status_sync() -> None:
    """Reconcile camera statuses forever; self-healing on any error."""
    logger.info("Camera status sync started (%s — %ds interval)",
                MEDIAMTX_CONFIG, SYNC_INTERVAL_SECONDS)
    while True:
        try:
            await _sync_once()
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Camera status sync iteration failed")
        await asyncio.sleep(SYNC_INTERVAL_SECONDS)
