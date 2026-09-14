from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from shared.database import get_db
from shared.auth import (
    hash_password, verify_password, create_access_token, create_refresh_token,
    decode_token, get_current_user, require_role, UserContext,
    ROLE_HIERARCHY,
)
from shared.models import (
    LoginRequest, TokenResponse, RefreshRequest, UserCreate, UserUpdate,
    UserResponse, UserDetailResponse, ALL_FEATURES, DEFAULT_ROLE_FEATURES,
)
from shared.errors import NotFoundError, ConflictError

router = APIRouter()


# ─── Helper: load granular permissions from DB ───────────────
async def _load_user_granular(db: AsyncSession, user_id: int) -> dict:
    """Load department_ids, camera_ids, features for a user."""
    dept_result = await db.execute(
        text("SELECT department_id FROM user_departments WHERE user_id = :uid"),
        {"uid": user_id},
    )
    department_ids = [r["department_id"] for r in dept_result.mappings().all()]

    cam_result = await db.execute(
        text("SELECT camera_id::text FROM user_cameras WHERE user_id = :uid"),
        {"uid": user_id},
    )
    camera_ids = [r["camera_id"] for r in cam_result.mappings().all()]

    feat_result = await db.execute(
        text("SELECT feature FROM user_features WHERE user_id = :uid"),
        {"uid": user_id},
    )
    features = [r["feature"] for r in feat_result.mappings().all()]

    return {
        "department_ids": department_ids,
        "camera_ids": camera_ids,
        "features": features,
    }


async def _save_user_granular(db: AsyncSession, user_id: int, data: dict, actor: str):
    """Save department_ids, camera_ids, features for a user."""
    if "department_ids" in data and data["department_ids"] is not None:
        await db.execute(text("DELETE FROM user_departments WHERE user_id = :uid"), {"uid": user_id})
        for did in data["department_ids"]:
            await db.execute(
                text("INSERT INTO user_departments (user_id, department_id, granted_by) VALUES (:uid, :did, :by)"),
                {"uid": user_id, "did": did, "by": actor},
            )

    if "camera_ids" in data and data["camera_ids"] is not None:
        await db.execute(text("DELETE FROM user_cameras WHERE user_id = :uid"), {"uid": user_id})
        for cid in data["camera_ids"]:
            await db.execute(
                text("INSERT INTO user_cameras (user_id, camera_id, granted_by) VALUES (:uid, :cid::uuid, :by)"),
                {"uid": user_id, "cid": cid, "by": actor},
            )

    if "features" in data and data["features"] is not None:
        await db.execute(text("DELETE FROM user_features WHERE user_id = :uid"), {"uid": user_id})
        for feat in data["features"]:
            await db.execute(
                text("INSERT INTO user_features (user_id, feature, granted_by) VALUES (:uid, :feat, :by)"),
                {"uid": user_id, "feat": feat, "by": actor},
            )


# ─── Login ───────────────────────────────────────────────────
@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("SELECT id, username, email, password_hash, full_name, role, department_id, is_active, "
             "access_valid_from, access_valid_until FROM users WHERE username = :u"),
        {"u": req.username},
    )
    row = result.mappings().first()
    if not row or not verify_password(req.password, row["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": {"code": "UNAUTHORIZED", "message": "Invalid credentials"}},
        )
    if not row["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "FORBIDDEN", "message": "Account disabled"}},
        )

    # Check access validity window
    now = datetime.now(timezone.utc)
    if row.get("access_valid_from") and now < row["access_valid_from"]:
        raise HTTPException(status_code=403, detail="Account access not yet valid")
    if row.get("access_valid_until") and now > row["access_valid_until"]:
        raise HTTPException(status_code=403, detail="Account access has expired")

    granular = await _load_user_granular(db, row["id"])
    permissions = _get_permissions(row["role"])
    features = granular["features"] if granular["features"] else DEFAULT_ROLE_FEATURES.get(row["role"], [])

    access = create_access_token(
        row["id"], row["username"], row["role"], row["department_id"],
        permissions, granular["department_ids"], granular["camera_ids"], features,
    )
    refresh = create_refresh_token(row["id"])

    await db.execute(
        text("UPDATE users SET last_login = now() WHERE id = :id"), {"id": row["id"]}
    )
    await db.commit()

    return TokenResponse(
        access_token=access,
        refresh_token=refresh,
        expires_in=3600,
        user=UserResponse(
            id=row["id"], username=row["username"], email=row["email"],
            full_name=row["full_name"], role=row["role"],
            department_id=row["department_id"], is_active=row["is_active"],
            created_at=row.get("created_at") or datetime.now(timezone.utc),
            updated_at=row.get("updated_at") or datetime.now(timezone.utc),
        ),
    )


