# API Specification
## GICVMAP REST API — OpenAPI-Style Reference

---

## Base Configuration

| Property | Value |
|----------|-------|
| Base URL | `http://localhost/api/v1` (via NGINX) |
| Auth | Bearer JWT in `Authorization` header |
| Content-Type | `application/json` (except file uploads: `multipart/form-data`) |
| Pagination | `?page=1&per_page=20` (default: page=1, per_page=20, max: 100) |
| Filtering | `?field=value` query parameters |
| Sorting | `?sort=field:asc` or `?sort=field:desc` |
| Date Format | ISO 8601 (`2026-09-10T14:32:05Z`) |

---

## Error Response Schema

```json
{
  "error": {
    "code": "CAMERA_NOT_FOUND",
    "message": "Camera with id 'xyz' not found",
    "details": {}
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `CAMERA_NOT_FOUND` | 404 | Camera ID does not exist |
| `CAMERA_ALREADY_EXISTS` | 409 | Camera with same RTSP URL already registered |
| `INVALID_RTSP_URL` | 422 | RTSP URL format is invalid |
| `STREAM_CONNECTION_FAILED` | 502 | Cannot connect to camera stream |
| `WATCHLIST_ENTRY_EXISTS` | 409 | Duplicate watchlist entry |
| `DETECTION_NOT_FOUND` | 404 | Detection ID does not exist |
| `ALERT_NOT_FOUND` | 404 | Alert ID does not exist |
| `UNAUTHORIZED` | 401 | Missing or invalid JWT token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `INVALID_CSV_FORMAT` | 422 | CSV file has invalid format or missing columns |
| `AI_MODEL_LOAD_FAILED` | 503 | AI model failed to load |
| `VALIDATION_ERROR` | 422 | Request body validation failed |

---

## 1. Authentication APIs

### POST /api/v1/auth/login

**Description:** Authenticate user and receive JWT tokens.

**Request:**
```json
{
  "username": "admin",
  "password": "admin123"
}
```

**Response (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "expires_in": 3600,
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@gicvmap.gov.in",
    "full_name": "System Administrator",
    "role": "superadmin",
    "department_id": null
  }
}
```

### POST /api/v1/auth/refresh

**Description:** Refresh an expired access token.

