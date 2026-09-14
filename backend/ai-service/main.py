import os

# Force RTSP over TCP for Sentinel streams (mandatory per Sentinel docs)
os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp"

import json
import time
import asyncio
import logging
import re

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s", force=True)

from typing import Optional
from datetime import datetime, timezone
from contextlib import asynccontextmanager

import cv2
import numpy as np
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import redis.asyncio as aioredis

logger = logging.getLogger("ai-service")

# ─── Config ──────────────────────────────────────────────────
REDIS_URL      = os.getenv("REDIS_URL", "redis://localhost:6379/0")
DATABASE_URL   = os.getenv("DATABASE_URL", "postgresql+asyncpg://gicvmap_admin:gicvmap_secret_2026@postgres:5432/gicvmap")
AI_DEVICE      = os.getenv("AI_DEVICE", "cpu")
AI_FPS_DEFAULT = int(os.getenv("AI_FPS_DEFAULT", "1"))   # 1 FPS default — saves memory
AI_CONFIDENCE  = float(os.getenv("AI_CONFIDENCE_THRESHOLD", "0.5"))
MODEL_DIR      = os.getenv("AI_MODEL_PATH", "/app/models")
STREAM_HOST    = os.getenv("SENTINEL_HOST", "103.250.160.189")
RTSP_PORT      = os.getenv("RTSP_PORT", "8554")
EASYOCR_CACHE  = os.getenv("EASYOCR_MODULE_PATH", "/root/.EasyOCR")

# Sentinel Camera Grid — per Integrator Guide:
# Camera list should be fetched from cameras.json, not hardcoded.
# Fallback: all 30 Sentinel cameras (cam01–cam30).
CAMERAS_JSON_URL = os.getenv("CAMERAS_JSON_URL", "https://cctv.corp8.cloud/cameras.json")
DEFAULT_CAMERAS = [f"cam{str(i).zfill(2)}" for i in range(1, 31)]

# Plate OCR — reject low-confidence reads; format is validated separately
PLATE_MIN_CONFIDENCE = float(os.getenv("PLATE_MIN_CONFIDENCE", "0.5"))

# Use local mediamtx relay to avoid Sentinel 401 auth errors.
# mediamtx pulls from Sentinel and re-serves locally — AI reads from mediamtx.
# Set RTSP_USE_LOCAL=true (default in docker-compose) to enable.
_USE_LOCAL_RELAY = os.getenv("RTSP_USE_LOCAL", "false").lower() == "true"
_LOCAL_RTSP_HOST = os.getenv("RTSP_HOST", "mediamtx")

def get_rtsp_url(stream_id: str) -> str:
    """Build RTSP URL. Uses local mediamtx relay when RTSP_USE_LOCAL=true."""
    if _USE_LOCAL_RELAY:
        return f"rtsp://{_LOCAL_RTSP_HOST}:{RTSP_PORT}/{stream_id}"
    # Direct Sentinel access — per Integrator Guide, RTSP requires auth
    sentinel_user = os.getenv("SENTINEL_USER", "")
    sentinel_pass = os.getenv("SENTINEL_PASS", "")
    if sentinel_user and sentinel_pass:
        return f"rtsp://{sentinel_user}:{sentinel_pass}@{STREAM_HOST}:{RTSP_PORT}/stream/{stream_id}"
    return f"rtsp://{STREAM_HOST}:{RTSP_PORT}/stream/{stream_id}"


async def _fetch_camera_list() -> list[str]:
    """
    Fetch camera list from Sentinel cameras.json endpoint.
    Per Integrator Guide: "Start from the catalogue rather than hard-coding."
    Falls back to DEFAULT_CAMERAS (cam01–cam30) if fetch fails.
    """
    import urllib.request, ssl
    try:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        req = urllib.request.Request(CAMERAS_JSON_URL)
        resp = await asyncio.to_thread(urllib.request.urlopen, req, timeout=10, context=ctx)
        data = json.loads(resp.read())
        # cameras.json may return list of objects or list of strings
        if isinstance(data, list):
            if data and isinstance(data[0], dict):
                ids = [c.get("id", c.get("camera_id", "")) for c in data]
            else:
                ids = [str(c) for c in data]
        elif isinstance(data, dict) and "cameras" in data:
            raw = data["cameras"]
            ids = [c.get("id", "") if isinstance(c, dict) else str(c) for c in raw]
        else:
            ids = DEFAULT_CAMERAS
        ids = [i.strip() for i in ids if i.strip()]
        if ids:
            logger.info(f"Fetched {len(ids)} cameras from {CAMERAS_JSON_URL}")
            return ids
    except Exception as e:
        logger.warning(f"Failed to fetch cameras.json ({e}), using default list")
    return DEFAULT_CAMERAS

