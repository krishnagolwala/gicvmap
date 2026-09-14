# Database Schema Design
## GICVMAP — PostgreSQL + PostGIS Schema

---

## Overview

The GICVMAP database uses **PostgreSQL 15+** with the following extensions:

| Extension | Purpose |
|-----------|---------|
| `postgis` | Spatial queries for GIS camera mapping and route visualization |
| `pgvector` | Vector similarity search for facial recognition embeddings |
| `uuid-ossp` | UUID generation for camera IDs |
| `pg_trgm` | Fuzzy text search for plate number tolerance |

---

## Entity-Relationship Diagram

```
┌──────────────────────┐
│      departments      │
│──────────────────────│
│ id (PK, SERIAL)      │
│ name (VARCHAR 150)   │
│ code (VARCHAR 20, UQ)│
│ contact_email        │
│ contact_phone        │
│ is_active            │
│ created_at           │
│ updated_at           │
└──────────┬───────────┘
           │ 1:N
           ▼
┌──────────────────────┐        ┌──────────────────────┐
│      cameras         │        │       users          │
│──────────────────────│        │──────────────────────│
│ id (PK, UUID)        │◄───────│ department_id (FK)   │
│ name                 │   N:1  │ id (PK, SERIAL)      │
│ department_id (FK)   │        │ username (UQ)        │
│ camera_type          │        │ email (UQ)           │
│ vendor               │        │ password_hash        │
│ rtsp_url             │        │ role                 │
│ lat, lng             │        │ is_active            │
│ geom (GEOGRAPHY)     │        └──────────────────────┘
│ status               │
│ onboarded_by         │
│ onboarded_at         │
│ last_seen            │
└──────────┬───────────┘
           │ 1:N
           ▼
┌──────────────────────┐
│     detections        │
│──────────────────────│
│ id (PK, BIGSERIAL)   │
│ camera_id (FK)       │
│ detected_at          │
│ detection_type       │
│ plate_number         │
│ plate_confidence     │
│ bbox (JSONB)         │
│ face_embedding       │
│ snapshot_url         │
│ created_at           │
└──────┬──────────┬────┘
       │          │
       │ 1:N      │ N:1
       ▼          │
┌──────────────┐  │    ┌──────────────────────┐
│   alerts     │  │    │     watchlist         │
│──────────────│  │    │──────────────────────│
│ id (PK)      │  ├────│ id (PK, SERIAL)      │
│ watchlist_id │──┘    │ type                 │
│ detection_id │       │ plate_number         │
│ camera_id    │       │ face_embedding       │
│ triggered_at │       │ reason               │
│ severity     │       │ category             │
│ status       │       │ is_active            │
│ match_type   │       │ priority             │
│ ack_by       │       │ added_by             │
│ ack_at       │       │ added_at             │
└──────────────┘       └──────────────────────┘

┌──────────────────────┐    ┌──────────────────────┐
│  camera_health_log   │    │     audit_log         │
│──────────────────────│    │──────────────────────│
│ id (PK, BIGSERIAL)   │    │ id (PK, BIGSERIAL)   │
│ camera_id (FK)       │    │ actor                │
│ checked_at           │    │ action               │
│ status               │    │ entity               │
│ latency_ms           │    │ entity_id            │
│ error_message        │    │ old_values (JSONB)   │
└──────────────────────┘    │ new_values (JSONB)   │
                            │ created_at           │
┌──────────────────────┐    └──────────────────────┘
│   system_config      │
│──────────────────────│
│ key (PK, VARCHAR)    │
│ value (JSONB)        │
│ description          │
│ updated_by           │
│ updated_at           │
└──────────────────────┘
```

---

## Complete DDL

### Extensions

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
CREATE EXTENSION IF NOT EXISTS pgvector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

### departments

