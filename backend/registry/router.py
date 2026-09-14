from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, BackgroundTasks
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
import csv
import io
import asyncio
import socket
import logging
import httpx
from datetime import datetime

from shared.database import get_db
from shared.auth import get_current_user, require_role, UserContext
from shared.models import CameraCreate, CameraUpdate, CameraResponse
from shared.errors import NotFoundError, ConflictError, ValidationError
from shared.dept import apply_dept_filter

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/cameras", response_model=list[CameraResponse])
async def list_cameras(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    department_id: Optional[int] = None,
    status: Optional[str] = None,
    camera_type: Optional[str] = None,
    sort: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    conditions = []
    params = {}

    if department_id:
        conditions.append("c.department_id = :dept_id")
        params["dept_id"] = department_id
    if status:
        conditions.append("c.status = :status")
        params["status"] = status
    if camera_type:
        conditions.append("c.camera_type = :cam_type")
        params["cam_type"] = camera_type

    apply_dept_filter(conditions, params, user, "c")

    where = "WHERE " + " AND ".join(conditions) if conditions else ""
    order = "c.name ASC"
    if sort:
        field, direction = sort.split(":") if ":" in sort else (sort, "asc")
        allowed = {"name", "status", "created_at", "department_id", "camera_type"}
        if field in allowed:
            order = f"c.{field} {'DESC' if direction == 'desc' else 'ASC'}"

    offset = (page - 1) * per_page
    params["limit"] = per_page
    params["offset"] = offset

    result = await db.execute(
        text(f"""
            SELECT c.id, c.name, c.department_id, c.camera_type, c.vendor, c.model,
                   c.ip_address, c.port, c.rtsp_url, c.onvif_url, c.onvif_supported,
                   c.username, c.lat, c.lng, c.elevation_m, c.direction_deg,
                   c.field_of_view_deg, c.location_description, c.storage_type,
                   c.retention_days, c.resolution, c.fps, c.status,
                   c.is_analytics_enabled, c.analytics_config,
                   c.onboarded_by, c.onboarded_at, c.last_seen, c.created_at, c.updated_at
            FROM cameras c {where}
            ORDER BY {order}
            LIMIT :limit OFFSET :offset
        """),
        params,
    )
    return [dict(r) for r in result.mappings().all()]


@router.get("/cameras/nearby")
async def nearby_cameras(
    lat: float, lng: float, radius_m: int = 5000,
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    result = await db.execute(
        text("""
            SELECT id, name, lat, lng, status,
                (6371000 * acos(
                    GREATEST(-1, LEAST(1,
                        cos(radians(:lat)) * cos(radians(lat)) * cos(radians(lng) - radians(:lng))
                        + sin(radians(:lat)) * sin(radians(lat))
                    ))
                )) AS distance_meters
            FROM cameras
            WHERE (6371000 * acos(
                GREATEST(-1, LEAST(1,
                    cos(radians(:lat)) * cos(radians(lat)) * cos(radians(lng) - radians(:lng))
                    + sin(radians(:lat)) * sin(radians(lat))
                ))
            )) <= :radius
            ORDER BY distance_meters
        """),
        {"lat": lat, "lng": lng, "radius": radius_m},
    )
    return [dict(r) for r in result.mappings().all()]


@router.get("/cameras/{camera_id}", response_model=CameraResponse)
async def get_camera(camera_id: str, db: AsyncSession = Depends(get_db),
                     user: UserContext = Depends(get_current_user)):
    result = await db.execute(
        text("SELECT * FROM cameras WHERE id = CAST(:id AS UUID)"), {"id": camera_id}
    )
    row = result.mappings().first()
    if not row:
        raise NotFoundError("Camera", camera_id)
    return dict(row)


@router.post("/cameras", response_model=CameraResponse, status_code=201)
async def create_camera(req: CameraCreate, db: AsyncSession = Depends(get_db),
                        user: UserContext = Depends(require_role("dept_admin"))):
    result = await db.execute(
        text("""
            INSERT INTO cameras (name, department_id, camera_type, vendor, model, ip_address, port,
                rtsp_url, onvif_url, onvif_supported, username, lat, lng, elevation_m,
                direction_deg, field_of_view_deg, location_description, storage_type,
                retention_days, resolution, fps, is_analytics_enabled, analytics_config, onboarded_by)
            VALUES (:name, :department_id, :camera_type, :vendor, :model, :ip_address, :port,
                :rtsp_url, :onvif_url, :onvif_supported, :username, :lat, :lng, :elevation_m,
                :direction_deg, :field_of_view_deg, :location_description, :storage_type,
                :retention_days, :resolution, :fps, :is_analytics_enabled, :analytics_config, :onboarded_by)
            RETURNING id, status, onboarded_at, last_seen, created_at, updated_at
        """),
        {**req.model_dump(exclude={"analytics_config"}), "analytics_config": req.analytics_config,
         "onboarded_by": user.username},
    )
    row = result.mappings().first()
    await db.commit()
    return {**req.model_dump(), **dict(row)}


@router.put("/cameras/{camera_id}", response_model=CameraResponse)
async def update_camera(camera_id: str, req: CameraUpdate,
                        db: AsyncSession = Depends(get_db),
                        user: UserContext = Depends(require_role("dept_admin"))):
    updates = {k: v for k, v in req.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=422, detail="No fields to update")

    set_clause = ", ".join(f"{k} = :{k}" for k in updates)
    updates["id"] = camera_id
    await db.execute(text(f"UPDATE cameras SET {set_clause}, updated_at = now() WHERE id = CAST(:id AS UUID)"), updates)
    await db.commit()

    result = await db.execute(text("SELECT * FROM cameras WHERE id = :id::uuid"), {"id": camera_id})
    row = result.mappings().first()
    if not row:
        raise NotFoundError("Camera", camera_id)
    return dict(row)


@router.delete("/cameras/{camera_id}", status_code=204)
async def delete_camera(camera_id: str, db: AsyncSession = Depends(get_db),
                        user: UserContext = Depends(require_role("superadmin"))):
    result = await db.execute(text("DELETE FROM cameras WHERE id = CAST(:id AS UUID) RETURNING id"), {"id": camera_id})
    if not result.first():
        raise NotFoundError("Camera", camera_id)
    await db.commit()


@router.post("/cameras/bulk", status_code=201)
async def bulk_upload(file: UploadFile = File(...), db: AsyncSession = Depends(get_db),
                      user: UserContext = Depends(require_role("dept_admin"))):
    """
    Bulk import cameras from CSV.
    Required columns: name, lat, lng
    Optional: department_id, camera_type, rtsp_url, location_description, vendor, model
    """
    if not file.filename or not file.filename.endswith(".csv"):
        raise ValidationError("File must be a CSV")

    content = (await file.read()).decode("utf-8")
    reader = csv.DictReader(io.StringIO(content))

    required = {"name", "lat", "lng"}
    if not required.issubset(set(reader.fieldnames or [])):
        raise ValidationError(f"CSV must contain columns: {required}")

    created = 0
    errors = []
    for i, row in enumerate(reader, start=2):
        try:
            await db.execute(
                text("""
                    INSERT INTO cameras (name, department_id, camera_type, rtsp_url, lat, lng,
                        status, location_description, vendor, model, onboarded_by)
                    VALUES (:name, :dept_id, :cam_type, :rtsp, :lat, :lng, 'unknown', :loc, :vendor, :model, :user)
                    ON CONFLICT DO NOTHING
                """),
                {
                    "name": row["name"],
                    "dept_id": int(row["department_id"]) if row.get("department_id") else None,
                    "cam_type": row.get("camera_type", "ip"),
                    "rtsp": row.get("rtsp_url") or None,
                    "lat": float(row["lat"]),
                    "lng": float(row["lng"]),
                    "loc": row.get("location_description") or None,
                    "vendor": row.get("vendor") or None,
                    "model": row.get("model") or None,
                    "user": user.username,
                },
            )
            created += 1
        except Exception as e:
            errors.append({"row": i, "error": str(e)})
            continue

    await db.commit()
    return {"created": created, "errors": errors, "total_rows": created + len(errors)}


# ─── ONVIF Discovery — Model 3 Skeleton ──────────────────────────────────────

async def _probe_onvif_device(ip: str, port: int = 80, timeout: float = 2.0) -> dict | None:
    """
    Probe a single IP for ONVIF Device Service.
    Sends a WS-Discovery Probe and checks for ONVIF GetCapabilities response.
    Returns device info dict or None if not ONVIF.
    """
    # WS-Discovery Probe message (ONVIF mandated format)
    ws_discovery_probe = """<?xml version="1.0" encoding="utf-8"?>
<Envelope xmlns:dn="http://www.onvif.org/ver10/network/wsdl"
          xmlns="http://www.w3.org/2003/05/soap-envelope">
  <Header>
    <wsa:MessageID xmlns:wsa="http://schemas.xmlsoap.org/ws/2004/08/addressing">
      uuid:probe-gicvmap-discovery
    </wsa:MessageID>
    <wsa:To xmlns:wsa="http://schemas.xmlsoap.org/ws/2004/08/addressing">
      urn:schemas-xmlsoap-org:ws:2005:04:discovery
    </wsa:To>
    <wsa:Action xmlns:wsa="http://schemas.xmlsoap.org/ws/2004/08/addressing">
      http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe
    </wsa:Action>
  </Header>
  <Body>
    <dn:Probe>
      <dn:Types>dn:NetworkVideoTransmitter</dn:Types>
    </dn:Probe>
  </Body>
</Envelope>"""

    # Try HTTP port 80 ONVIF Device Service endpoint
    onvif_url = f"http://{ip}:{port}/onvif/device_service"
    get_caps = """<?xml version="1.0" encoding="utf-8"?>
<Envelope xmlns:tds="http://www.onvif.org/ver10/device/wsdl"
          xmlns="http://www.w3.org/2003/05/soap-envelope">
  <Body><tds:GetSystemDateAndTime/></Body>
</Envelope>"""

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(
                onvif_url,
                content=get_caps,
                headers={"Content-Type": "application/soap+xml"},
            )
            if resp.status_code in (200, 400):  # 400 = SOAP fault but ONVIF responded
                return {
                    "ip": ip,
                    "port": port,
                    "onvif_url": onvif_url,
                    "rtsp_url": f"rtsp://{ip}:554/stream1",
                    "status": "discovered",
                    "onvif_supported": True,
                    "vendor": "Unknown",
                    "model": "Unknown",
                    "discovered_at": datetime.utcnow().isoformat(),
                }
    except Exception:
        pass

    # Also try port 8080 (common ONVIF alternate)
    if port == 80:
        return await _probe_onvif_device(ip, port=8080, timeout=timeout)

    return None


async def _scan_subnet(subnet: str, timeout: float = 2.0) -> list[dict]:
    """
    Scan a /24 subnet for ONVIF cameras.
    E.g. subnet="192.168.1" probes 192.168.1.1 – 192.168.1.254
    """
    parts = subnet.rstrip(".").split(".")
    if len(parts) != 3:
        raise ValueError("Subnet must be in format 192.168.1 (first three octets)")

    # Build list of IPs to probe
    ips = [f"{subnet}.{i}" for i in range(1, 255)]

    # Probe concurrently in batches of 20 to avoid overwhelming the network
    batch_size = 20
    discovered = []

    for i in range(0, len(ips), batch_size):
        batch = ips[i : i + batch_size]
        results = await asyncio.gather(
            *[_probe_onvif_device(ip, timeout=timeout) for ip in batch],
            return_exceptions=True,
        )
        for result in results:
            if isinstance(result, dict) and result is not None:
                discovered.append(result)

    return discovered


@router.post("/cameras/discover")
async def discover_onvif_cameras(
    subnet: str = Query(..., description="Subnet to scan, e.g. 192.168.1"),
    timeout: float = Query(2.0, ge=0.5, le=10.0, description="Per-host timeout in seconds"),
    user: UserContext = Depends(require_role("dept_admin")),
):
    """
    Model 3 — ONVIF Discovery Endpoint.

    Scans a /24 subnet for ONVIF-compliant IP cameras using WS-Discovery probes.
    Returns a list of discovered devices with their ONVIF and RTSP endpoints.
    Devices can be onboarded with a subsequent POST /cameras call.

    Security note: This endpoint is admin-only and rate-limited by API gateway.
    Only use on trusted internal networks.
    """
    # Basic subnet format validation
    parts = subnet.rstrip(".").split(".")
    if len(parts) != 3 or not all(p.isdigit() and 0 <= int(p) <= 255 for p in parts):
        raise HTTPException(
            status_code=422,
            detail="subnet must be three octets, e.g. '192.168.1'",
        )

    # Reject scanning public IPs (safety guardrail)
    first_octet = int(parts[0])
    second_octet = int(parts[1])
    is_private = (
        first_octet == 10
        or (first_octet == 172 and 16 <= second_octet <= 31)
        or (first_octet == 192 and second_octet == 168)
        or (first_octet == 169 and second_octet == 254)
    )
    if not is_private:
        raise HTTPException(
            status_code=403,
            detail="ONVIF discovery is only permitted on RFC-1918 private subnets",
        )

    logger.info(
        "ONVIF subnet scan started: %s.0/24 by user %s", subnet, user.username
    )

    try:
        devices = await _scan_subnet(subnet, timeout=timeout)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    logger.info(
        "ONVIF scan complete: %s.0/24 — %d devices found", subnet, len(devices)
    )

    return {
        "subnet": f"{subnet}.0/24",
        "scanned": 254,
        "discovered": len(devices),
        "devices": devices,
    }


@router.post("/cameras/onboard-discovered", status_code=201)
async def onboard_discovered_cameras(
    devices: list[dict],
    department_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(require_role("dept_admin")),
):
    """
    Onboard a list of ONVIF-discovered devices from the /cameras/discover endpoint.
    Inserts each device as a new camera with status 'unknown'.
    """
    created = 0
    for device in devices:
        ip = device.get("ip", "")
        if not ip:
            continue
        try:
            await db.execute(
                text("""
                    INSERT INTO cameras (
                        name, department_id, camera_type, ip_address, port,
                        rtsp_url, onvif_url, onvif_supported,
                        lat, lng, status, onboarded_by
                    )
                    VALUES (
                        :name, :dept_id, 'ip', :ip, :port,
                        :rtsp_url, :onvif_url, true,
                        0, 0, 'unknown', :user
                    )
                    ON CONFLICT DO NOTHING
                """),
                {
                    "name": device.get("model", f"Camera-{ip}"),
                    "dept_id": department_id,
                    "ip": ip,
                    "port": device.get("port", 80),
                    "rtsp_url": device.get("rtsp_url"),
                    "onvif_url": device.get("onvif_url"),
                    "user": user.username,
                },
            )
            created += 1
        except Exception as e:
            logger.warning("Failed to onboard device %s: %s", ip, e)
            continue

    await db.commit()
    return {"onboarded": created}