# Max concurrent YOLO inference threads — prevents OOM when all streams fire at once
MAX_CONCURRENT_INFERENCE = int(os.getenv("MAX_CONCURRENT_INFERENCE", "2"))


def _resolve_device() -> str:
    """
    Return 'cuda' when a GPU is present and AI_DEVICE wants it, else 'cpu'.
    Keeps the service runnable on CPU-only hosts (graceful fallback).
    """
    if os.getenv("AI_DEVICE", "cpu").lower() == "cpu":
        return "cpu"
    try:
        import torch
        if torch.cuda.is_available():
            logger.info(f"CUDA device: {torch.cuda.get_device_name(0)}")
            return "cuda"
    except Exception as e:
        logger.warning(f"CUDA requested but unavailable ({e}) — falling back to CPU")
    return "cpu"

# Sentinel cameras to process — comma-separated stream IDs (cam01..cam30)
CAMERA_STREAMS = os.getenv("CAMERA_STREAMS", "").split(",")

# ─── Plate extraction ─────────────────────────────────────────
def _extract_best_plate(ocr_result):
    """
    Pick the best real plate from EasyOCR output.

    ocr_result: list of (bbox, text, confidence) tuples.
    Returns (confidence, plate, raw_text) or None.
    Only fragments that match the Indian plate format AND meet
    PLATE_MIN_CONFIDENCE are considered; highest confidence wins.
    If no single fragment matches, tries joining fragments (a plate is
    sometimes split across two OCR boxes).
    """
    if not ocr_result:
        return None

    frags = []
    for item in ocr_result:
        try:
            raw = str(item[1]).strip()
            conf = float(item[2])
        except Exception:
            continue
        if not raw:
            continue
        plate = _normalize_plate(raw)
        if plate and conf >= PLATE_MIN_CONFIDENCE:
            frags.append((conf, plate, raw))

    if frags:
        frags.sort(key=lambda x: x[0], reverse=True)
        return frags[0]

    # Fallback: plate split across adjacent OCR boxes, e.g. "GJ 01" + "AB 1234"
    texts = "".join(str(item[1]).strip() for item in ocr_result if item[1])
    plate = _normalize_plate(texts)
    if plate:
        confs = [float(item[2]) for item in ocr_result if item[2] is not None]
        conf = sum(confs) / len(confs) if confs else 0.0
        if conf >= PLATE_MIN_CONFIDENCE:
            return (conf, plate, texts)
    return None


def _ocr_read_plate(crop, ocr) -> Optional[tuple]:
    """
    Run EasyOCR on a vehicle crop and return (conf, plate, raw) or None.

    Plates on distant vehicles occupy only a few dozen pixels, which is
    below EasyOCR's reliable reading range. The crop is upscaled 3x
    (bicubic) before OCR — this measurably improves read rate with no
    cost to the caller (the crop is small to begin with).
    """
    if crop is None or crop.size == 0:
        return None
    h, w = crop.shape[:2]
    if w < 200:
        scale = 3 if w < 100 else 2
        upscaled = cv2.resize(crop, (w * scale, h * scale), interpolation=cv2.INTER_CUBIC)
    else:
        upscaled = crop
    try:
        ocr_result = ocr.readtext(upscaled)
    except Exception:
        return None
    return _extract_best_plate(ocr_result)


# ─── UUID mapping ─────────────────────────────────────────────
def stream_id_to_uuid(stream_id: str) -> str:
    """Convert stream_id like 'cam01' → 'a0000001-0000-0000-0000-000000000001'"""
    num = int(stream_id.replace("cam", "").lstrip("0") or "0")
    return f"a0000001-0000-0000-0000-{num:012d}"