```sql
CREATE TABLE departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    contact_email VARCHAR(150),
    contact_phone VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

-- Seed data for Gujarat departments
INSERT INTO departments (name, code) VALUES
    ('Home Department / Police', 'HOME'),
    ('Municipal Corporation', 'MUNI'),
    ('RTO', 'RTO'),
    ('Food & Civil Supplies', 'FCS'),
    ('Education Department', 'EDU'),
    ('Health Department', 'HLT'),
    ('Social Justice Department', 'SJD'),
    ('Tribal Development Department', 'TDD'),
    ('Roads & Buildings Department', 'RBD'),
    ('Urban Development Department', 'UDD');
```

### users

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(200),
    role VARCHAR(30) NOT NULL
        CHECK (role IN ('superadmin','dept_admin','operator','viewer')),
    department_id INT REFERENCES departments(id),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_users_department ON users(department_id);
CREATE INDEX idx_users_role ON users(role);

-- Default admin user (password: admin123 — change in production)
INSERT INTO users (username, email, password_hash, full_name, role)
VALUES (
    'admin',
    'admin@gicvmap.gov.in',
    '$2b$12$LJ3m4ys3Lz0QeHbT1z1KxuYl8W5t5n6r7p8o9i0u1y2t3r4e5w6q7',
    'System Administrator',
    'superadmin'
);
```

### cameras

```sql
CREATE TABLE cameras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    department_id INT REFERENCES departments(id),

    -- Camera Technical Details
    camera_type VARCHAR(20) NOT NULL
        CHECK (camera_type IN ('analog','ip')),
    vendor VARCHAR(100),
    model VARCHAR(100),
    ip_address VARCHAR(50),
    port INT DEFAULT 554,

    -- Stream Configuration
    rtsp_url TEXT,
    onvif_url TEXT,
    onvif_supported BOOLEAN DEFAULT false,
    username VARCHAR(100),
    password_encrypted TEXT,

    -- Location
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    geom GEOGRAPHY(Point, 4326) NOT NULL,
    elevation_m DOUBLE PRECISION,
    direction_deg INT CHECK (direction_deg >= 0 AND direction_deg <= 360),
    field_of_view_deg INT DEFAULT 90,
    location_description TEXT,

    -- Storage
    storage_type VARCHAR(20)
        CHECK (storage_type IN ('cloud','local','nvr','none')),
    retention_days INT DEFAULT 7,

    -- Video Properties
    resolution VARCHAR(20),
    fps INT DEFAULT 25,

    -- Status
    status VARCHAR(20) DEFAULT 'unknown'
        CHECK (status IN ('online','offline','degraded','unknown','maintenance')),

    -- Analytics Configuration
    is_analytics_enabled BOOLEAN DEFAULT true,
    analytics_config JSONB DEFAULT '{
        "fps_sampling": 2,
        "detect_vehicles": true,
        "detect_persons": true,
        "detect_plates": true,
        "detect_faces": false,
        "confidence_threshold": 0.5
    }'::jsonb,

    -- Audit
    onboarded_by VARCHAR(100),
    onboarded_at TIMESTAMP DEFAULT now(),
    last_seen TIMESTAMP,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

-- Spatial index for GIS queries
CREATE INDEX idx_cameras_geom ON cameras USING GIST (geom);

-- Query indexes
CREATE INDEX idx_cameras_department ON cameras(department_id);
CREATE INDEX idx_cameras_status ON cameras(status);
CREATE INDEX idx_cameras_type ON cameras(camera_type);
CREATE INDEX idx_cameras_rtsp_url ON cameras(rtsp_url) WHERE rtsp_url IS NOT NULL;

-- Auto-update geom from lat/lng
CREATE OR REPLACE FUNCTION update_camera_geom()
RETURNS TRIGGER AS $$
BEGIN
    NEW.geom = ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326)::geography;
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_camera_geom
    BEFORE INSERT OR UPDATE OF lat, lng ON cameras
    FOR EACH ROW EXECUTE FUNCTION update_camera_geom();
```

### camera_health_log

```sql
CREATE TABLE camera_health_log (
    id BIGSERIAL PRIMARY KEY,
    camera_id UUID REFERENCES cameras(id) ON DELETE CASCADE,
    checked_at TIMESTAMP DEFAULT now(),
    status VARCHAR(20) NOT NULL,
    latency_ms INT,
    stream_bitrate_kbps INT,
    fps_actual INT,
    error_message TEXT,
    checked_by VARCHAR(50) DEFAULT 'system'
);

