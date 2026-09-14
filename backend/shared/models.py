from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class PaginationParams(BaseModel):
    page: int = Field(1, ge=1)
    per_page: int = Field(20, ge=1, le=100)


class PaginatedResponse(BaseModel):
    items: list[Any] = []
    total: int = 0
    page: int = 1
    per_page: int = 20
    pages: int = 0


# ─── Department ──────────────────────────────────────────────
class DepartmentBase(BaseModel):
    name: str
    code: str
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    is_active: bool = True


class DepartmentCreate(DepartmentBase):
    pass


class DepartmentResponse(DepartmentBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ─── User ────────────────────────────────────────────────────
class UserBase(BaseModel):
    username: str
    email: str
    full_name: Optional[str] = None
    role: str = "viewer"
    department_id: Optional[int] = None
    is_active: bool = True
    phone: Optional[str] = None
    designation: Optional[str] = None
    employee_id: Optional[str] = None


class UserCreate(UserBase):
    password: str
    force_password_change: bool = False
    mfa_enabled: bool = False
    access_valid_from: Optional[datetime] = None
    access_valid_until: Optional[datetime] = None
    allowed_ips: Optional[list[str]] = None
    allowed_login_hours: Optional[dict] = None
    department_ids: Optional[list[int]] = None
    camera_ids: Optional[list[str]] = None
    features: Optional[list[str]] = None


class UserUpdate(BaseModel):
    email: Optional[str] = None
    full_name: Optional[str] = None
    role: Optional[str] = None
    department_id: Optional[int] = None
    is_active: Optional[bool] = None
    phone: Optional[str] = None
    designation: Optional[str] = None
    employee_id: Optional[str] = None
    force_password_change: Optional[bool] = None
    mfa_enabled: Optional[bool] = None
    access_valid_from: Optional[datetime] = None
    access_valid_until: Optional[datetime] = None
    allowed_ips: Optional[list[str]] = None
    allowed_login_hours: Optional[dict] = None
    password: Optional[str] = None


class UserResponse(UserBase):
    id: int
    last_login: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    force_password_change: bool = False
    mfa_enabled: bool = False
    access_valid_from: Optional[datetime] = None
    access_valid_until: Optional[datetime] = None

    class Config:
        from_attributes = True


class UserDetailResponse(UserResponse):
    department_ids: list[int] = []
    camera_ids: list[str] = []
    features: list[str] = []
    custom_permissions: list[str] = []


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse


class RefreshRequest(BaseModel):
    refresh_token: str


# ─── Camera ──────────────────────────────────────────────────
class CameraBase(BaseModel):
    name: str
    department_id: Optional[int] = None
    camera_type: str = "ip"
    vendor: Optional[str] = None
    model: Optional[str] = None
    ip_address: Optional[str] = None
    port: int = 554
    rtsp_url: Optional[str] = None
    onvif_url: Optional[str] = None
    onvif_supported: bool = False
    username: Optional[str] = None
    lat: float
    lng: float
    elevation_m: Optional[float] = None
    direction_deg: Optional[int] = None
    field_of_view_deg: int = 90
    location_description: Optional[str] = None
    storage_type: Optional[str] = None
    retention_days: int = 7
    resolution: Optional[str] = None
    fps: int = 25
    is_analytics_enabled: bool = True
    analytics_config: Optional[dict] = None


class CameraCreate(CameraBase):
    pass


class CameraUpdate(BaseModel):
    name: Optional[str] = None
    department_id: Optional[int] = None
    camera_type: Optional[str] = None
    vendor: Optional[str] = None
    model: Optional[str] = None
    ip_address: Optional[str] = None
    port: Optional[int] = None
    rtsp_url: Optional[str] = None
    onvif_url: Optional[str] = None
    onvif_supported: Optional[bool] = None
    username: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    elevation_m: Optional[float] = None
    direction_deg: Optional[int] = None
    field_of_view_deg: Optional[int] = None
    location_description: Optional[str] = None
    storage_type: Optional[str] = None
    retention_days: Optional[int] = None
    resolution: Optional[str] = None
    fps: Optional[int] = None
    status: Optional[str] = None
    is_analytics_enabled: Optional[bool] = None
    analytics_config: Optional[dict] = None


class CameraResponse(CameraBase):
    id: UUID
    status: str
    onboarded_by: Optional[str] = None
    onboarded_at: datetime
    last_seen: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ─── Watchlist ───────────────────────────────────────────────
class WatchlistBase(BaseModel):
    type: str
    plate_number: Optional[str] = None
    person_name: Optional[str] = None
    person_photo_url: Optional[str] = None
    face_reference_url: Optional[str] = None
    reason: str
    category: Optional[str] = None
    priority: str = "medium"
    source_system: str = "manual"
    external_id: Optional[str] = None
    fir_number: Optional[str] = None
    is_active: bool = True
    expires_at: Optional[datetime] = None


class WatchlistCreate(WatchlistBase):
    pass


class WatchlistUpdate(BaseModel):
    plate_number: Optional[str] = None
    person_name: Optional[str] = None
    person_photo_url: Optional[str] = None
    face_reference_url: Optional[str] = None
    reason: Optional[str] = None
    category: Optional[str] = None
    priority: Optional[str] = None
    is_active: Optional[bool] = None
    expires_at: Optional[datetime] = None


class WatchlistResponse(WatchlistBase):
    id: int
    plate_normalized: Optional[str] = None
    added_by: Optional[str] = None
    added_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ─── Detection ───────────────────────────────────────────────
class DetectionResponse(BaseModel):
    id: int
    camera_id: Optional[UUID] = None
    detected_at: datetime
    detection_type: str
    plate_number: Optional[str] = None
    plate_normalized: Optional[str] = None
    plate_confidence: Optional[float] = None
    object_class: Optional[str] = None
    object_confidence: Optional[float] = None
    bbox: dict
    snapshot_url: Optional[str] = None
    model_version: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Alert ───────────────────────────────────────────────────
class AlertResponse(BaseModel):
    id: int
    watchlist_id: Optional[int] = None
    detection_id: Optional[int] = None
    camera_id: Optional[UUID] = None
    triggered_at: datetime
    severity: str
    status: str
    match_type: Optional[str] = None
    match_confidence: Optional[float] = None
    plate_number: Optional[str] = None
    watchlist_reason: Optional[str] = None
    camera_name: Optional[str] = None
    camera_lat: Optional[float] = None
    camera_lng: Optional[float] = None
    snapshot_url: Optional[str] = None
    acknowledged_by: Optional[str] = None
    acknowledged_at: Optional[datetime] = None
    dismissed_by: Optional[str] = None
    dismissed_at: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AlertAckRequest(BaseModel):
    notes: Optional[str] = None


# ─── Search ──────────────────────────────────────────────────
class VehicleSearchRequest(BaseModel):
    plate_number: str
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    department_id: Optional[int] = None


class RoutePoint(BaseModel):
    detection_id: int
    detected_at: datetime
    camera_name: str
    camera_id: UUID
    lat: float
    lng: float
    plate_number: Optional[str] = None
    plate_confidence: Optional[float] = None
    snapshot_url: Optional[str] = None


class VehicleRouteResponse(BaseModel):
    plate_number: str
    normalized: str
    total_sightings: int
    first_seen: Optional[datetime] = None
    last_seen: Optional[datetime] = None
    route: list[RoutePoint] = []


# ─── Permissions ─────────────────────────────────────────────
ALL_FEATURES = [
    "view_live_feeds",
    "playback_recording",
    "search_vehicles",
    "view_analytics",
    "manage_alerts",
    "acknowledge_alerts",
    "export_data",
    "view_reports",
    "manage_cameras",
    "manage_watchlist",
    "manage_users",
    "view_audit_logs",
    "system_config",
]

FEATURE_LABELS = {
    "view_live_feeds": "View Live Feeds",
    "playback_recording": "Playback / Recording",
    "search_vehicles": "Search Vehicles & Events",
    "view_analytics": "View Analytics (ANPR, Tracking)",
    "manage_alerts": "Manage Alerts",
    "acknowledge_alerts": "Acknowledge Alerts",
    "export_data": "Export Data / Reports",
    "view_reports": "View Reports",
    "manage_cameras": "Manage Cameras",
    "manage_watchlist": "Manage Watchlist",
    "manage_users": "Manage Users",
    "view_audit_logs": "View Audit Logs",
    "system_config": "System Configuration",
}

ROLE_HIERARCHY = {
    "superadmin": 4,
    "dept_admin": 3,
    "operator": 2,
    "viewer": 1,
    "analyst": 2,
    "auditor": 1,
}

DEFAULT_ROLE_FEATURES = {
    "superadmin": ALL_FEATURES,
    "dept_admin": [
        "view_live_feeds", "playback_recording", "search_vehicles",
        "view_analytics", "manage_alerts", "acknowledge_alerts",
        "export_data", "view_reports", "manage_cameras", "manage_watchlist",
    ],
    "operator": [
        "view_live_feeds", "playback_recording", "search_vehicles",
        "view_analytics", "manage_alerts", "acknowledge_alerts",
    ],
    "viewer": ["view_live_feeds"],
    "analyst": [
        "view_live_feeds", "playback_recording", "search_vehicles",
        "view_analytics", "export_data", "view_reports",
    ],
    "auditor": ["view_audit_logs", "view_reports", "export_data"],
}