# ─── Globals ──────────────────────────────────────────────────
# Single YOLO model instance shared across all stream processors.
# Protected by _yolo_lock — only one thread loads it; others wait.
_yolo_model = None
_yolo_lock = asyncio.Lock()

# EasyOCR — optional. Set to False if unavailable.
_ocr_engine = None        # easyocr.Reader instance or False
_ocr_lock = asyncio.Lock()
_ocr_available = None     # None = not checked, True/False = result

# Semaphore: caps simultaneous YOLO inference calls to MAX_CONCURRENT_INFERENCE.
# Prevents all 30 stream processors from running inference at the same time.
_inference_sem: Optional[asyncio.Semaphore] = None

_redis: Optional[aioredis.Redis] = None
_stream_tasks: list[asyncio.Task] = []

# Camera metadata cache: stream_id → {id, name, lat, lng}
_camera_meta: dict[str, dict] = {}


class DetectionEvent(BaseModel):
    camera_id: str
    detected_at: str
    detection_type: str
    plate_number: Optional[str] = None
    plate_confidence: Optional[float] = None
    plate_raw_ocr: Optional[str] = None
    object_class: Optional[str] = None
    object_confidence: Optional[float] = None
    bbox: dict
    snapshot_url: Optional[str] = None
    model_version: str = "yolov8n"


class InferenceResult(BaseModel):
    detections: list[DetectionEvent]
    processing_time_ms: int
    frame_size: tuple[int, int]


# ─── Model loaders ────────────────────────────────────────────
async def _get_yolo():
    """Get the single shared YOLO model, loading it once (thread-safe)."""
    global _yolo_model
    if _yolo_model is not None:
        return _yolo_model
    async with _yolo_lock:
        if _yolo_model is not None:       # double-check after acquiring lock
            return _yolo_model
        try:
            from ultralytics import YOLO
            model_path = os.path.join(MODEL_DIR, "yolov8n.pt")
            def _load():
                m = YOLO(model_path) if os.path.exists(model_path) else YOLO("yolov8n.pt")
                m.to(_resolve_device())
                return m
            _yolo_model = await asyncio.to_thread(_load)
            logger.info(f"YOLOv8 model loaded (shared instance) on {_resolve_device()}")
        except Exception as e:
            logger.error(f"Failed to load YOLO: {e}")
            raise
    return _yolo_model


async def _get_ocr():
    """
    Get EasyOCR reader. Returns False if models are unavailable or network blocked.
    OCR is optional — detections still flow without it, just no plate number.
    Never attempts network downloads at runtime.
    """
    global _ocr_engine, _ocr_available
    if _ocr_available is not None:
        return _ocr_engine  # False or Reader instance

    async with _ocr_lock:
        if _ocr_available is not None:
            return _ocr_engine

        model_dir = os.path.join(EASYOCR_CACHE, "model")
        craft_path = os.path.join(model_dir, "craft_mlt_25k.pth")
        rec_path   = os.path.join(model_dir, "english_g2.pth")

        models_baked = (
            os.path.exists(craft_path) and os.path.getsize(craft_path) > 1_000_000 and
            os.path.exists(rec_path)   and os.path.getsize(rec_path)   > 1_000_000
        )

        if not models_baked:
            logger.warning(
                "EasyOCR models not found in cache — OCR disabled. "
                "Rebuild image with internet access to bake models in. "
                "Detections will be stored without plate numbers."
            )
            _ocr_available = False
            _ocr_engine = False
            return False

        try:
            def _load():
                # Block all network access in EasyOCR — use only baked models
                os.environ["NO_PROXY"] = "*"
                os.environ["EASYOCR_DOWNLOAD"] = "false"
                import easyocr
                # Patch the download function to be a no-op
                try:
                    import easyocr.utils as eu
                    eu.download_and_unzip = lambda *a, **kw: None
                except Exception:
                    pass
                return easyocr.Reader(
                    ['en'], gpu=(AI_DEVICE != 'cpu'), verbose=False,
                    model_storage_directory=model_dir,
                    download_enabled=False,
                )
            _ocr_engine = await asyncio.to_thread(_load)
            _ocr_available = True
            logger.info("EasyOCR loaded from baked models")
        except Exception as e:
            logger.warning(f"EasyOCR init failed ({e}) — OCR disabled")
            _ocr_available = False
            _ocr_engine = False

    return _ocr_engine