CREATE INDEX idx_health_camera_time ON camera_health_log(camera_id, checked_at DESC);
CREATE INDEX idx_health_status ON camera_health_log(status);

-- Partition by month for production scalability
-- CREATE TABLE camera_health_log_y2026m09 PARTITION OF camera_health_log
--     FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
```

### detections

```sql
CREATE TABLE detections (
    id BIGSERIAL PRIMARY KEY,
    camera_id UUID REFERENCES cameras(id) ON DELETE SET NULL,

    -- Detection Timing
    detected_at TIMESTAMP NOT NULL,
    frame_number BIGINT,
    processing_time_ms INT,

    -- Detection Classification
    detection_type VARCHAR(20) NOT NULL
        CHECK (detection_type IN ('vehicle','person','object')),

    -- Vehicle/Plate Data
    plate_number VARCHAR(20),
    plate_normalized VARCHAR(20),
    plate_confidence FLOAT,
    plate_raw_ocr TEXT,

    -- Object Detection
    object_class VARCHAR(50),
    object_confidence FLOAT,

    -- Bounding Box (stored as JSONB for flexibility)
    bbox JSONB NOT NULL,
    -- Format: {"x": 120, "y": 340, "w": 200, "h": 90}
    bbox_area INT,

    -- Face Recognition (optional)
    face_embedding VECTOR(512),
    face_confidence FLOAT,

    -- Snapshot
    snapshot_url TEXT,
    snapshot_path TEXT,

    -- Metadata
    model_version VARCHAR(50),
    created_at TIMESTAMP DEFAULT now()
);

-- Performance indexes
CREATE INDEX idx_detections_plate ON detections(plate_number)
    WHERE plate_number IS NOT NULL;
CREATE INDEX idx_detections_plate_normalized ON detections(plate_normalized)
    WHERE plate_normalized IS NOT NULL;
CREATE INDEX idx_detections_camera_time ON detections(camera_id, detected_at);
CREATE INDEX idx_detections_type ON detections(detection_type);
CREATE INDEX idx_detections_created ON detections(created_at DESC);

-- Composite index for vehicle route queries (most critical query)
CREATE INDEX idx_detections_plate_time ON detections(plate_normalized, detected_at ASC)
    WHERE plate_normalized IS NOT NULL;

-- Index for face similarity search
CREATE INDEX idx_detections_face ON detections USING ivfflat (face_embedding vector_cosine_ops)
    WITH (lists = 100);
```

### watchlist

```sql
CREATE TABLE watchlist (
    id SERIAL PRIMARY KEY,

    -- Entry Type
    type VARCHAR(20) NOT NULL
        CHECK (type IN ('vehicle','person')),

    -- Vehicle Data
    plate_number VARCHAR(20),
    plate_normalized VARCHAR(20),

    -- Person Data
    face_embedding VECTOR(512),
    face_reference_url TEXT,
    person_name VARCHAR(200),
    person_photo_url TEXT,

    -- Classification
    reason VARCHAR(500) NOT NULL,
    category VARCHAR(50) CHECK (category IN (
        'stolen_vehicle', 'wanted_person', 'missing_person',
        'blacklisted', 'suspect', 'other'
    )),
    priority VARCHAR(20) DEFAULT 'medium'
        CHECK (priority IN ('low','medium','high','critical')),

    -- Source Tracking
    source_system VARCHAR(50) DEFAULT 'manual',
    external_id VARCHAR(100),
    fir_number VARCHAR(50),

    -- Status
    is_active BOOLEAN DEFAULT true,

    -- Audit
    added_by VARCHAR(100),
    added_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),
    expires_at TIMESTAMP
);

-- Critical index for watchlist matching (most frequently queried)
CREATE INDEX idx_watchlist_plate ON watchlist(plate_normalized)
    WHERE type = 'vehicle' AND is_active = true;