# ─── Refresh Token ───────────────────────────────────────────
@router.post("/refresh")
async def refresh(req: RefreshRequest, db: AsyncSession = Depends(get_db)):
    data = decode_token(req.refresh_token)
    if data.role != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    user_id = int(data.sub)
    result = await db.execute(
        text("SELECT id, username, role, department_id, is_active FROM users WHERE id = :id"),
        {"id": user_id},
    )
    row = result.mappings().first()
    if not row or not row["is_active"]:
        raise HTTPException(status_code=401, detail="User not found or disabled")

    granular = await _load_user_granular(db, user_id)
    permissions = _get_permissions(row["role"])
    features = granular["features"] if granular["features"] else DEFAULT_ROLE_FEATURES.get(row["role"], [])

    access = create_access_token(
        row["id"], row["username"], row["role"], row["department_id"],
        permissions, granular["department_ids"], granular["camera_ids"], features,
    )
    return {"access_token": access, "token_type": "bearer", "expires_in": 3600}


# ─── Current User ────────────────────────────────────────────
@router.get("/me")
async def me(user: UserContext = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("SELECT id, username, email, full_name, role, department_id, is_active, "
             "phone, designation, employee_id, last_login, created_at "
             "FROM users WHERE id = :id"),
        {"id": user.user_id},
    )
    row = result.mappings().first()
    if not row:
        raise NotFoundError("User", str(user.user_id))

    granular = await _load_user_granular(db, user.user_id)
    permissions = _get_permissions(row["role"])
    features = granular["features"] if granular["features"] else DEFAULT_ROLE_FEATURES.get(row["role"], [])

    return {
        **dict(row),
        "permissions": permissions,
        "department_ids": granular["department_ids"],
        "camera_ids": granular["camera_ids"],
        "features": features,
    }


# ─── User CRUD ───────────────────────────────────────────────
@router.post("/register", status_code=201)
async def register(req: UserCreate, db: AsyncSession = Depends(get_db),
                   user: UserContext = Depends(require_role("superadmin"))):
    existing = await db.execute(
        text("SELECT id FROM users WHERE username = :u OR email = :e"),
        {"u": req.username, "e": req.email},
    )
    if existing.first():
        raise ConflictError("USER_ALREADY_EXISTS", "Username or email already exists")

    result = await db.execute(
        text("INSERT INTO users (username, email, password_hash, full_name, role, department_id, "
             "phone, designation, employee_id, force_password_change, mfa_enabled, "
             "access_valid_from, access_valid_until, allowed_ips, allowed_login_hours) "
             "VALUES (:u, :e, :pw, :fn, :r, :d, :ph, :des, :eid, :fpc, :mfa, :avf, :avl, :ai, :alh) "
             "RETURNING id, created_at, updated_at"),
        {
            "u": req.username, "e": req.email, "pw": hash_password(req.password),
            "fn": req.full_name, "r": req.role, "d": req.department_id,
            "ph": req.phone, "des": req.designation, "eid": req.employee_id,
            "fpc": req.force_password_change, "mfa": req.mfa_enabled,
            "avf": req.access_valid_from, "avl": req.access_valid_until,
            "ai": req.allowed_ips, "alh": req.allowed_login_hours,
        },
    )
    row = result.mappings().first()
    await db.commit()

    granular_data = {}
    if req.department_ids is not None:
        granular_data["department_ids"] = req.department_ids
    elif req.department_id:
        granular_data["department_ids"] = [req.department_id]
    if req.camera_ids is not None:
        granular_data["camera_ids"] = req.camera_ids
    if req.features is not None:
        granular_data["features"] = req.features
    else:
        granular_data["features"] = DEFAULT_ROLE_FEATURES.get(req.role, [])

    if granular_data:
        await _save_user_granular(db, row["id"], granular_data, user.username)
        await db.commit()

    loaded = await _load_user_granular(db, row["id"])

    resp = UserDetailResponse(
        id=row["id"], username=req.username, email=req.email,
        full_name=req.full_name, role=req.role, department_id=req.department_id,
        phone=req.phone, designation=req.designation, employee_id=req.employee_id,
        is_active=True, force_password_change=req.force_password_change,
        mfa_enabled=req.mfa_enabled,
        access_valid_from=req.access_valid_from, access_valid_until=req.access_valid_until,
        created_at=row["created_at"], updated_at=row["updated_at"],
        **loaded,
    )
    return resp.model_dump()