**Request:**
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "expires_in": 3600
}
```

### GET /api/v1/auth/me

**Description:** Get current authenticated user's profile.

**Headers:** `Authorization: Bearer {token}`

**Response (200):**
```json
{
  "id": 1,
  "username": "admin",
  "email": "admin@gicvmap.gov.in",
  "full_name": "System Administrator",
  "role": "superadmin",
  "department_id": null,
  "permissions": [
    "cameras.create", "cameras.read", "cameras.update", "cameras.delete",
    "cameras.bulk_upload", "watchlist.create", "watchlist.read",
    "alerts.read", "alerts.acknowledge", "alerts.dismiss",
    "vehicles.search", "users.manage", "system.config"
  ],
  "is_active": true,
  "last_login": "2026-09-10T10:00:00Z"
}
```

### POST /api/v1/auth/register

**Description:** Register a new user (admin only).

**Headers:** `Authorization: Bearer {token}` (superadmin required)

**Request:**
```json
{
  "username": "operator1",
  "email": "operator1@gicvmap.gov.in",
  "password": "securepassword",
  "full_name": "Operator One",
  "role": "operator",
  "department_id": 1
}
```

**Response (201):**
```json
{
  "id": 2,
  "username": "operator1",
  "email": "operator1@gicvmap.gov.in",
  "role": "operator",
  "department_id": 1,
  "is_active": true,
  "created_at": "2026-09-10T10:00:00Z"
}
```

---

## 2. Department APIs

### GET /api/v1/departments

**Description:** List all departments.

**Query Parameters:** None

**Response (200):**
```json
{
  "data": [
    {
      "id": 1,
      "name": "Home Department / Police",
      "code": "HOME",
      "contact_email": "home@gujarat.gov.in",
      "camera_count": 15,
      "is_active": true
    },
    {
      "id": 2,
      "name": "Municipal Corporation",
      "code": "MUNI",
      "contact_email": "muni@gujarat.gov.in",
      "camera_count": 10,
      "is_active": true
    }
  ]
}
```

---

## 3. Camera APIs

### POST /api/v1/cameras

**Description:** Create a new camera entry.

**Headers:** `Authorization: Bearer {token}` (superadmin or dept_admin required)

**Request:**
```json
{
  "name": "Ring Road Junction Cam 3",
  "department_id": 1,
  "camera_type": "ip",
  "vendor": "Hikvision",
  "model": "DS-2CD2T47G2-LS",
  "ip_address": "192.168.1.100",
  "port": 554,
  "rtsp_url": "rtsp://admin:pass@192.168.1.100:554/Streaming/Channels/101",
  "lat": 23.0410,
  "lng": 72.5645,
  "storage_type": "nvr",
  "retention_days": 14,
  "resolution": "1920x1080",
  "fps": 25,
  "location_description": "Ring Road Junction near SG Highway"
}
```

**Response (201):**
```json
{
  "id": "b3f1a2c4-e5d6-7f8a-9b0c-1d2e3f4a5b6c",
  "name": "Ring Road Junction Cam 3",
  "department_id": 1,
  "camera_type": "ip",
  "vendor": "Hikvision",
  "rtsp_url": "rtsp://admin:***@192.168.1.100:554/Streaming/Channels/101",
  "lat": 23.0410,
  "lng": 72.5645,
  "status": "unknown",
  "is_analytics_enabled": true,
  "onboarded_by": "admin",
  "onboarded_at": "2026-09-10T10:00:00Z"
}
```

### GET /api/v1/cameras

**Description:** List cameras with filtering, sorting, and pagination.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `department_id` | int | Filter by department |
| `camera_type` | string | Filter: `analog` or `ip` |
| `status` | string | Filter: `online`, `offline`, `degraded`, `unknown`, `maintenance` |
| `vendor` | string | Filter by vendor name (partial match) |
| `search` | string | Search by name or location description |
| `lat_min`, `lat_max` | float | Latitude bounding box |
| `lng_min`, `lng_max` | float | Longitude bounding box |
| `radius_lat`, `radius_lng`, `radius_km` | float | Radius search from point |
| `sort` | string | Sort field and direction (default: `created_at:desc`) |
| `page` | int | Page number (default: 1) |
| `per_page` | int | Results per page (default: 20, max: 100) |

**Response (200):**
```json
{
  "data": [
    {
      "id": "b3f1a2c4-...",
      "name": "Ring Road Junction Cam 3",
      "department_id": 1,
      "department_name": "Home Department / Police",
      "camera_type": "ip",
      "vendor": "Hikvision",
      "lat": 23.0410,
      "lng": 72.5645,
      "status": "online",
      "last_seen": "2026-09-10T14:32:05Z",
      "is_analytics_enabled": true,
      "storage_type": "nvr",
      "retention_days": 14,
      "onboarded_at": "2026-09-10T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 50,
    "total_pages": 3
  }
}
```

### GET /api/v1/cameras/{id}

**Description:** Get a single camera by ID.

**Response (200):**
```json
{
  "id": "b3f1a2c4-...",
  "name": "Ring Road Junction Cam 3",
  "department_id": 1,
  "department_name": "Home Department / Police",
  "camera_type": "ip",
  "vendor": "Hikvision",
  "model": "DS-2CD2T47G2-LS",
  "ip_address": "192.168.1.100",
  "port": 554,
  "rtsp_url": "rtsp://admin:***@192.168.1.100:554/Streaming/Channels/101",
  "lat": 23.0410,
  "lng": 72.5645,
  "status": "online",
  "last_seen": "2026-09-10T14:32:05Z",
  "camera_type": "ip",
  "storage_type": "nvr",
  "retention_days": 14,
  "resolution": "1920x1080",
  "fps": 25,
  "is_analytics_enabled": true,
  "analytics_config": {
    "fps_sampling": 2,
    "detect_vehicles": true,
    "detect_persons": true,
    "detect_plates": true,
    "detect_faces": false,
    "confidence_threshold": 0.5
  },
  "onboarded_by": "admin",
  "onboarded_at": "2026-09-10T10:00:00Z",
  "total_detections_today": 142,
  "last_health_check": "2026-09-10T14:30:00Z"
}
```

### PUT /api/v1/cameras/{id}

**Description:** Update camera metadata.

**Request:** (partial update — only send fields to change)
```json
{
  "name": "Updated Camera Name",
  "retention_days": 30,
  "is_analytics_enabled": true
}
```

**Response (200):** Updated camera object.

### DELETE /api/v1/cameras/{id}

**Description:** Remove a camera from the registry.

**Response (204):** No content.

### POST /api/v1/cameras/bulk-upload

**Description:** Bulk import cameras from CSV file.

**Request:** `multipart/form-data`

**CSV Format:**
```csv
name,department_code,camera_type,vendor,ip_address,port,rtsp_url,lat,lng,storage_type,retention_days,resolution,fps
"Cam 1","HOME","ip","Hikvision","192.168.1.1","554","rtsp://admin:pass@192.168.1.1:554/stream",23.041,72.564,"nvr",14,"1920x1080",25
"Cam 2","RTO","ip","Dahua","192.168.1.2","554","rtsp://admin:pass@192.168.1.2:554/stream",23.045,72.570,"local",7,"1280x720",15
```

**Response (200):**
```json
{
  "imported": 45,
  "failed": 5,
  "total": 50,
  "errors": [
    {"row": 12, "reason": "Invalid RTSP URL format"},
    {"row": 23, "reason": "Department code 'XYZ' not found"},
    {"row": 34, "reason": "Missing required field: lat"},
    {"row": 38, "reason": "Duplicate RTSP URL"},
    {"row": 45, "reason": "Invalid camera_type value"}
  ]
}
```

### GET /api/v1/cameras/{id}/health

**Description:** Get health check history for a camera.

**Query Parameters:**
- `from` (ISO datetime): Start time
- `to` (ISO datetime): End time
- `limit` (int): Max results (default: 50)

**Response (200):**
```json
{
  "camera_id": "b3f1a2c4-...",
  "camera_name": "Ring Road Junction Cam 3",
  "current_status": "online",
  "health_history": [
    {
      "checked_at": "2026-09-10T14:32:00Z",
      "status": "online",
      "latency_ms": 45,
      "stream_bitrate_kbps": 2048,
      "fps_actual": 25
    },
    {
      "checked_at": "2026-09-10T14:31:30Z",
      "status": "online",
      "latency_ms": 52,
      "stream_bitrate_kbps": 2048,
      "fps_actual": 25
    }
  ]
}
```

### GET /api/v1/cameras/gaps

**Description:** Get coverage gap analysis report.

**Response (200):**
```json
{
  "total_cameras": 50,
  "total_departments": 8,
  "coverage_zones": [
    {
      "zone_name": "Zone A - Ahmedabad Central",
      "center_lat": 23.0225,
      "center_lng": 72.5714,
      "camera_count": 12,
      "density_rating": "good"
    },
    {
      "zone_name": "Zone B - Rural Saurashtra",
      "center_lat": 22.3039,
      "center_lng": 70.8022,
      "camera_count": 1,
      "density_rating": "poor"
    }
  ]
}
```

### POST /api/v1/cameras/{id}/analytics-config

**Description:** Update analytics configuration for a camera.

**Request:**
```json
{
  "fps_sampling": 3,
  "detect_vehicles": true,
  "detect_persons": true,
  "detect_plates": true,
  "detect_faces": false,
  "confidence_threshold": 0.6
}
```

**Response (200):** Updated analytics config.

---

## 4. Streaming APIs

### GET /api/v1/streams/status

**Description:** Get status of all active streams.

**Response (200):**
```json
{
  "streams": [
    {
      "camera_id": "b3f1a2c4-...",
      "camera_name": "Ring Road Junction Cam 3",
      "status": "active",
      "protocol": "webrtc",
      "webrtc_url": "http://localhost:8889/stream/cam1",
      "hls_url": "http://localhost:8888/stream/cam1/index.m3u8",
      "started_at": "2026-09-10T10:00:00Z",
      "viewers": 3
    }
  ]
}
```

### GET /api/v1/streams/{camera_id}/webrtc

**Description:** Get WebRTC stream URL for a camera.

**Response (200):**
```json
{
  "camera_id": "b3f1a2c4-...",
  "protocol": "webrtc",
  "url": "http://localhost:8889/stream/cam1",
  "ws_url": "ws://localhost:8889/stream/cam1"
}
```

### GET /api/v1/streams/{camera_id}/hls

**Description:** Get HLS manifest URL for a camera.

**Response (200):**
```json
{
  "camera_id": "b3f1a2c4-...",
  "protocol": "hls",
  "manifest_url": "http://localhost:8888/stream/cam1/index.m3u8",
  "segment_duration_sec": 2
}
```

---

## 5. Detection APIs

### GET /api/v1/detections

**Description:** Query raw detections with filtering.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `camera_id` | UUID | Filter by camera |
| `detection_type` | string | Filter: `vehicle`, `person`, `object` |
| `plate_number` | string | Filter by plate (exact or partial) |
| `from` | ISO datetime | Start time range |
| `to` | ISO datetime | End time range |
| `min_confidence` | float | Minimum confidence threshold |
| `sort` | string | Sort field (default: `detected_at:desc`) |
| `page` | int | Page number |
| `per_page` | int | Results per page |

**Response (200):**
```json
{
  "data": [
    {
      "id": 1001,
      "camera_id": "b3f1a2c4-...",
      "camera_name": "Ring Road Junction Cam 3",
      "detected_at": "2026-09-10T14:32:05Z",
      "detection_type": "vehicle",
      "plate_number": "GJ01AB1234",
      "plate_confidence": 0.87,
      "object_class": "car",
      "object_confidence": 0.92,
      "bbox": {"x": 120, "y": 340, "w": 200, "h": 90},
      "snapshot_url": "/api/v1/snapshots/det_1001.jpg",
      "processing_time_ms": 145
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 1250,
    "total_pages": 63
  }
}
```

---

## 6. Vehicle Search APIs

### GET /api/v1/vehicle/{plate_number}/history

**Description:** Get full detection history for a vehicle registration number.

**Path Parameters:**
- `plate_number` (string): Vehicle plate number (e.g., `GJ01AB1234`)

**Response (200):**
```json
{
  "plate_number": "GJ01AB1234",
  "total_detections": 8,
  "first_seen": "2026-09-10T08:15:00Z",
  "last_seen": "2026-09-10T18:45:00Z",
  "cameras_detected": 5,
  "detections": [
    {
      "id": 1001,
      "camera_id": "b3f1a2c4-...",
      "camera_name": "Ring Road Junction Cam 3",
      "department_name": "Home Department",
      "detected_at": "2026-09-10T08:15:00Z",
      "lat": 23.0410,
      "lng": 72.5645,
      "plate_confidence": 0.92,
      "object_class": "car",
      "snapshot_url": "/api/v1/snapshots/det_1001.jpg"
    },
    {
      "id": 1045,
      "camera_id": "c4d2b3e5-...",
      "camera_name": "SG Highway Cam 1",
      "department_name": "Municipal Corporation",
      "detected_at": "2026-09-10T09:30:00Z",
      "lat": 23.0450,
      "lng": 72.5700,
      "plate_confidence": 0.85,
      "object_class": "car",
      "snapshot_url": "/api/v1/snapshots/det_1045.jpg"
    },
    {
      "id": 1102,
      "camera_id": "d5e3f4a6-...",
      "camera_name": "Vastrapur Lake Cam 2",
      "department_name": "Home Department",
      "detected_at": "2026-09-10T11:45:00Z",
      "lat": 23.0500,
      "lng": 72.5800,
      "plate_confidence": 0.78,
      "object_class": "car",
      "snapshot_url": "/api/v1/snapshots/det_1102.jpg"
    }
  ]
}
```

### GET /api/v1/vehicle/{plate_number}/route

**Description:** Get ordered GIS route for a vehicle across all detections.

**Response (200):**
```json
{
  "plate_number": "GJ01AB1234",
  "route": {
    "type": "Feature",
    "geometry": {
      "type": "LineString",
      "coordinates": [
        [72.5645, 23.0410],
        [72.5700, 23.0450],
        [72.5800, 23.0500],
        [72.5900, 23.0550],
        [72.6000, 23.0600]
      ]
    },
    "properties": {
      "total_distance_km": 5.8,
      "estimated_duration_min": 15,
      "estimated_avg_speed_kmh": 23.2,
      "detection_count": 5
    }
  },
  "waypoints": [
    {
      "sequence": 1,
      "detection_id": 1001,
      "camera_id": "b3f1a2c4-...",
      "camera_name": "Ring Road Junction Cam 3",
      "department_name": "Home Department",
      "lat": 23.0410,
      "lng": 72.5645,
      "detected_at": "2026-09-10T08:15:00Z",
      "plate_confidence": 0.92,
      "snapshot_url": "/api/v1/snapshots/det_1001.jpg"
    },
    {
      "sequence": 2,
      "detection_id": 1045,
      "camera_id": "c4d2b3e5-...",
      "camera_name": "SG Highway Cam 1",
      "department_name": "Municipal Corporation",
      "lat": 23.0450,
      "lng": 72.5700,
      "detected_at": "2026-09-10T09:30:00Z",
      "plate_confidence": 0.85,
      "snapshot_url": "/api/v1/snapshots/det_1045.jpg"
    }
  ]
}
```

### GET /api/v1/vehicle/{plate_number}/report

**Description:** Export vehicle detection history as PDF or CSV.

**Query Parameters:**
- `format` (string): `pdf` or `csv` (default: `csv`)

**Response:** File download (Content-Type: `text/csv` or `application/pdf`)

---

## 7. Watchlist APIs

### POST /api/v1/watchlist

**Description:** Add a new watchlist entry.

**Request:**
```json
{
  "type": "vehicle",
  "plate_number": "GJ01AB1234",
  "reason": "Stolen Vehicle - FIR 2026/1123",
  "category": "stolen_vehicle",
  "priority": "high",
  "source_system": "VAHAN-mock",
  "fir_number": "FIR/2026/1123"
}
```

**Response (201):**
```json
{
  "id": 42,
  "type": "vehicle",
  "plate_number": "GJ01AB1234",
  "plate_normalized": "GJ01AB1234",
  "reason": "Stolen Vehicle - FIR 2026/1123",
  "category": "stolen_vehicle",
  "priority": "high",
  "source_system": "VAHAN-mock",
  "fir_number": "FIR/2026/1123",
  "is_active": true,
  "added_by": "admin",
  "added_at": "2026-09-10T10:00:00Z"
}
```

### GET /api/v1/watchlist

**Description:** List watchlist entries with filtering.

**Query Parameters:**
- `type` (string): `vehicle` or `person`
- `category` (string): Filter by category
- `is_active` (boolean): Filter by active status
- `search` (string): Search by reason or person name
- `priority` (string): Filter by priority
- `page`, `per_page`: Pagination

**Response (200):**
```json
{
  "data": [
    {
      "id": 42,
      "type": "vehicle",
      "plate_number": "GJ01AB1234",
      "reason": "Stolen Vehicle - FIR 2026/1123",
      "category": "stolen_vehicle",
      "priority": "high",
      "source_system": "VAHAN-mock",
      "is_active": true,
      "added_by": "admin",
      "added_at": "2026-09-10T10:00:00Z",
      "total_matches": 3
    }
  ],
  "pagination": { ... },
  "summary": {
    "total": 25,
    "active": 20,
    "vehicles": 15,
    "persons": 5
  }
}
```

### PUT /api/v1/watchlist/{id}

**Description:** Update a watchlist entry.

**Request:** (partial update)
```json
{
  "reason": "Updated reason - FIR 2026/1123",
  "priority": "critical"
}
```

### DELETE /api/v1/watchlist/{id}

**Description:** Soft-deactivate a watchlist entry (sets `is_active = false`).

**Response (200):**
```json
{
  "id": 42,
  "is_active": false,
  "updated_at": "2026-09-10T12:00:00Z"
}
```

### POST /api/v1/watchlist/bulk-upload

**Description:** Bulk import watchlist entries from CSV.

**CSV Format:**
```csv
type,plate_number,reason,category,priority,source_system,fir_number
"vehicle","GJ01AB1234","Stolen Vehicle","stolen_vehicle","high","VAHAN-mock","FIR/2026/1123"
"vehicle","GJ02CD5678","Blacklisted","blacklisted","medium","manual",""
"person","","Armed Robbery Suspect","wanted_person","critical","CCTNS-mock","FIR/2026/456"
```

**Response (200):**
```json
{
  "imported": 23,
  "failed": 2,
  "total": 25,
  "errors": [
    {"row": 15, "reason": "Missing plate_number for vehicle type"},
    {"row": 22, "reason": "Invalid category value"}
  ]
}
```

---

## 8. Alert APIs

### GET /api/v1/alerts

**Description:** List alerts with filtering.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | `new`, `acknowledged`, `dismissed`, `escalated` |
| `severity` | string | `low`, `medium`, `high`, `critical` |
| `camera_id` | UUID | Filter by camera |
| `watchlist_id` | int | Filter by watchlist entry |
| `match_type` | string | `plate_exact`, `plate_fuzzy`, `face_similarity` |
| `from` | ISO datetime | Start time |
| `to` | ISO datetime | End time |
| `page`, `per_page` | int | Pagination |

**Response (200):**
```json
{
  "data": [
    {
      "id": 5521,
      "watchlist_id": 42,
      "detection_id": 1001,
      "camera_id": "b3f1a2c4-...",
      "camera_name": "Ring Road Junction Cam 3",
      "triggered_at": "2026-09-10T14:32:07Z",
      "severity": "high",
      "status": "new",
      "match_type": "plate_exact",
      "match_confidence": 1.0,
      "plate_number": "GJ01AB1234",
      "watchlist_reason": "Stolen Vehicle - FIR 2026/1123",
      "watchlist_category": "stolen_vehicle",
      "camera_lat": 23.0410,
      "camera_lng": 72.5645,
      "snapshot_url": "/api/v1/snapshots/alert_5521.jpg"
    }
  ],
  "pagination": { ... },
  "summary": {
    "total_new": 5,
    "total_acknowledged": 12,
    "total_dismissed": 3,
    "total_critical": 1,
    "total_high": 4
  }
}
```

### GET /api/v1/alerts/{id}

**Description:** Get detailed alert information.

**Response (200):**
```json
{
  "id": 5521,
  "watchlist_id": 42,
  "detection_id": 1001,
  "camera_id": "b3f1a2c4-...",
  "camera_name": "Ring Road Junction Cam 3",
  "department_name": "Home Department",
  "triggered_at": "2026-09-10T14:32:07Z",
  "severity": "high",
  "status": "new",
  "match_type": "plate_exact",
  "match_confidence": 1.0,
  "plate_number": "GJ01AB1234",
  "watchlist_reason": "Stolen Vehicle - FIR 2026/1123",
  "watchlist_category": "stolen_vehicle",
  "watchlist_priority": "high",
  "camera_lat": 23.0410,
  "camera_lng": 72.5645,
  "snapshot_url": "/api/v1/snapshots/alert_5521.jpg",
  "detection_details": {
    "detected_at": "2026-09-10T14:32:05Z",
    "plate_confidence": 0.87,
    "object_class": "car",
    "bbox": {"x": 120, "y": 340, "w": 200, "h": 90}
  },
  "acknowledged_by": null,
  "acknowledged_at": null,
  "notes": null
}
```

### PUT /api/v1/alerts/{id}/acknowledge

**Description:** Acknowledge an alert.

**Request:**
```json
{
  "notes": "Dispatched unit to location"
}
```

**Response (200):**
```json
{
  "id": 5521,
  "status": "acknowledged",
  "acknowledged_by": "operator1",
  "acknowledged_at": "2026-09-10T14:35:00Z",
  "notes": "Dispatched unit to location"
}
```

### PUT /api/v1/alerts/{id}/dismiss

**Description:** Dismiss an alert.

**Request:**
```json
{
  "notes": "False positive - vehicle was cleared"
}
```

**Response (200):**
```json
{
  "id": 5521,
  "status": "dismissed",
  "dismissed_by": "operator1",
  "dismissed_at": "2026-09-10T14:40:00Z",
  "notes": "False positive - vehicle was cleared"
}
```

---

## 9. System APIs

### GET /api/v1/system/stats

**Description:** Get system-wide statistics.

**Response (200):**
```json
{
  "cameras": {
    "total": 50,
    "online": 42,
    "offline": 5,
    "degraded": 3
  },
  "detections": {
    "today": 1250,
    "vehicles": 800,
    "persons": 450
  },
  "alerts": {
    "new": 5,
    "acknowledged": 12,
    "today_total": 17
  },
  "watchlist": {
    "total": 25,
    "active": 20,
    "vehicles": 15,
    "persons": 5
  },
  "uptime_seconds": 86400
}
```

### GET /health

**Description:** Service health check (no auth required).

**Response (200):**
```json
{
  "status": "healthy",
  "service": "registry-service",
  "version": "1.0.0",
  "uptime": "2h30m",
  "database": "connected",
  "redis": "connected"
}
```

---

## 10. WebSocket Protocol

### Connection
```
ws://localhost:8003/ws/alerts?token={jwt_token}
```

### Events

#### Client → Server

| Event | Data | Description |
|-------|------|-------------|
| `alert.acknowledge` | `{ "alert_id": int, "notes": string }` | Acknowledge an alert |
| `alert.dismiss` | `{ "alert_id": int, "notes": string }` | Dismiss an alert |
| `ping` | `{}` | Keepalive ping |

#### Server → Client

| Event | Data | Description |
|-------|------|-------------|
| `alert.new` | Alert object (see above) | New watchlist match detected |
| `alert.acknowledged` | `{ "alert_id": int, "acknowledged_by": string }` | Alert acknowledged by another user |
| `alert.dismissed` | `{ "alert_id": int, "dismissed_by": string }` | Alert dismissed by another user |
| `camera.status_changed` | `{ "camera_id": UUID, "status": string }` | Camera went online/offline |
| `pong` | `{}` | Keepalive pong |

### Sample Alert Push Message
```json
{
  "event": "alert.new",
  "data": {
    "alert_id": 5521,
    "watchlist_reason": "Stolen Vehicle - FIR 2026/1123",
    "plate_number": "GJ01AB1234",
    "camera_id": "b3f1a2c4-...",
    "camera_name": "Ring Road Junction Cam 3",
    "lat": 23.0410,
    "lng": 72.5645,
    "triggered_at": "2026-09-10T14:32:07Z",
    "severity": "high",
    "snapshot_url": "/api/v1/snapshots/alert_5521.jpg"
  }
}
```

---

*End of API Specification*
