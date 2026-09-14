from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from shared.database import get_db
from shared.auth import get_current_user, require_role, UserContext
from shared.models import WatchlistCreate, WatchlistUpdate, WatchlistResponse
from shared.errors import NotFoundError, ConflictError
from shared.dept import apply_dept_filter

router = APIRouter()


@router.get("", response_model=list[WatchlistResponse])
async def list_watchlist(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    type: Optional[str] = None,
    category: Optional[str] = None,
    priority: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    conditions = []
    params = {}
    if type:
        conditions.append("w.type = :type")
        params["type"] = type
    if category:
        conditions.append("w.category = :cat")
        params["cat"] = category
    if priority:
        conditions.append("w.priority = :pri")
        params["pri"] = priority
    if is_active is not None:
        conditions.append("w.is_active = :active")
        params["active"] = is_active

    where = "WHERE " + " AND ".join(conditions) if conditions else ""
    offset = (page - 1) * per_page
    params["limit"] = per_page
    params["offset"] = offset

    result = await db.execute(
        text(f"""
            SELECT w.id, w.type, w.plate_number, w.plate_normalized, w.person_name,
                   w.person_photo_url, w.reason, w.category, w.priority,
                   w.source_system, w.external_id, w.fir_number, w.is_active,
                   w.added_by, w.added_at, w.updated_at, w.expires_at
            FROM watchlist w {where}
            ORDER BY w.added_at DESC
            LIMIT :limit OFFSET :offset
        """),
        params,
    )
    return [dict(r) for r in result.mappings().all()]


@router.get("/{watchlist_id}", response_model=WatchlistResponse)
async def get_watchlist_entry(watchlist_id: int, db: AsyncSession = Depends(get_db),
                              user: UserContext = Depends(get_current_user)):
    result = await db.execute(
        text("SELECT * FROM watchlist WHERE id = :id"), {"id": watchlist_id}
    )
    row = result.mappings().first()
    if not row:
        raise NotFoundError("Watchlist entry", str(watchlist_id))
    return dict(row)


@router.post("", response_model=WatchlistResponse, status_code=201)
async def create_watchlist(req: WatchlistCreate, db: AsyncSession = Depends(get_db),
                           user: UserContext = Depends(require_role("operator"))):
    result = await db.execute(
        text("""
            INSERT INTO watchlist (type, plate_number, person_name, person_photo_url,
                reason, category, priority, source_system,
                external_id, fir_number, is_active, expires_at, added_by)
            VALUES (:type, :plate_number, :person_name, :person_photo_url,
                :reason, :category, :priority, :source_system,
                :external_id, :fir_number, :is_active, :expires_at, :added_by)
            RETURNING id, plate_normalized, added_at, updated_at
        """),
        {**req.model_dump(), "added_by": user.username},
    )
    row = result.mappings().first()
    await db.commit()
    return {**req.model_dump(), **dict(row)}


@router.put("/{watchlist_id}", response_model=WatchlistResponse)
async def update_watchlist(watchlist_id: int, req: WatchlistUpdate,
                           db: AsyncSession = Depends(get_db),
                           user: UserContext = Depends(require_role("operator"))):
    updates = {k: v for k, v in req.model_dump().items() if v is not None}
    if not updates:
        from fastapi import HTTPException
        raise HTTPException(status_code=422, detail="No fields to update")

    set_clause = ", ".join(f"{k} = :{k}" for k in updates)
    updates["id"] = watchlist_id
    await db.execute(text(f"UPDATE watchlist SET {set_clause}, updated_at = now() WHERE id = :id"), updates)
    await db.commit()

    result = await db.execute(text("SELECT * FROM watchlist WHERE id = :id"), {"id": watchlist_id})
    row = result.mappings().first()
    if not row:
        raise NotFoundError("Watchlist entry", str(watchlist_id))
    return dict(row)


@router.delete("/{watchlist_id}", status_code=204)
async def delete_watchlist(watchlist_id: int, db: AsyncSession = Depends(get_db),
                           user: UserContext = Depends(require_role("superadmin"))):
    result = await db.execute(text("DELETE FROM watchlist WHERE id = :id RETURNING id"), {"id": watchlist_id})
    if not result.first():
        raise NotFoundError("Watchlist entry", str(watchlist_id))
    await db.commit()


@router.post("/match")
async def match_detection(plate_number: str, db: AsyncSession = Depends(get_db),
                          user: UserContext = Depends(get_current_user)):
    normalized = plate_number.upper().replace(" ", "").replace("-", "")
    result = await db.execute(
        text("""
            SELECT id, type, plate_number, plate_normalized, reason, category, priority
            FROM watchlist
            WHERE type = 'vehicle' AND plate_normalized = :norm AND is_active = true
        """),
        {"norm": normalized},
    )
    matches = [dict(r) for r in result.mappings().all()]
    return {"plate_number": plate_number, "normalized": normalized, "matched": len(matches) > 0, "matches": matches}