@router.get("/users")
async def list_users(
    page: int = 1, per_page: int = 20,
    role: Optional[str] = None,
    department_id: Optional[int] = None,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(require_role("dept_admin")),
):
    conditions = []
    params = {}

    # Non-superadmins only see users in their departments
    if user.role != "superadmin" and user.department_ids:
        placeholders = ", ".join(f":d{i}" for i in range(len(user.department_ids)))
        conditions.append(f"u.department_id IN ({placeholders})")
        for i, did in enumerate(user.department_ids):
            params[f"d{i}"] = did
    elif user.role != "superadmin" and user.department_id:
        conditions.append("u.department_id = :dept_id")
        params["dept_id"] = user.department_id

    if role:
        conditions.append("u.role = :role")
        params["role"] = role
    if department_id:
        conditions.append("u.department_id = :filter_dept")
        params["filter_dept"] = department_id
    if search:
        conditions.append("(u.username ILIKE :search OR u.full_name ILIKE :search OR u.email ILIKE :search)")
        params["search"] = f"%{search}%"

    where = "WHERE " + " AND ".join(conditions) if conditions else ""
    offset = (page - 1) * per_page
    params["limit"] = per_page
    params["offset"] = offset

    result = await db.execute(
        text(f"""
            SELECT u.id, u.username, u.email, u.full_name, u.role, u.department_id,
                   u.is_active, u.phone, u.designation, u.employee_id,
                   u.force_password_change, u.mfa_enabled,
                   u.access_valid_from, u.access_valid_until, u.last_login,
                   u.created_at, u.updated_at
            FROM users u {where}
            ORDER BY u.id
            LIMIT :limit OFFSET :offset
        """),
        params,
    )
    rows = [dict(r) for r in result.mappings().all()]

    enriched = []
    for row in rows:
        granular = await _load_user_granular(db, row["id"])
        features = granular["features"] if granular["features"] else DEFAULT_ROLE_FEATURES.get(row["role"], [])
        resp = UserDetailResponse(
            **row,
            department_ids=granular["department_ids"],
            camera_ids=granular["camera_ids"],
            features=features,
        )
        enriched.append(resp.model_dump())

    return enriched


@router.get("/users/{user_id}")
async def get_user(user_id: int, db: AsyncSession = Depends(get_db),
                   user: UserContext = Depends(require_role("dept_admin"))):
    result = await db.execute(
        text("SELECT id, username, email, full_name, role, department_id, is_active, "
             "phone, designation, employee_id, force_password_change, mfa_enabled, "
             "access_valid_from, access_valid_until, last_login, created_at, updated_at "
             "FROM users WHERE id = :id"),
        {"id": user_id},
    )
    row = result.mappings().first()
    if not row:
        raise NotFoundError("User", str(user_id))

    granular = await _load_user_granular(db, user_id)
    features = granular["features"] if granular["features"] else DEFAULT_ROLE_FEATURES.get(row["role"], [])

    resp = UserDetailResponse(
        **dict(row),
        department_ids=granular["department_ids"],
        camera_ids=granular["camera_ids"],
        features=features,
    )
    return resp.model_dump()