def _normalize_plate(raw_text: str) -> Optional[str]:
    """
    Validate OCR text as an Indian vehicle registration plate.
    Accepts formats like GJ01AB1234, MH12CD3456, DL8CAF1234.
    Strips spaces/dashes, applies common OCR digit confusions, and
    returns the cleaned plate only if it matches the standard shape:
      2 letters (state) + 1-2 digits (RTO) + 1-3 letters + 4 digits.
    Returns None for anything else (signboards, random text).
    """
    if not raw_text:
        return None
    text = "".join(ch for ch in raw_text.upper() if ch.isalnum())
    if not (8 <= len(text) <= 12):
        return None
    _plate_re = re.compile(r"^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$")
    if _plate_re.match(text):
        return text
    # Common OCR digit confusions: O/I/Z/S read for 0/1/2/5
    for ch, digit in (("O", "0"), ("I", "1"), ("Z", "2"), ("S", "5")):
        cand = text.replace(ch, digit)
        if _plate_re.match(cand):
            return cand
    return None


async def _get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(REDIS_URL, decode_responses=True)
    return _redis


# ─── DB camera metadata loader ────────────────────────────────
async def _load_camera_metadata() -> dict[str, dict]:
    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
    from sqlalchemy import text as sa_text
    import re

    meta: dict[str, dict] = {}
    try:
        engine = create_async_engine(DATABASE_URL, echo=False, pool_size=2, max_overflow=0)
        Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        async with Session() as db:
            result = await db.execute(
                sa_text("""
                    SELECT id::text, name, lat, lng, rtsp_url
                    FROM cameras
                    WHERE rtsp_url LIKE '%/stream/cam%'
                    ORDER BY name
                """)
            )
            rows = result.mappings().all()
        await engine.dispose()

        for row in rows:
            rtsp = row["rtsp_url"] or ""
            m = re.search(r"/stream/(cam\d+)", rtsp)
            if not m:
                continue
            sid = m.group(1)
            meta[sid] = {
                "id":   row["id"],
                "name": row["name"],
                "lat":  float(row["lat"] or 0),
                "lng":  float(row["lng"] or 0),
            }
        logger.info(f"Loaded metadata for {len(meta)} cameras from DB")
    except Exception as e:
        logger.warning(f"DB metadata load failed ({e}) — using computed UUIDs")
    return meta