CREATE INDEX idx_watchlist_active ON watchlist(is_active, type);
CREATE INDEX idx_watchlist_category ON watchlist(category);
CREATE INDEX idx_watchlist_priority ON watchlist(priority);

-- Face embedding similarity index
CREATE INDEX idx_watchlist_face ON watchlist USING ivfflat (face_embedding vector_cosine_ops)
    WITH (lists = 50);

-- Trigger to auto-normalize plate number
CREATE OR REPLACE FUNCTION normalize_plate_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.plate_number IS NOT NULL THEN
        NEW.plate_normalized = UPPER(REGEXP_REPLACE(NEW.plate_number, '[^A-Z0-9]', '', 'gi'));
    END IF;
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_watchlist_normalize
    BEFORE INSERT OR UPDATE OF plate_number ON watchlist
    FOR EACH ROW EXECUTE FUNCTION normalize_plate_number();
```

### alerts

```sql
CREATE TABLE alerts (
    id BIGSERIAL PRIMARY KEY,

    -- References
    watchlist_id INT REFERENCES watchlist(id) ON DELETE SET NULL,
    detection_id BIGINT REFERENCES detections(id) ON DELETE SET NULL,
    camera_id UUID REFERENCES cameras(id) ON DELETE SET NULL,

    -- Alert Timing
    triggered_at TIMESTAMP DEFAULT now(),

    -- Classification
    severity VARCHAR(20) DEFAULT 'medium'
        CHECK (severity IN ('low','medium','high','critical')),
    status VARCHAR(20) DEFAULT 'new'
        CHECK (status IN ('new','acknowledged','dismissed','escalated')),

    -- Match Details
    match_type VARCHAR(20)
        CHECK (match_type IN ('plate_exact','plate_fuzzy','face_similarity')),
    match_confidence FLOAT,

    -- Associated Data (denormalized for fast access)
    plate_number VARCHAR(20),
    watchlist_reason VARCHAR(500),
    camera_name VARCHAR(150),
    camera_lat DOUBLE PRECISION,
    camera_lng DOUBLE PRECISION,
    snapshot_url TEXT,

    -- Resolution
    acknowledged_by VARCHAR(100),
    acknowledged_at TIMESTAMP,
    dismissed_by VARCHAR(100),
    dismissed_at TIMESTAMP,
    notes TEXT,

    -- Audit
    created_at TIMESTAMP DEFAULT now()
);

-- Alert query indexes
CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_time ON alerts(triggered_at DESC);
CREATE INDEX idx_alerts_camera ON alerts(camera_id);
CREATE INDEX idx_alerts_watchlist ON alerts(watchlist_id);
CREATE INDEX idx_alerts_severity ON alerts(severity);
CREATE INDEX idx_alerts_unread ON alerts(triggered_at DESC) WHERE status = 'new';
```

### audit_log

```sql
CREATE TABLE audit_log (
    id BIGSERIAL PRIMARY KEY,
    actor VARCHAR(100) NOT NULL,
    actor_ip INET,
    action VARCHAR(100) NOT NULL,
    entity VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100),
    old_values JSONB,
    new_values JSONB,
    details JSONB,
    created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_audit_entity ON audit_log(entity, entity_id);
CREATE INDEX idx_audit_time ON audit_log(created_at DESC);
CREATE INDEX idx_audit_actor ON audit_log(actor);
CREATE INDEX idx_audit_action ON audit_log(action);
```

### system_config

```sql
CREATE TABLE system_config (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_by VARCHAR(100),
    updated_at TIMESTAMP DEFAULT now()
);

-- Default configuration
INSERT INTO system_config (key, value, description) VALUES
    ('ai.fps_default', '2', 'Default frame sampling rate per camera (FPS)'),
    ('ai.confidence_threshold', '0.5', 'Minimum confidence for detection persistence'),
    ('ai.plate_confidence_threshold', '0.6', 'Minimum confidence for plate OCR result'),
    ('ai.face_similarity_threshold', '0.6', 'Minimum cosine similarity for face match'),
    ('ai.max_concurrent_cameras', '20', 'Maximum cameras for simultaneous AI processing'),
    ('alert.push_enabled', 'true', 'Enable WebSocket real-time alert push'),
    ('alert.severity_auto_assign', 'true', 'Auto-assign severity based on watchlist priority'),
    ('stream.default_protocol', '"webrtc"', 'Default streaming protocol (webrtc/hls)'),
    ('camera.health_check_interval_seconds', '30', 'Health check polling interval'),
    ('camera.auto_reconnect', 'true', 'Enable automatic RTSP reconnection'),
    ('camera.reconnect_delays', '[5,10,30,60]', 'Exponential backoff delays in seconds');
