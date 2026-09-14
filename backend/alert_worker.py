"""
Detection → Watchlist Match → Alert Pipeline Worker

Consumes from Redis Stream 'detection_events', matches against watchlist,
creates alerts, and broadcasts via WebSocket.
"""
import asyncio
import json
import logging
import os
from datetime import datetime, timezone

import redis.asyncio as aioredis
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

logger = logging.getLogger("alert-worker")

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://gicvmap_admin:gicvmap_secret_2026@localhost:5432/gicvmap")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
STREAM_KEY = "detection_events"
CONSUMER_GROUP = "alert_processors"
CONSUMER_NAME = "worker-1"
POLL_INTERVAL = 1  # seconds

engine = create_async_engine(DATABASE_URL, echo=False, pool_size=5)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def ensure_consumer_group(r: aioredis.Redis):
    try:
        await r.xgroup_create(STREAM_KEY, CONSUMER_GROUP, id="0", mkstream=True)
        logger.info(f"Created consumer group '{CONSUMER_GROUP}' on '{STREAM_KEY}'")
    except aioredis.ResponseError as e:
        if "BUSYGROUP" not in str(e):
            raise
        logger.info(f"Consumer group '{CONSUMER_GROUP}' already exists")


async def match_watchlist(db: AsyncSession, plate_normalized: str) -> list[dict]:
    result = await db.execute(
        text("""
            SELECT id, type, plate_number, plate_normalized, reason, category, priority
            FROM watchlist
            WHERE type = 'vehicle' AND plate_normalized = :norm AND is_active = true
        """),
        {"norm": plate_normalized},
    )
    return [dict(r) for r in result.mappings().all()]


async def create_alert(db: AsyncSession, detection: dict, watchlist_match: dict) -> dict:
    severity = "critical" if watchlist_match.get("priority") == "high" else "high"
    if watchlist_match.get("category") in ("stolen", "wanted"):
        severity = "critical"

    result = await db.execute(
        text("""
            INSERT INTO alerts (
                watchlist_id, detection_id, camera_id, triggered_at,
                severity, status, match_type, match_confidence,
                plate_number, watchlist_reason, camera_name,
                camera_lat, camera_lng, snapshot_url
            ) VALUES (
                :watchlist_id, :detection_id, :camera_id, now(),
                :severity, 'new', 'plate_exact', :match_confidence,
                :plate_number, :watchlist_reason, :camera_name,
                :camera_lat, :camera_lng, :snapshot_url
            )
            RETURNING id, watchlist_id, detection_id, camera_id, triggered_at,
                severity, status, match_type, match_confidence,
                plate_number, watchlist_reason, camera_name,
                camera_lat, camera_lng, snapshot_url, created_at
        """),
        {
            "watchlist_id": watchlist_match["id"],
            "detection_id": detection.get("detection_id"),
            "camera_id": detection.get("camera_id"),
            "severity": severity,
            "match_confidence": float(detection.get("plate_confidence", 0)),
            "plate_number": detection.get("plate_number"),
            "watchlist_reason": watchlist_match.get("reason"),
            "camera_name": detection.get("camera_name", "Unknown"),
            "camera_lat": detection.get("lat"),
            "camera_lng": detection.get("lng"),
            "snapshot_url": detection.get("snapshot_url"),
        },
    )
    row = result.mappings().first()
    await db.commit()
    return dict(row)


async def store_detection(db: AsyncSession, event: dict) -> int:
    camera_id = event.get("camera_id")
    raw_dt = event.get("detected_at")
    if isinstance(raw_dt, str):
        try:
            detected_at = datetime.fromisoformat(raw_dt.replace("Z", "+00:00"))
        except (ValueError, TypeError):
            detected_at = datetime.now(timezone.utc)
    elif raw_dt:
        detected_at = raw_dt
    else:
        detected_at = datetime.now(timezone.utc)

    bbox_raw = event.get("bbox", {})
    if isinstance(bbox_raw, dict):
        bbox_json = json.dumps(bbox_raw)
    elif isinstance(bbox_raw, str):
        import re
        fixed = re.sub(r'(\w+):', r'"\1":', bbox_raw)
        try:
            json.loads(fixed)
            bbox_json = fixed
        except (json.JSONDecodeError, TypeError):
            bbox_json = json.dumps({"raw": bbox_raw})
    else:
        bbox_json = json.dumps({})

    det_type = "vehicle" if event.get("detection_type") in ("plate", "vehicle") else event.get("detection_type", "vehicle")

    result = await db.execute(
        text("""
            INSERT INTO detections (
                camera_id, detection_type, detected_at, frame_number,
                plate_number, plate_normalized, plate_confidence, plate_raw_ocr,
                object_class, object_confidence, bbox, snapshot_url, model_version
            ) VALUES (
                CAST(:camera_id AS UUID), :detection_type, CAST(:detected_at AS timestamptz),
                :frame_number, :plate_number, :plate_normalized, :plate_confidence,
                :plate_raw_ocr, :object_class, :object_confidence, CAST(:bbox AS jsonb),
                :snapshot_url, :model_version
            )
            RETURNING id
        """),
        {
            "camera_id": camera_id,
            "detection_type": det_type,
            "detected_at": detected_at,
            "frame_number": 0,
            "plate_number": event.get("plate_number"),
            "plate_normalized": event.get("plate_number", "").upper().replace(" ", "").replace("-", "") if event.get("plate_number") else None,
            "plate_confidence": float(event.get("plate_confidence", 0)) if event.get("plate_confidence") else None,
            "plate_raw_ocr": event.get("plate_raw_ocr"),
            "object_class": event.get("object_class"),
            "object_confidence": float(event.get("object_confidence", 0)) if event.get("object_confidence") else None,
            "bbox": bbox_json,
            "snapshot_url": event.get("snapshot_url"),
            "model_version": event.get("model_version", "yolov8n"),
        },
    )
    row = result.mappings().first()
    await db.commit()        # ← commit the detection INSERT immediately
    return row["id"]