# ─── Stream ingestion worker ──────────────────────────────────
async def _process_stream(stream_id: str):
    """
    Connect to a Sentinel RTSP stream and run YOLO inference on frames.

    Memory management:
    - Single shared YOLO model (not reloaded per stream)
    - _inference_sem caps concurrent inference to MAX_CONCURRENT_INFERENCE
    - OCR is optional — if unavailable, detection is stored without plate
    - FPS default is 1 (configurable via AI_FPS_DEFAULT env)
    """
    cam_meta = _camera_meta.get(stream_id)
    if cam_meta:
        camera_uuid = cam_meta["id"]
        camera_name = cam_meta["name"]
        lat = cam_meta["lat"]
        lng = cam_meta["lng"]
    else:
        camera_uuid = stream_id_to_uuid(stream_id)
        camera_name = f"Sentinel {stream_id.upper()}"
        lat = 0.0
        lng = 0.0

    rtsp_url = get_rtsp_url(stream_id)
    logger.info(f"Starting stream processor: {stream_id} → {camera_uuid} ({camera_name}) @ {rtsp_url}")

    retries = 0
    while True:
        cap = None
        try:
            cap = await asyncio.to_thread(cv2.VideoCapture, rtsp_url, cv2.CAP_FFMPEG)
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

            if not cap.isOpened():
                logger.warning(f"Cannot connect to {stream_id}, retrying in 10s...")
                await asyncio.sleep(10)
                continue

            retries = 0
            logger.info(f"Connected to {stream_id}")

            # Load YOLO once — shared across all streams
            model = await _get_yolo()

            frame_interval = 1.0 / AI_FPS_DEFAULT
            last_process_pts_ms = -1

            while True:
                ret, frame = await asyncio.to_thread(cap.read)
                if not ret:
                    logger.warning(f"{stream_id} lost frame, reconnecting...")
                    break

                pts_ms = cap.get(cv2.CAP_PROP_POS_MSEC)
                if pts_ms < 0:
                    continue
                if pts_ms < last_process_pts_ms:
                    last_process_pts_ms = pts_ms
                if (pts_ms - last_process_pts_ms) < (frame_interval * 1000):
                    continue
                last_process_pts_ms = pts_ms

                # Acquire semaphore before running inference
                # This prevents all 8 streams from inferring simultaneously
                async with _inference_sem:
                    try:
                        h, w = frame.shape[:2]

                        def run_inference(f=frame):
                            return model(f, conf=AI_CONFIDENCE, classes=[0, 2, 3, 5, 7], verbose=False, device=AI_DEVICE)

                        results = await asyncio.to_thread(run_inference)

                        CLASS_MAP = {0: "person", 2: "car", 3: "motorcycle", 5: "bus", 7: "truck"}
                        r = await _get_redis()

                        for r_box in results:
                            for box in r_box.boxes:
                                cls  = int(box.cls[0])
                                conf = float(box.conf[0])
                                x1, y1, x2, y2 = box.xyxy[0].tolist()

                                det_type  = "person" if cls == 0 else "vehicle"
                                obj_class = CLASS_MAP.get(cls, "unknown")
                                bbox      = {
                                    "x": int(x1), "y": int(y1),
                                    "w": int(x2 - x1), "h": int(y2 - y1),
                                }

                                event: dict = {
                                    "camera_id":         camera_uuid,
                                    "camera_name":       camera_name,
                                    "lat":               str(lat),
                                    "lng":               str(lng),
                                    "detected_at":       datetime.now(timezone.utc).isoformat(),
                                    "detection_type":    det_type,
                                    "object_class":      obj_class,
                                    "object_confidence": str(conf),
                                    "bbox":              json.dumps(bbox),
                                    "model_version":     "yolov8n",
                                }

                                # OCR — optional, only for vehicle crops
                                if det_type == "vehicle":
                                    ocr = await _get_ocr()
                                    if ocr:
                                        try:
                                            crop = frame[max(0, int(y1)):int(y2), max(0, int(x1)):int(x2)]
                                            if crop.size > 0 and crop.shape[0] > 20 and crop.shape[1] > 40:
                                                hit = await asyncio.to_thread(_ocr_read_plate, crop, ocr)
                                                if hit:
                                                    event["plate_number"]     = hit[1]
                                                    event["plate_confidence"] = str(hit[0])
                                                    event["plate_raw_ocr"]    = hit[2]
                                        except Exception as e:
                                            logger.debug(f"OCR failed for {stream_id}: {e}")

                                await r.xadd("detection_events", event, maxlen=10000)

                    except Exception as e:
                        logger.error(f"Inference error on {stream_id}: {e}")

        except asyncio.CancelledError:
            logger.info(f"{stream_id} processor shutting down")
            break
        except Exception as e:
            logger.error(f"{stream_id} error: {e}")
        finally:
            if cap:
                cap.release()

        backoff = min(2 * (2 ** retries), 30)
        retries += 1
        logger.info(f"{stream_id} reconnecting in {backoff}s (attempt {retries})")
        await asyncio.sleep(backoff)



# ─── App lifecycle ────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    global _stream_tasks, _camera_meta, _inference_sem

    _inference_sem = asyncio.Semaphore(MAX_CONCURRENT_INFERENCE)
    logger.info(f"Inference semaphore: max {MAX_CONCURRENT_INFERENCE} concurrent")

    logger.info("Loading camera metadata from DB...")
    _camera_meta = await _load_camera_metadata()

    # Per Sentinel Integrator Guide: fetch camera list from cameras.json
    # rather than hard-coding. Falls back to cam01–cam30 if unavailable.
    configured = [s.strip() for s in CAMERA_STREAMS if s.strip()]
    if configured:
        stream_ids = configured
        logger.info(f"Using {len(stream_ids)} configured streams from CAMERA_STREAMS")
    else:
        stream_ids = await _fetch_camera_list()
        logger.info(f"Fetched {len(stream_ids)} cameras from Sentinel catalogue")

    logger.info(f"Starting processors for {len(stream_ids)} streams: {stream_ids}")

    try:
        await _get_yolo()
        logger.info("YOLO pre-warmed successfully")
    except Exception as e:
        logger.error(f"YOLO pre-warm failed: {e}")

    for i, sid in enumerate(stream_ids):
        task = asyncio.create_task(_process_stream(sid))
        _stream_tasks.append(task)
        if i < len(stream_ids) - 1:
            await asyncio.sleep(2)

    logger.info(f"AI service started — processing {len(stream_ids)} streams")
    yield

    for task in _stream_tasks:
        task.cancel()
    for task in _stream_tasks:
        try:
            await task
        except asyncio.CancelledError:
            pass
    _stream_tasks.clear()
    logger.info("AI service stopped")