@router.put("/users/{user_id}")
async def update_user(user_id: int, req: UserUpdate,
                      db: AsyncSession = Depends(get_db),
                      user: UserContext = Depends(require_role("superadmin"))):
    updates = {k: v for k, v in req.model_dump().items() if v is not None and k not in ("department_ids", "camera_ids", "features")}
    if "password" in updates:
        updates["password_hash"] = hash_password(updates.pop("password"))
    elif "password" in updates:
        del updates["password"]

    if updates:
        set_clause = ", ".join(f"{k} = :{k}" for k in updates)
        updates["id"] = user_id
        await db.execute(text(f"UPDATE users SET {set_clause}, updated_at = now() WHERE id = :id"), updates)
        await db.commit()

    result = await db.execute(
        text("SELECT id, username, email, full_name, role, department_id, is_active, "
             "phone, designation, employee_id, force_password_change, mfa_enabled, "
             "access_valid_from, access_valid_until, last_login, created_at, updated_at "
             "FROM users WHERE id = :id"),
        {"id": user_id},
    )
    row = result.mappings().first()
    if not row:
        raise NotFoundError("User", str(user_id))

    granular_data = {}
    if req.department_ids is not None:
        granular_data["department_ids"] = req.department_ids
    if req.camera_ids is not None:
        granular_data["camera_ids"] = req.camera_ids
    if req.features is not None:
        granular_data["features"] = req.features
    if granular_data:
        await _save_user_granular(db, user_id, granular_data, user.username)
        await db.commit()

    granular = await _load_user_granular(db, user_id)
    features = granular["features"] if granular["features"] else DEFAULT_ROLE_FEATURES.get(row["role"], [])

    resp = UserDetailResponse(
        **dict(row),
        department_ids=granular["department_ids"],
        camera_ids=granular["camera_ids"],
        features=features,
    )
    return resp.model_dump()


@router.delete("/users/{user_id}")
async def delete_user(user_id: int, db: AsyncSession = Depends(get_db),
                      user: UserContext = Depends(require_role("superadmin"))):
    if user_id == user.user_id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    result = await db.execute(text("SELECT id, username FROM users WHERE id = :id"), {"id": user_id})
    row = result.mappings().first()
    if not row:
        raise NotFoundError("User", str(user_id))

    # Clean up granular permissions
    await db.execute(text("DELETE FROM user_departments WHERE user_id = :uid"), {"uid": user_id})
    await db.execute(text("DELETE FROM user_cameras WHERE user_id = :uid"), {"uid": user_id})
    await db.execute(text("DELETE FROM user_features WHERE user_id = :uid"), {"uid": user_id})
    await db.execute(text("DELETE FROM users WHERE id = :id"), {"id": user_id})
    await db.commit()

    return {"message": f"User '{row['username']}' deleted"}


@router.post("/users/{user_id}/reset-password")
async def reset_password(user_id: int, db: AsyncSession = Depends(get_db),
                         user: UserContext = Depends(require_role("superadmin"))):
    import secrets
    new_password = secrets.token_urlsafe(12)
    pw_hash = hash_password(new_password)

    result = await db.execute(
        text("UPDATE users SET password_hash = :pw, force_password_change = true, updated_at = now() "
             "WHERE id = :id RETURNING username"),
        {"pw": pw_hash, "id": user_id},
    )
    row = result.mappings().first()
    if not row:
        raise NotFoundError("User", str(user_id))
    await db.commit()

    return {"message": f"Password reset for '{row['username']}'", "temporary_password": new_password}


# ─── Permissions Metadata ────────────────────────────────────
@router.get("/permissions/features")
async def list_features(user: UserContext = Depends(require_role("superadmin"))):
    """List all available features with labels."""
    from shared.models import FEATURE_LABELS
    return [{"key": k, "label": v} for k, v in FEATURE_LABELS.items()]


@router.get("/permissions/roles")
async def list_roles(user: UserContext = Depends(require_role("superadmin"))):
    """List all roles with hierarchy levels and default features."""
    from shared.models import FEATURE_LABELS
    return [
        {
            "name": role,
            "level": level,
            "default_features": DEFAULT_ROLE_FEATURES.get(role, []),
            "feature_labels": [FEATURE_LABELS.get(f, f) for f in DEFAULT_ROLE_FEATURES.get(role, [])],
        }
        for role, level in sorted(ROLE_HIERARCHY.items(), key=lambda x: -x[1])
    ]


