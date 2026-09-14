import json
import asyncio
import logging
from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from shared.database import get_db
from shared.auth import get_current_user, require_role, UserContext
from shared.models import AlertResponse, AlertAckRequest
from shared.errors import NotFoundError
from shared.dept import apply_dept_filter

logger = logging.getLogger("alert-router")
router = APIRouter()

# In-memory WebSocket connections (per-instance)
ws_connections: list[WebSocket] = []


@router.websocket("/ws")
async def alert_websocket(websocket: WebSocket):
    await websocket.accept()
    ws_connections.append(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_connections.remove(websocket)


async def _start_redis_subscriber():
    """Subscribe to Redis pub/sub and broadcast to WebSocket clients."""
    import redis.asyncio as aioredis
    from shared.config import settings
    try:
        r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        pubsub = r.pubsub()
        await pubsub.subscribe("ws_broadcast")
        logger.info("WebSocket subscriber listening on Redis 'ws_broadcast' channel")
        async for message in pubsub.listen():
            if message["type"] == "message":
                data = message["data"]
                if isinstance(data, str):
                    try:
                        alert_data = json.loads(data)
                        await broadcast_alert(alert_data)
                    except json.JSONDecodeError:
                        pass
    except Exception as e:
        logger.error(f"Redis subscriber error: {e}")


@router.get("", response_model=list[AlertResponse])
async def list_alerts(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    severity: Optional[str] = None,
    camera_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    conditions = []
    params = {}
    if status:
        conditions.append("a.status = :status")
        params["status"] = status
    if severity:
        conditions.append("a.severity = :sev")
        params["sev"] = severity
    if camera_id:
        conditions.append("a.camera_id = CAST(:cam_id AS UUID)")
        params["cam_id"] = camera_id

    # Department isolation: join cameras to filter by department
    dept_join = ""
    if user.role != "superadmin" and user.department_id is not None:
        dept_join = "JOIN cameras c ON a.camera_id = c.id"
        conditions.append("c.department_id = :_dept_id")
        params["_dept_id"] = user.department_id

    where = "WHERE " + " AND ".join(conditions) if conditions else ""
    offset = (page - 1) * per_page
    params["limit"] = per_page
    params["offset"] = offset

    result = await db.execute(
        text(f"""
            SELECT a.id, a.watchlist_id, a.detection_id, a.camera_id, a.triggered_at,
                   a.severity, a.status, a.match_type, a.match_confidence,
                   a.plate_number, a.watchlist_reason, a.camera_name,
                   a.camera_lat, a.camera_lng, a.snapshot_url,
                   a.acknowledged_by, a.acknowledged_at, a.dismissed_by,
                   a.dismissed_at, a.notes, a.created_at
            FROM alerts a {dept_join} {where}
            ORDER BY a.triggered_at DESC
            LIMIT :limit OFFSET :offset
        """),
        params,
    )
    return [dict(r) for r in result.mappings().all()]


@router.get("/count")
async def alert_count(
    status: Optional[str] = "new",
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    conditions = []
    params = {}
    if status:
        conditions.append("a.status = :status")
        params["status"] = status

    # Department isolation
    dept_join = ""
    if user.role != "superadmin" and user.department_id is not None:
        dept_join = "JOIN cameras c ON a.camera_id = c.id"
        conditions.append("c.department_id = :_dept_id")
        params["_dept_id"] = user.department_id

    where = "WHERE " + " AND ".join(conditions) if conditions else ""
    result = await db.execute(text(f"SELECT COUNT(*) as count FROM alerts a {dept_join} {where}"), params)
    row = result.mappings().first()
    return {"count": row["count"], "status": status}


@router.get("/{alert_id}", response_model=AlertResponse)
async def get_alert(alert_id: int, db: AsyncSession = Depends(get_db),
                    user: UserContext = Depends(get_current_user)):
    result = await db.execute(text("SELECT * FROM alerts WHERE id = :id"), {"id": alert_id})
    row = result.mappings().first()
    if not row:
        raise NotFoundError("Alert", str(alert_id))
    return dict(row)


@router.post("/{alert_id}/acknowledge", response_model=AlertResponse)
async def acknowledge_alert(alert_id: int, req: AlertAckRequest = AlertAckRequest(),
                            db: AsyncSession = Depends(get_db),
                            user: UserContext = Depends(require_role("operator"))):
    result = await db.execute(
        text("""
            UPDATE alerts SET status = 'acknowledged', acknowledged_by = :user,
                acknowledged_at = now(), notes = COALESCE(:notes, notes)
            WHERE id = :id AND status = 'new'
            RETURNING *
        """),
        {"id": alert_id, "user": user.username, "notes": req.notes},
    )
    row = result.mappings().first()
    if not row:
        raise NotFoundError("Alert", str(alert_id))
    await db.commit()
    return dict(row)


@router.post("/{alert_id}/dismiss", response_model=AlertResponse)
async def dismiss_alert(alert_id: int, req: AlertAckRequest = AlertAckRequest(),
                        db: AsyncSession = Depends(get_db),
                        user: UserContext = Depends(require_role("operator"))):
    result = await db.execute(
        text("""
            UPDATE alerts SET status = 'dismissed', dismissed_by = :user,
                dismissed_at = now(), notes = COALESCE(:notes, notes)
            WHERE id = :id AND status IN ('new', 'acknowledged')
            RETURNING *
        """),
        {"id": alert_id, "user": user.username, "notes": req.notes},
    )
    row = result.mappings().first()
    if not row:
        raise NotFoundError("Alert", str(alert_id))
    await db.commit()
    return dict(row)


async def broadcast_alert(alert_data: dict):
    """Push alert to all connected WebSocket clients."""
    disconnected = []
    for ws in ws_connections:
        try:
            await ws.send_json(alert_data)
        except Exception:
            disconnected.append(ws)
    for ws in disconnected:
        ws_connections.remove(ws)


# ─── Alert Rules CRUD ─────────────────────────────────────────

@router.get("/rules/list")
async def list_alert_rules(
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(require_role("operator")),
):
    result = await db.execute(text("SELECT * FROM alert_rules ORDER BY id"))
    rows = result.mappings().all()
    out = []
    for r in rows:
        d = dict(r)
        if hasattr(d.get("notification_channels"), "tolist"):
            d["notification_channels"] = d["notification_channels"].tolist()
        d.setdefault("created_by", "")
        out.append(d)
    return out


@router.post("/rules")
async def create_alert_rule(
    name: str,
    description: str = "",
    trigger_type: str = "plate_match",
    condition_config: dict = {},
    severity: str = "medium",
    enabled: bool = True,
    notification_channels: list[str] = ["in_app"],
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(require_role("operator")),
):
    import json
    result = await db.execute(
        text("""
            INSERT INTO alert_rules (name, description, trigger_type, condition_config, severity, enabled, notification_channels, created_by)
            VALUES (:name, :desc, :tt, CAST(:cond AS jsonb), :sev, :en, :nc, :cb)
            RETURNING *
        """),
        {
            "name": name,
            "desc": description,
            "tt": trigger_type,
            "cond": json.dumps(condition_config),
            "sev": severity,
            "en": enabled,
            "nc": notification_channels,
            "cb": user.username,
        },
    )
    row = result.mappings().first()
    await db.commit()
    d = dict(row)
    if hasattr(d.get("notification_channels"), "tolist"):
        d["notification_channels"] = d["notification_channels"].tolist()
    return d


@router.put("/rules/{rule_id}")
async def update_alert_rule(
    rule_id: int,
    name: str = None,
    description: str = None,
    trigger_type: str = None,
    condition_config: dict = None,
    severity: str = None,
    enabled: bool = None,
    notification_channels: list[str] = None,
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(require_role("operator")),
):
    import json
    sets, params = [], {"id": rule_id}
    if name is not None:
        sets.append("name = :name"); params["name"] = name
    if description is not None:
        sets.append("description = :desc"); params["desc"] = description
    if trigger_type is not None:
        sets.append("trigger_type = :tt"); params["tt"] = trigger_type
    if condition_config is not None:
        sets.append("condition_config = CAST(:cond AS jsonb)"); params["cond"] = json.dumps(condition_config)
    if severity is not None:
        sets.append("severity = :sev"); params["sev"] = severity
    if enabled is not None:
        sets.append("enabled = :en"); params["en"] = enabled
    if notification_channels is not None:
        sets.append("notification_channels = :nc"); params["nc"] = notification_channels
    if not sets:
        raise HTTPException(status_code=400, detail="No fields to update")
    sets.append("updated_at = now()")
    result = await db.execute(
        text(f"UPDATE alert_rules SET {', '.join(sets)} WHERE id = :id RETURNING *"), params
    )
    row = result.mappings().first()
    if not row:
        raise NotFoundError("AlertRule", str(rule_id))
    await db.commit()
    d = dict(row)
    if hasattr(d.get("notification_channels"), "tolist"):
        d["notification_channels"] = d["notification_channels"].tolist()
    return d


@router.delete("/rules/{rule_id}")
async def delete_alert_rule(
    rule_id: int,
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(require_role("operator")),
):
    result = await db.execute(
        text("DELETE FROM alert_rules WHERE id = :id RETURNING id"), {"id": rule_id}
    )
    row = result.mappings().first()
    if not row:
        raise NotFoundError("AlertRule", str(rule_id))
    await db.commit()
    return {"deleted": True, "id": rule_id}


# ─── CSV Export ───────────────────────────────────────────────

@router.get("/export/csv")
async def export_alerts_csv(
    status: Optional[str] = None,
    severity: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    from fastapi.responses import StreamingResponse
    import csv, io

    conditions, params = [], {}
    if status:
        conditions.append("a.status = :status"); params["status"] = status
    if severity:
        conditions.append("a.severity = :sev"); params["sev"] = severity

    dept_join = ""
    if user.role != "superadmin" and user.department_id is not None:
        dept_join = "JOIN cameras c ON a.camera_id = c.id"
        conditions.append("c.department_id = :_dept_id"); params["_dept_id"] = user.department_id

    where = "WHERE " + " AND ".join(conditions) if conditions else ""
    result = await db.execute(
        text(f"""
            SELECT a.id, a.severity, a.status, a.match_type, a.plate_number,
                   a.watchlist_reason, a.camera_name, a.triggered_at, a.acknowledged_by, a.acknowledged_at
            FROM alerts a {dept_join} {where}
            ORDER BY a.triggered_at DESC LIMIT 5000
        """),
        params,
    )
    rows = result.mappings().all()

    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["ID", "Severity", "Status", "Match Type", "Plate Number", "Watchlist Reason", "Camera", "Triggered At", "Ack By", "Ack At"])
    for r in rows:
        w.writerow([r["id"], r["severity"], r["status"], r["match_type"], r["plate_number"],
                     r["watchlist_reason"], r["camera_name"], r["triggered_at"], r["acknowledged_by"], r["acknowledged_at"]])

    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=alerts_export.csv"},
    )