```

---

## Sample Queries

### 1. Find cameras within 5km of a point (GIS query)
```sql
SELECT id, name, lat, lng, status,
    ST_Distance(geom, ST_SetSRID(ST_MakePoint(72.5645, 23.0410), 4326)::geography) AS distance_meters
FROM cameras
WHERE ST_DWithin(
    geom,
    ST_SetSRID(ST_MakePoint(72.5645, 23.0410), 4326)::geography,
    5000  -- 5km radius
)
ORDER BY distance_meters;
```

### 2. Vehicle route reconstruction
```sql
SELECT
    d.id,
    d.detected_at,
    d.plate_number,
    d.plate_confidence,
    d.snapshot_url,
    c.name AS camera_name,
    c.lat,
    c.lng,
    c.department_id,
    dep.name AS department_name
FROM detections d
JOIN cameras c ON d.camera_id = c.id
JOIN departments dep ON c.department_id = dep.id
WHERE d.plate_normalized = 'GJ01AB1234'
    AND d.plate_number IS NOT NULL
ORDER BY d.detected_at ASC;
```

### 3. Watchlist matching (real-time)
```sql
-- Exact plate match
SELECT id, type, plate_number, reason, category, priority
FROM watchlist
WHERE type = 'vehicle'
    AND plate_normalized = 'GJ01AB1234'
    AND is_active = true;

-- Face similarity match
SELECT id, type, person_name, reason, category, priority,
    1 - (face_embedding <=> $1::vector) AS similarity
FROM watchlist
WHERE type = 'person'
    AND is_active = true
    AND face_embedding IS NOT NULL
HAVING similarity >= 0.6
ORDER BY similarity DESC
LIMIT 5;
```

### 4. Camera health summary
```sql
SELECT
    c.id,
    c.name,
    c.status,
    c.department_id,
    dep.name AS department,
    chl.checked_at AS last_check,
    chl.status AS last_status,
    chl.latency_ms
FROM cameras c
JOIN departments dep ON c.department_id = dep.id
LEFT JOIN LATERAL (
    SELECT * FROM camera_health_log
    WHERE camera_id = c.id
    ORDER BY checked_at DESC
    LIMIT 1
) chl ON true
ORDER BY c.department_id, c.name;
```

### 5. Alert dashboard query
```sql
SELECT
    a.id,
    a.triggered_at,
    a.severity,
    a.status,
    a.plate_number,
    a.watchlist_reason,
    a.camera_name,
    a.camera_lat,
    a.camera_lng,
    a.snapshot_url,
    w.category AS watchlist_category,
    w.priority AS watchlist_priority
FROM alerts a
LEFT JOIN watchlist w ON a.watchlist_id = w.id
WHERE a.status = 'new'
ORDER BY a.severity DESC, a.triggered_at DESC
LIMIT 50;
```

### 6. Coverage gap analysis
```sql
-- Find grid cells with low camera density
WITH grid AS (
    SELECT
        (ST_SquareGrid(0.01, geom)).geom AS cell  -- ~1km grid
    FROM cameras
)
SELECT cell, COUNT(*) AS camera_count
FROM grid
GROUP BY cell
HAVING COUNT(*) < 2
ORDER BY camera_count;
```

---

## Migration Strategy (Alembic)

```bash
# Initialize Alembic
alembic init alembic

# Create migration
alembic revision --autogenerate -m "initial schema"

# Apply migrations
alembic upgrade head

# Rollback
alembic downgrade -1
```

---

*End of Database Schema Design*