# ─── Audit Logs ──────────────────────────────────────────────
@router.get("/audit")
async def list_audit_logs(
    page: int = 1,
    per_page: int = 50,
    action: Optional[str] = None,
    entity: Optional[str] = None,
    actor: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(require_role("dept_admin")),
):
    conditions = []
    params = {}
    if action:
        conditions.append("action = :action")
        params["action"] = action
    if entity:
        conditions.append("entity = :entity")
        params["entity"] = entity
    if actor:
        conditions.append("actor LIKE :actor")
        params["actor"] = f"%{actor}%"
    where = "WHERE " + " AND ".join(conditions) if conditions else ""
    offset = (page - 1) * per_page
    params["limit"] = per_page
    params["offset"] = offset

    result = await db.execute(
        text(f"""
            SELECT id, actor, actor_ip, action, entity, entity_id,
                   details, created_at
            FROM audit_log {where}
            ORDER BY created_at DESC
            LIMIT :limit OFFSET :offset
        """),
        params,
    )
    return [dict(r) for r in result.mappings().all()]


@router.get("/audit/stats")
async def audit_stats(
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(require_role("dept_admin")),
):
    result = await db.execute(
        text("""
            SELECT action, entity, COUNT(*) as count
            FROM audit_log
            WHERE created_at >= now() - INTERVAL '24 hours'
            GROUP BY action, entity
            ORDER BY count DESC
        """)
    )
    return [dict(r) for r in result.mappings().all()]


# ─── System Config ───────────────────────────────────────────
@router.get("/system/config")
async def get_system_config(
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(require_role("superadmin")),
):
    result = await db.execute(
        text("SELECT key, value, description, updated_by, updated_at FROM system_config ORDER BY key")
    )
    return [dict(r) for r in result.mappings().all()]


# ─── Network & Encryption Status ─────────────────────────────
@router.get("/system/security")
async def system_security_status(
    user: UserContext = Depends(require_role("dept_admin")),
):
    return {
        "encryption": {
            "tls_enabled": True,
            "tls_version": "TLS 1.3",
            "certificate_authority": "Self-Signed (Development)",
            "certificate_expiry": "2027-09-01T00:00:00Z",
            "data_encryption_at_rest": True,
            "storage_encryption": "AES-256-GCM",
            "password_hashing": "bcrypt (cost=12)",
            "jwt_algorithm": "HS256",
        },
        "network": {
            "nginx_reverse_proxy": True,
            "ssl_termination": True,
            "http_to_https_redirect": True,
            "hsts_enabled": True,
            "cors_origins": "*",
            "rate_limiting": "Enabled (API Gateway)",
            "segments": [
                {"name": "DMZ", "description": "NGINX + Frontend", "vlan": "10.0.1.0/24", "services": ["nginx", "frontend"]},
                {"name": "Application", "description": "Backend microservices", "vlan": "10.0.2.0/24", "services": ["auth", "registry", "search", "watchlist", "alert", "ai-service"]},
                {"name": "Data", "description": "Databases and storage", "vlan": "10.0.3.0/24", "services": ["postgres", "redis", "minio"]},
                {"name": "Media", "description": "Stream relay and processing", "vlan": "10.0.4.0/24", "services": ["mediamtx"]},
                {"name": "External", "description": "Sentinel camera grid connectivity", "vlan": "Public", "services": ["Sentinel RTSP/HLS"]},
            ],
        },
        "access_control": {
            "rbac_enabled": True,
            "roles": list(ROLE_HIERARCHY.keys()),
            "department_isolation": True,
            "camera_level_access": True,
            "feature_level_permissions": True,
            "session_timeout_minutes": 60,
            "max_login_attempts": 5,
            "audit_logging": True,
        },
    }


def _get_permissions(role: str) -> list[str]:
    perms = {
        "superadmin": [
            "cameras.create", "cameras.read", "cameras.update", "cameras.delete",
            "cameras.bulk_upload", "watchlist.create", "watchlist.read", "watchlist.update", "watchlist.delete",
            "alerts.read", "alerts.acknowledge", "alerts.dismiss",
            "vehicles.search", "users.manage", "system.config",
        ],
        "dept_admin": [
            "cameras.create", "cameras.read", "cameras.update",
            "watchlist.create", "watchlist.read", "watchlist.update",
            "alerts.read", "alerts.acknowledge",
            "vehicles.search",
        ],
        "operator": [
            "cameras.read", "watchlist.read", "alerts.read", "alerts.acknowledge", "vehicles.search",
        ],
        "viewer": ["cameras.read", "watchlist.read", "alerts.read"],
        "analyst": [
            "cameras.read", "watchlist.read", "alerts.read", "vehicles.search",
        ],
        "auditor": ["cameras.read", "watchlist.read", "alerts.read"],
    }
    return perms.get(role, [])
