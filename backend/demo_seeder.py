"""
GICVMAP — Demo Detection Seeder
================================
Publishes realistic ANPR detections (valid Indian plates) to the Redis
`detection_events` stream, which the alert worker consumes exactly like
live detections — same store path, same watchlist matching, same alerts.

Why this exists:
  The hackathon problem statement explicitly allows ANPR demonstration on
  "live or recorded feeds". The Sentinel demo grid's cameras view traffic
  from a distance, so live OCR rarely resolves a readable plate. This
  seeder simulates the *recorded-feed* ANPR path: vehicles whose plates
  were read while passing close to the camera.

Behaviour:
  - On startup, backfills ~36h of route history for a small fleet of demo
    vehicles so Vehicle Search shows a full route immediately.
  - Then keeps publishing a fresh detection every ~2-4s (live demo flow).
  - Plates from the watchlist seed (GJ01AB1234, GJ05CD5678, ...) appear
    regularly, which drives the real-time alert pipeline end to end.

Run as its own container (see demo-seeder service in docker-compose.yml).
"""

import asyncio
import json
import os
import random
import uuid as uuid_mod
from datetime import datetime, timedelta, timezone

import asyncpg

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://gicvmap_admin:gicvmap_secret_2026@postgres:5432/gicvmap",
)
# asyncpg accepts only postgresql:// or postgres:// — strip SQLAlchemy dialect
if DATABASE_URL.startswith("postgresql+asyncpg://"):
    DATABASE_URL = "postgresql://" + DATABASE_URL[len("postgresql+asyncpg://"):]
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
STREAM = "detection_events"

# A small fleet of demo vehicles. The first four are on the seeded
# watchlist — they will fire real alerts through the alert worker.
FLEET = [
    "GJ01AB1234",  # watchlist: stolen vehicle (FIR #2026/4521)
    "GJ05CD5678",  # watchlist: robbery suspect
    "GJ27EF9012",  # watchlist: blacklisted toll violator
    "GJ03GH3456",  # watchlist: missing person vehicle
    "GJ01XY4321",
    "GJ05LM6789",
    "MH12AB3456",
    "GJ18MN2345",
    "GJ04PQ8765",
    "DL8CAF1234",
    "GJ06RT5432",
    "RJ14GB4321",
]

# Street-view distance biases: pick the region of the frame the vehicle is in.
OBJECT_CLASSES = ["car", "car", "car", "motorcycle", "bus", "truck"]


async def get_redis():
    import redis.asyncio as aioredis
    return aioredis.from_url(REDIS_URL, decode_responses=True)


async def load_cameras(pool):
    """Load live Sentinel cameras (those with RTSP URLs pointing at the grid)."""
    rows = await pool.fetch(
        """
        SELECT id, name, lat, lng
        FROM cameras
        WHERE rtsp_url IS NOT NULL AND status = 'online'
        ORDER BY name
        """
    )
    if not rows:
        # Fallback: any cameras in the registry
        rows = await pool.fetch("SELECT id, name, lat, lng FROM cameras ORDER BY name")
    return [
        {
            "camera_id": str(r["id"]),
            "camera_name": r["name"],
            "lat": float(r["lat"] or 0),
            "lng": float(r["lng"] or 0),
        }
        for r in rows
    ]


async def backfill_history(r, cameras, hours=36):
    """Pre-populate route history so vehicle search works from second zero."""
    if not cameras:
        return
    now = datetime.now(timezone.utc)
    count = 0
    for plate in FLEET:
        # Each vehicle is seen at 4-8 different cameras spread over the window
        n_sightings = random.randint(4, 8)
        chosen = random.sample(cameras, min(n_sightings, len(cameras)))
        t = now - timedelta(hours=hours)
        for cam in chosen:
            # Slightly increasing timestamps along the route
            t = t + timedelta(minutes=random.randint(20, 240))
            if t >= now:
                break
            event = make_event(cam, plate, t)
            await r.xadd(STREAM, event, maxlen=20000)
            count += 1
    print(f"[seeder] backfilled {count} historical detections", flush=True)


def make_event(cam, plate, detected_at):
    conf = round(random.uniform(0.78, 0.98), 4)
    return {
        "camera_id": cam["camera_id"],
        "camera_name": cam["camera_name"],
        "lat": str(cam["lat"]),
        "lng": str(cam["lng"]),
        "detected_at": detected_at.isoformat(),
        "detection_type": "vehicle",
        "object_class": random.choice(OBJECT_CLASSES),
        "object_confidence": str(round(random.uniform(0.55, 0.93), 4)),
        "bbox": json.dumps(
            {
                "x": random.randint(80, 1400),
                "y": random.randint(300, 900),
                "w": random.randint(60, 160),
                "h": random.randint(40, 120),
            }
        ),
        "plate_number": plate,
        "plate_confidence": str(conf),
        "plate_raw_ocr": plate,
        "model_version": "demo-seeder",
    }


async def main():
    print(f"[seeder] starting (stream={STREAM})", flush=True)
    pool = await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=3)
    r = await get_redis()

    cameras = await load_cameras(pool)
    print(f"[seeder] {len(cameras)} cameras loaded", flush=True)
    if not cameras:
        print("[seeder] no cameras found — exiting", flush=True)
        return

    try:
        await r.xgroup_create(STREAM, "demo-seeder", id="$", mkstream=True)
    except Exception:
        pass  # group already exists or stream new — non-fatal

    await backfill_history(r, cameras)

    # Live loop — publish a detection every ~2.5s, cycling the fleet.
    # Watchlist plates appear ~35% of the time so alerts keep firing.
    watchlist = {"GJ01AB1234", "GJ05CD5678", "GJ27EF9012", "GJ03GH3456"}
    cycle = 0
    while True:
        cycle += 1
        if cycle % 3 == 0 and random.random() < 0.9:
            # A watchlist vehicle passes by
            plate = random.choice(list(watchlist))
        else:
            plate = random.choice(FLEET)
        cam = random.choice(cameras)
        event = make_event(cam, plate, datetime.now(timezone.utc))
        await r.xadd(STREAM, event, maxlen=20000)
        print(
            f"[seeder] {plate} @ {cam['camera_name']} "
            f"({event['plate_confidence']})",
            flush=True,
        )
        await asyncio.sleep(random.uniform(1.5, 4.0))


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
    except Exception as e:
        print(f"[seeder] fatal: {e}", flush=True)
        raise