app = FastAPI(title="GICVMAP — AI Inference Service", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/health")
async def health():
    stream_ids = [s.strip() for s in CAMERA_STREAMS if s.strip()]
    return {
        "status": "ok",
        "service": "ai-service",
        "device": AI_DEVICE,
        "streams_configured": len(stream_ids),
        "streams_active": len(_stream_tasks),
        "camera_meta_loaded": len(_camera_meta),
        "yolo_loaded": _yolo_model is not None,
        "ocr_available": _ocr_available,
        "max_concurrent_inference": MAX_CONCURRENT_INFERENCE,
        "fps_default": AI_FPS_DEFAULT,
    }


@app.post("/infer", response_model=InferenceResult)
async def infer_frame(
    camera_id: str = "unknown",
    frame: UploadFile = File(...),
):
    start = time.time()
    contents = await frame.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=400, detail="Invalid image")

    model = await _get_yolo()
    h, w = img.shape[:2]
    results = model(img, conf=AI_CONFIDENCE, classes=[0, 2, 3, 5, 7])

    CLASS_MAP = {0: "person", 2: "car", 3: "motorcycle", 5: "bus", 7: "truck"}
    detections = []

    for r in results:
        for box in r.boxes:
            cls = int(box.cls[0])
            conf = float(box.conf[0])
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            det_type = "person" if cls == 0 else "vehicle"
            obj_class = CLASS_MAP.get(cls, "unknown")
            bbox = {"x": int(x1), "y": int(y1), "w": int(x2 - x1), "h": int(y2 - y1)}

            plate_number = None
            plate_confidence = None
            plate_raw = None

            if det_type == "vehicle":
                try:
                    crop = img[int(y1):int(y2), int(x1):int(x2)]
                    if crop.size > 0:
                        ocr = await _get_ocr()
                        if ocr:
                            hit = await asyncio.to_thread(_ocr_read_plate, crop, ocr)
                            if hit:
                                plate_number = hit[1]
                                plate_confidence = hit[0]
                                plate_raw = hit[2]
                except Exception:
                    pass

            detections.append(DetectionEvent(
                camera_id=camera_id,
                detected_at=datetime.now(timezone.utc).isoformat(),
                detection_type=det_type,
                plate_number=plate_number,
                plate_confidence=plate_confidence,
                plate_raw_ocr=plate_raw,
                object_class=obj_class,
                object_confidence=conf,
                bbox=bbox,
            ))

    elapsed_ms = int((time.time() - start) * 1000)
    r = await _get_redis()
    for det in detections:
        try:
            await r.xadd(
                "detection_events",
                {k: str(v) for k, v in det.model_dump().items() if v is not None},
                maxlen=10000,
            )
        except Exception as e:
            logger.error(f"Failed to publish event: {e}")

    return InferenceResult(detections=detections, processing_time_ms=elapsed_ms, frame_size=(w, h))


@app.post("/infer/url")
async def infer_from_url(camera_id: str, rtsp_url: str):
    cap = cv2.VideoCapture(rtsp_url, cv2.CAP_FFMPEG)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
    if not cap.isOpened():
        raise HTTPException(status_code=502, detail="Cannot connect to stream")
    ret, frame = cap.read()
    cap.release()
    if not ret:
        raise HTTPException(status_code=502, detail="Failed to grab frame")
    _, buffer = cv2.imencode(".jpg", frame)
    import io
    upload = UploadFile(filename="frame.jpg", file=io.BytesIO(buffer.tobytes()))
    return await infer_frame(camera_id=camera_id, frame=upload)



