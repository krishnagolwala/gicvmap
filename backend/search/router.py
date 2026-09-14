from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from datetime import datetime

from shared.database import get_db
from shared.auth import get_current_user, UserContext
from shared.models import VehicleSearchRequest, VehicleRouteResponse, RoutePoint
from shared.dept import apply_dept_filter

router = APIRouter()


@router.post("/vehicles/search", response_model=VehicleRouteResponse)
async def search_vehicle(
    req: VehicleSearchRequest,
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    normalized = req.plate_number.upper().replace(" ", "").replace("-", "")

    conditions = ["d.plate_normalized = :norm", "d.plate_number IS NOT NULL"]
    params = {"norm": normalized}

    if req.start_date:
        conditions.append("d.detected_at >= :start")
        params["start"] = req.start_date
    if req.end_date:
        conditions.append("d.detected_at <= :end")
        params["end"] = req.end_date
    if req.department_id:
        conditions.append("c.department_id = :dept")
        params["dept"] = req.department_id

    # Department isolation
    apply_dept_filter(conditions, params, user, "c")

    where = "WHERE " + " AND ".join(conditions)

    result = await db.execute(
        text(f"""
            SELECT d.id AS detection_id, d.detected_at, d.plate_number, d.plate_confidence,
                   d.snapshot_url, c.name AS camera_name, c.id AS camera_id, c.lat, c.lng
            FROM detections d
            JOIN cameras c ON d.camera_id = c.id
            {where}
            ORDER BY d.detected_at ASC
        """),
        params,
    )
    rows = result.mappings().all()

    if not rows:
        return VehicleRouteResponse(
            plate_number=req.plate_number, normalized=normalized,
            total_sightings=0, route=[],
        )

    return VehicleRouteResponse(
        plate_number=req.plate_number,
        normalized=normalized,
        total_sightings=len(rows),
        first_seen=rows[0]["detected_at"],
        last_seen=rows[-1]["detected_at"],
        route=[RoutePoint(**dict(r)) for r in rows],
    )


@router.get("/vehicles/{plate_number}/timeline")
async def vehicle_timeline(
    plate_number: str,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    normalized = plate_number.upper().replace(" ", "").replace("-", "")
    conditions = ["d.plate_normalized = :norm", "d.plate_number IS NOT NULL"]
    params = {"norm": normalized}

    if start_date:
        conditions.append("d.detected_at >= :start")
        params["start"] = start_date
    if end_date:
        conditions.append("d.detected_at <= :end")
        params["end"] = end_date

    # Department isolation
    apply_dept_filter(conditions, params, user, "c")

    where = "WHERE " + " AND ".join(conditions)

    result = await db.execute(
        text(f"""
            SELECT d.id, d.detected_at, d.detection_type, d.plate_number,
                   d.plate_confidence, d.object_class, d.snapshot_url,
                   c.name AS camera_name, c.id AS camera_id,
                   c.lat AS camera_lat, c.lng AS camera_lng
            FROM detections d
            JOIN cameras c ON d.camera_id = c.id
            {where}
            ORDER BY d.detected_at DESC
            LIMIT 200
        """),
        params,
    )
    return [dict(r) for r in result.mappings().all()]


@router.get("/vehicles/recent")
async def recent_vehicles(
    limit: int = Query(30, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    """
    Latest AI detections (vehicles) across all cameras — no plate required.
    Powers the live feed on the Vehicle Search screen.
    """
    conditions = ["d.detection_type = 'vehicle'"]
    params = {}
    apply_dept_filter(conditions, params, user, "c")
    where = "WHERE " + " AND ".join(conditions)

    result = await db.execute(
        text(f"""
            SELECT d.id AS detection_id, d.detected_at, d.detection_type,
                   d.plate_number, d.plate_confidence, d.object_class,
                   d.snapshot_url, c.name AS camera_name, c.id AS camera_id,
                   c.lat AS camera_lat, c.lng AS camera_lng
            FROM detections d
            JOIN cameras c ON d.camera_id = c.id
            {where}
            ORDER BY d.detected_at DESC
            LIMIT :limit
        """),
        {**params, "limit": limit},
    )
    return [dict(r) for r in result.mappings().all()]


@router.get("/stats/detections")
async def detection_stats(
    hours: int = Query(24, ge=1, le=168),
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    """
    Returns hourly detection buckets as an array.
    Each bucket: {hour, count, anpr_count, person_count}
    Reports.tsx expects an array, not a dict.
    """
    result = await db.execute(
        text("""
            SELECT
                to_char(
                    date_trunc('hour', detected_at),
                    'HH24:00'
                ) AS hour,
                COUNT(*)                                          AS count,
                COUNT(*) FILTER (WHERE plate_number IS NOT NULL) AS anpr_count,
                COUNT(*) FILTER (WHERE detection_type = 'person') AS person_count
            FROM detections
            WHERE detected_at >= now() - (:hours || ' hours')::interval
            GROUP BY date_trunc('hour', detected_at)
            ORDER BY date_trunc('hour', detected_at) ASC
        """),
        {"hours": str(hours)},
    )
    rows = result.mappings().all()
    return [
        {
            "hour":         r["hour"],
            "count":        r["count"],
            "anpr_count":   r["anpr_count"],
            "person_count": r["person_count"],
        }
        for r in rows
    ]


@router.get("/stats/cameras")
async def camera_stats(db: AsyncSession = Depends(get_db),
                       user: UserContext = Depends(get_current_user)):
    """Returns camera health counts as an array. Reports.tsx loops over this for pie chart."""
    result = await db.execute(
        text("SELECT status, COUNT(*) as count FROM cameras GROUP BY status ORDER BY status")
    )
    return [{"status": r["status"], "count": r["count"]} for r in result.mappings().all()]


# ─── Section 4: Analytics & AI — Crowd/Vehicle Counting, Anomaly Detection ──

@router.get("/stats/counting")
async def crowd_vehicle_counting(
    hours: int = Query(24, ge=1, le=168),
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    """
    Crowd & vehicle counting per camera.
    Returns per-camera vehicle count, person count, and density estimate.
    """
    result = await db.execute(
        text("""
            SELECT c.name AS camera_name, c.id AS camera_id,
                   c.lat, c.lng, c.department_id,
                   COUNT(*) FILTER (WHERE d.detection_type = 'vehicle') AS vehicle_count,
                   COUNT(*) FILTER (WHERE d.detection_type = 'person') AS person_count,
                   COUNT(*) AS total_detections,
                   MAX(d.detected_at) AS last_detection
            FROM cameras c
            LEFT JOIN detections d ON d.camera_id = c.id
                AND d.detected_at >= now() - (:hours || ' hours')::interval
            GROUP BY c.id, c.name, c.lat, c.lng, c.department_id
            ORDER BY total_detections DESC
        """),
        {"hours": str(hours)},
    )
    rows = []
    for r in result.mappings().all():
        d = dict(r)
        v = d["vehicle_count"] or 0
        p = d["person_count"] or 0
        # Density: classify based on detection volume per hour
        rate = (v + p) / max(hours, 1)
        if rate > 20:
            d["density"] = "high"
        elif rate > 5:
            d["density"] = "medium"
        else:
            d["density"] = "low"
        rows.append(d)
    return rows


@router.get("/stats/anomalies")
async def anomaly_detection(
    hours: int = Query(24, ge=1, le=168),
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    """
    Simple anomaly detection: flags cameras with unusual activity spikes
    or unusual time-of-day patterns.
    """
    # Get per-camera hourly counts
    result = await db.execute(
        text("""
            SELECT c.name AS camera_name, c.id AS camera_id,
                   to_char(date_trunc('hour', d.detected_at), 'HH24:00') AS hour,
                   COUNT(*) AS count
            FROM cameras c
            JOIN detections d ON d.camera_id = c.id
            WHERE d.detected_at >= now() - (:hours || ' hours')::interval
            GROUP BY c.id, c.name, hour
        """),
        {"hours": str(hours)},
    )
    from collections import defaultdict
    cam_hours = defaultdict(list)
    for r in result.mappings().all():
        cam_hours[r["camera_name"]].append({"hour": r["hour"], "count": r["count"]})

    anomalies = []
    for cam_name, hourly_data in cam_hours.items():
        counts = [h["count"] for h in hourly_data]
        if len(counts) < 3:
            continue
        mean = sum(counts) / len(counts)
        if mean == 0:
            continue
        std = (sum((c - mean) ** 2 for c in counts) / len(counts)) ** 0.5
        for h in hourly_data:
            if std > 0 and (h["count"] - mean) / std > 2.0:
                anomalies.append({
                    "camera_name": cam_name,
                    "hour": h["hour"],
                    "count": h["count"],
                    "expected_avg": round(mean, 1),
                    "deviation": round((h["count"] - mean) / std, 2),
                    "type": "activity_spike",
                    "severity": "high" if h["count"] > mean * 3 else "medium",
                })

    anomalies.sort(key=lambda a: a["deviation"], reverse=True)
    return anomalies[:50]


# ─── Section 9: Reports — Gap Analysis, Utilisation, Quality, Scalability ──

@router.get("/reports/gap-analysis")
async def gap_analysis(
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    """
    Gap analysis: identifies cameras with no recent detections,
    departments with low coverage, and zones without cameras.
    """
    # Cameras with no detections in last 24h
    no_detections = await db.execute(
        text("""
            SELECT c.id, c.name, c.department_id, c.lat, c.lng, c.status,
                   c.location_description,
                   MAX(d.detected_at) AS last_detection
            FROM cameras c
            LEFT JOIN detections d ON d.camera_id = c.id
                AND d.detected_at >= now() - INTERVAL '24 hours'
            WHERE d.id IS NULL
            GROUP BY c.id, c.name, c.department_id, c.lat, c.lng, c.status, c.location_description
            ORDER BY c.name
        """)
    )
    idle_cameras = [dict(r) for r in no_detections.mappings().all()]

    # Department coverage
    dept_coverage = await db.execute(
        text("""
            SELECT d.name AS department_name, d.code,
                   COUNT(c.id) AS total_cameras,
                   COUNT(c.id) FILTER (WHERE c.status = 'online') AS online,
                   COUNT(c.id) FILTER (WHERE c.is_analytics_enabled) AS analytics_enabled
            FROM departments d
            LEFT JOIN cameras c ON c.department_id = d.id
            GROUP BY d.id, d.name, d.code
            ORDER BY total_cameras DESC
        """)
    )
    departments = [dict(r) for r in dept_coverage.mappings().all()]

    # Overall stats
    total = await db.execute(text("SELECT COUNT(*) as total FROM cameras"))
    online = await db.execute(text("SELECT COUNT(*) as c FROM cameras WHERE status = 'online'"))
    with_analytics = await db.execute(text("SELECT COUNT(*) as c FROM cameras WHERE is_analytics_enabled"))

    return {
        "summary": {
            "total_cameras": total.scalar(),
            "online_cameras": online.scalar(),
            "analytics_enabled": with_analytics.scalar(),
            "idle_cameras_count": len(idle_cameras),
        },
        "idle_cameras": idle_cameras,
        "department_coverage": departments,
    }


@router.get("/reports/utilisation")
async def utilisation_report(
    hours: int = Query(24, ge=1, le=168),
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    """
    Camera utilisation report: detection throughput, AI processing efficiency,
    and storage utilisation estimates.
    """
    result = await db.execute(
        text("""
            SELECT c.name AS camera_name, c.id AS camera_id, c.fps,
                   c.resolution, c.retention_days, c.storage_type,
                   COUNT(d.id) AS detections,
                   COUNT(d.id) FILTER (WHERE d.plate_number IS NOT NULL) AS anpr_detections,
                   COUNT(d.id) FILTER (WHERE d.detection_type = 'person') AS person_detections,
                   AVG(d.processing_time_ms) AS avg_processing_ms
            FROM cameras c
            LEFT JOIN detections d ON d.camera_id = c.id
                AND d.detected_at >= now() - (:hours || ' hours')::interval
            GROUP BY c.id, c.name, c.fps, c.resolution, c.retention_days, c.storage_type
            ORDER BY detections DESC
        """),
        {"hours": str(hours)},
    )
    rows = []
    for r in result.mappings().all():
        d = dict(r)
        det_rate = (d["detections"] or 0) / max(hours, 1)
        d["detections_per_hour"] = round(det_rate, 1)
        d["avg_processing_ms"] = round(d["avg_processing_ms"] or 0, 1)
        # Estimated daily storage (assuming ~50KB per detection snapshot)
        d["estimated_daily_storage_mb"] = round(det_rate * 24 * 50 / 1024, 1)
        rows.append(d)
    return rows


@router.get("/reports/quality")
async def analytics_quality(
    hours: int = Query(24, ge=1, le=168),
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    """
    Analytics quality metrics: plate recognition confidence distribution,
    detection type breakdown, and model performance indicators.
    """
    # Plate confidence distribution
    conf_result = await db.execute(
        text("""
            SELECT
                CASE
                    WHEN plate_confidence >= 0.9 THEN 'high (90%+)'
                    WHEN plate_confidence >= 0.7 THEN 'good (70-90%)'
                    WHEN plate_confidence >= 0.5 THEN 'fair (50-70%)'
                    ELSE 'low (<50%)'
                END AS confidence_bucket,
                COUNT(*) AS count
            FROM detections
            WHERE plate_number IS NOT NULL
                AND detected_at >= now() - (:hours || ' hours')::interval
            GROUP BY confidence_bucket
            ORDER BY confidence_bucket
        """),
        {"hours": str(hours)},
    )
    confidence_dist = [dict(r) for r in conf_result.mappings().all()]

    # Detection type breakdown
    type_result = await db.execute(
        text("""
            SELECT detection_type, COUNT(*) AS count,
                   AVG(processing_time_ms) AS avg_ms,
                   AVG(object_confidence) AS avg_confidence
            FROM detections
            WHERE detected_at >= now() - (:hours || ' hours')::interval
            GROUP BY detection_type
        """),
        {"hours": str(hours)},
    )
    type_breakdown = [dict(r) for r in type_result.mappings().all()]

    # Overall quality score (simple heuristic)
    total_result = await db.execute(
        text("""
            SELECT COUNT(*) AS total,
                   COUNT(*) FILTER (WHERE plate_number IS NOT NULL) AS with_plate,
                   COUNT(*) FILTER (WHERE plate_confidence >= 0.7) AS high_conf,
                   AVG(processing_time_ms) AS avg_ms
            FROM detections
            WHERE detected_at >= now() - (:hours || ' hours')::interval
        """),
        {"hours": str(hours)},
    )
    stats = dict(total_result.mappings().first())
    total = stats["total"] or 0
    with_plate = stats["with_plate"] or 0
    high_conf = stats["high_conf"] or 0

    return {
        "summary": {
            "total_detections": total,
            "plate_recognition_rate": round(with_plate / total * 100, 1) if total > 0 else 0,
            "high_confidence_rate": round(high_conf / total * 100, 1) if total > 0 else 0,
            "avg_processing_time_ms": round(stats["avg_ms"] or 0, 1),
        },
        "confidence_distribution": confidence_dist,
        "type_breakdown": type_breakdown,
    }


@router.get("/reports/scalability")
async def scalability_report(
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    """
    Scalability summary: current capacity vs target (80,000 cameras).
    Includes infrastructure sizing and growth projections.
    """
    # Current stats
    cam_total = await db.execute(text("SELECT COUNT(*) as c FROM cameras"))
    cam_online = await db.execute(text("SELECT COUNT(*) as c FROM cameras WHERE status = 'online'"))
    det_total = await db.execute(text("SELECT COUNT(*) as c FROM detections"))
    det_today = await db.execute(
        text("SELECT COUNT(*) as c FROM detections WHERE detected_at >= CURRENT_DATE")
    )
    alert_total = await db.execute(text("SELECT COUNT(*) as c FROM alerts"))
    watchlist_total = await db.execute(text("SELECT COUNT(*) as c FROM watchlist WHERE is_active"))

    current = {
        "cameras_onboarded": cam_total.scalar(),
        "cameras_online": cam_online.scalar(),
        "total_detections": det_total.scalar(),
        "detections_today": det_today.scalar(),
        "total_alerts": alert_total.scalar(),
        "active_watchlist": watchlist_total.scalar(),
    }

    # Target: 80,000 cameras
    target = 80000
    current_cameras = current["cameras_onboarded"] or 1

    projections = {
        "target_cameras": target,
        "current_cameras": current_cameras,
        "coverage_percent": round(current_cameras / target * 100, 4),
        "estimated_daily_detections_at_scale": round(
            (current["detections_today"] or 0) * (target / current_cameras)
        ),
        "estimated_storage_tb": round(
            (current["detections_today"] or 0) * (target / current_cameras) * 50 / (1024 * 1024 * 1024), 2
        ),
        "gpu_nodes_needed": max(1, round(target / 200)),  # ~200 cameras per GPU node
        "estimated_bandwidth_gbps": round(target * 0.004, 2),  # 4 Mbps per camera
    }

    infrastructure = {
        "current": {
            "gpu": "NVIDIA RTX 2050 (4GB VRAM)",
            "ai_framework": "YOLOv8 + EasyOCR",
            "stream_relay": "MediaMTX",
            "database": "PostgreSQL 15 + pgvector",
            "message_queue": "Redis Streams",
            "object_storage": "MinIO (S3-compatible)",
        },
        "at_scale": {
            "gpu": "NVIDIA A100/H100 cluster",
            "ai_framework": "YOLOv8 + EasyOCR + TensorRT",
            "orchestration": "Kubernetes",
            "database": "PostgreSQL + TimescaleDB",
            "message_queue": "Apache Kafka",
            "object_storage": "S3/Ceph distributed storage",
            "edge_compute": "NVIDIA Jetson per-region",
        },
    }

    return {
        "current": current,
        "projections": projections,
        "infrastructure": infrastructure,
    }


# ─── CSV Export for vehicle sightings ────────────────────────

@router.get("/vehicles/{plate_number}/export/csv")
async def export_vehicle_csv(
    plate_number: str,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    from fastapi.responses import StreamingResponse
    import csv, io

    normalized = plate_number.upper().replace(" ", "").replace("-", "")
    conditions = ["d.plate_normalized = :norm", "d.plate_number IS NOT NULL"]
    params: dict = {"norm": normalized}
    if start_date:
        conditions.append("d.detected_at >= :start"); params["start"] = start_date
    if end_date:
        conditions.append("d.detected_at <= :end"); params["end"] = end_date

    apply_dept_filter(conditions, params, user, "c")
    where = "WHERE " + " AND ".join(conditions)

    result = await db.execute(
        text(f"""
            SELECT d.detected_at, d.plate_number, d.plate_confidence, c.name AS camera_name,
                   c.lat, c.lng
            FROM detections d JOIN cameras c ON d.camera_id = c.id
            {where} ORDER BY d.detected_at ASC LIMIT 5000
        """),
        params,
    )
    rows = result.mappings().all()

    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["Detected At", "Plate Number", "Confidence", "Camera", "Lat", "Lng"])
    for r in rows:
        w.writerow([r["detected_at"], r["plate_number"], r["plate_confidence"],
                     r["camera_name"], r["lat"], r["lng"]])
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={normalized}_sightings.csv"},
    )