async def get_or_create_camera_info(db: AsyncSession, camera_id: str, event_data: dict) -> dict:
    if not camera_id:
        return {"name": "Unknown", "lat": 0, "lng": 0}
        
    result = await db.execute(
        text("SELECT name, lat, lng FROM cameras WHERE id = CAST(:id AS UUID)"),
        {"id": camera_id},
    )
    row = result.mappings().first()
    if row:
        return dict(row)
        
    # Auto-provision camera from event data
    name = event_data.get("camera_name", "Unknown Camera")
    lat = float(event_data.get("lat", 0.0))
    lng = float(event_data.get("lng", 0.0))
    
    try:
        await db.execute(
            text("""
                INSERT INTO cameras (id, name, camera_type, lat, lng, status) 
                VALUES (CAST(:id AS UUID), :name, 'ip', :lat, :lng, 'online') 
                ON CONFLICT (id) DO NOTHING
            """),
            {"id": camera_id, "name": name, "lat": lat, "lng": lng}
        )
        await db.commit()
    except Exception as e:
        logger.warning(f"Failed to auto-provision camera {camera_id}: {e}")
        await db.rollback()
        
    return {"name": name, "lat": lat, "lng": lng}


async def process_detection(event_data: dict, ws_broadcast=None):
    """Process a single detection event.
    
    Stores EVERY detection (vehicle, person, object) into the detections table.
    Watchlist matching only happens for detections with a valid plate number.
    This ensures vehicle search / route reconstruction works for all sightings.
    """
    async with async_session() as db:
        try:
            camera_id = event_data.get("camera_id", "")
            plate = event_data.get("plate_number", "")
            det_type = event_data.get("detection_type", "vehicle")

            # Get camera info (auto-provision if missing)
            cam_info = await get_or_create_camera_info(db, camera_id, event_data)

            # Enrich event with real camera metadata before storing
            enriched = {
                **event_data,
                "camera_name": cam_info["name"],
                "lat": cam_info["lat"],
                "lng": cam_info["lng"],
            }

            # ── Always store every detection ──────────────────────────────
            det_id = await store_detection(db, {**enriched, "detection_id": None})
            print(f"[ALERT-WORKER] Stored detection #{det_id}: type={det_type} plate={plate or '-'} camera={cam_info['name']}", flush=True)

            # ── Watchlist matching only for plated vehicles ───────────────
            if not plate or not plate.strip():
                return  # no plate — detection stored, nothing more to do

            normalized = plate.upper().replace(" ", "").replace("-", "")
            if len(normalized) < 6:
                return  # plate too short to be valid

            matches = await match_watchlist(db, normalized)
            if not matches:
                return  # clean vehicle — already stored above

            # ── Create alert for every watchlist match ────────────────────
            for match in matches:
                alert = await create_alert(db, {
                    **enriched,
                    "detection_id": det_id,
                }, match)
                print(f"[ALERT-WORKER] ALERT #{alert['id']} [{alert['severity'].upper()}] Plate {plate} matched watchlist #{match['id']}: {match['reason']}", flush=True)
                if ws_broadcast:
                    await ws_broadcast(alert)

        except Exception as e:
            print(f"[ALERT-WORKER] ERROR processing detection: {e}", flush=True)
            import traceback
            traceback.print_exc()
            try:
                await db.rollback()
            except Exception:
                pass


async def run_worker():
    """Main worker loop — reads from Redis Stream and processes detections."""
    r = aioredis.from_url(REDIS_URL, decode_responses=True)
    await ensure_consumer_group(r)

    # Import WebSocket broadcast function from alert service
    # We'll use Redis pub/sub as a cross-service broadcast mechanism
    pubsub = r.pubsub()
    await pubsub.subscribe("ws_broadcast")

    print("[ALERT-WORKER] Alert worker started, listening for detection events...", flush=True)

    while True:
        try:
            # Read from stream
            entries = await r.xreadgroup(
                CONSUMER_GROUP, CONSUMER_NAME,
                {STREAM_KEY: ">"},
                count=10,
                block=1000,
            )

            if not entries:
                continue

            for stream_name, messages in entries:
                for msg_id, fields in messages:
                    event_data = fields
                    # Parse JSON fields if needed
                    for key in ("bbox", "analytics_config"):
                        if key in event_data and isinstance(event_data[key], str):
                            try:
                                event_data[key] = json.loads(event_data[key])
                            except (json.JSONDecodeError, TypeError):
                                pass

                    # Broadcast via Redis pub/sub for WebSocket
                    async def ws_broadcast(alert_data):
                        await r.publish("ws_broadcast", json.dumps(alert_data, default=str))

                    await process_detection(event_data, ws_broadcast)

                    # Acknowledge message
                    await r.xack(STREAM_KEY, CONSUMER_GROUP, msg_id)

        except asyncio.CancelledError:
            print("[ALERT-WORKER] Worker shutting down...", flush=True)
            break
        except Exception as e:
            print(f"[ALERT-WORKER] Worker error: {e}", flush=True)
            import traceback
            traceback.print_exc()
            await asyncio.sleep(5)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
    try:
        asyncio.run(run_worker())
    except KeyboardInterrupt:
        pass
