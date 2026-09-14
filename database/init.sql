-- ═══════════════════════════════════════════════════════════════
-- GICVMAP — Database Initialization Script
-- PostgreSQL 15+ with pgvector
-- ═══════════════════════════════════════════════════════════════

-- ─── Extensions ─────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Try PostGIS (optional — not all images include it)
DO $$ BEGIN
    CREATE EXTENSION IF NOT EXISTS postgis;
    CREATE EXTENSION IF NOT EXISTS postgis_topology;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'PostGIS not available, spatial queries disabled';
END $$;

-- Try pgvector (optional)
DO $$ BEGIN
    CREATE EXTENSION IF NOT EXISTS pgvector;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pgvector not available, vector similarity disabled';
END $$;

-- ─── Departments ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    contact_email VARCHAR(150),
    contact_phone VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

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
    ('Urban Development Department', 'UDD')
ON CONFLICT (code) DO NOTHING;

-- ─── Users ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
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

CREATE INDEX IF NOT EXISTS idx_users_department ON users(department_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Default admin (password: admin123 — bcrypt hash)
INSERT INTO users (username, email, password_hash, full_name, role)
VALUES (
    'admin',
    'admin@gicvmap.gov.in',
    '$2b$12$iuSVCnT4dm9kKJ84dTC5Nulx6n6.ErCVc5YBH3MLrEm2sNLMeMN2C',
    'System Administrator',
    'superadmin'
) ON CONFLICT (username) DO NOTHING;

-- ─── Cameras ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cameras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    department_id INT REFERENCES departments(id),

    camera_type VARCHAR(20) NOT NULL
        CHECK (camera_type IN ('analog','ip')),
    vendor VARCHAR(100),
    model VARCHAR(100),
    ip_address VARCHAR(50),
    port INT DEFAULT 554,

    rtsp_url TEXT,
    onvif_url TEXT,
    onvif_supported BOOLEAN DEFAULT false,
    username VARCHAR(100),
    password_encrypted TEXT,

    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    elevation_m DOUBLE PRECISION,
    direction_deg INT CHECK (direction_deg >= 0 AND direction_deg <= 360),
    field_of_view_deg INT DEFAULT 90,
    location_description TEXT,

    storage_type VARCHAR(20)
        CHECK (storage_type IN ('cloud','local','nvr','none')),
    retention_days INT DEFAULT 7,

    resolution VARCHAR(20),
    fps INT DEFAULT 25,

    status VARCHAR(20) DEFAULT 'unknown'
        CHECK (status IN ('online','offline','degraded','unknown','maintenance')),

    is_analytics_enabled BOOLEAN DEFAULT true,
    analytics_config JSONB DEFAULT '{
        "fps_sampling": 2,
        "detect_vehicles": true,
        "detect_persons": true,
        "detect_plates": true,
        "detect_faces": false,
        "confidence_threshold": 0.5
    }'::jsonb,

    onboarded_by VARCHAR(100),
    onboarded_at TIMESTAMP DEFAULT now(),
    last_seen TIMESTAMP,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cameras_department ON cameras(department_id);
CREATE INDEX IF NOT EXISTS idx_cameras_status ON cameras(status);
CREATE INDEX IF NOT EXISTS idx_cameras_type ON cameras(camera_type);
CREATE INDEX IF NOT EXISTS idx_cameras_rtsp_url ON cameras(rtsp_url) WHERE rtsp_url IS NOT NULL;

-- ─── Camera Health Log ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS camera_health_log (
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

CREATE INDEX IF NOT EXISTS idx_health_camera_time ON camera_health_log(camera_id, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_status ON camera_health_log(status);

-- ─── Detections ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS detections (
    id BIGSERIAL PRIMARY KEY,
    camera_id UUID REFERENCES cameras(id) ON DELETE SET NULL,

    detected_at TIMESTAMP NOT NULL,
    frame_number BIGINT,
    processing_time_ms INT,

    detection_type VARCHAR(20) NOT NULL
        CHECK (detection_type IN ('vehicle','person','object')),

    plate_number VARCHAR(20),
    plate_normalized VARCHAR(20),
    plate_confidence FLOAT,
    plate_raw_ocr TEXT,

    object_class VARCHAR(50),
    object_confidence FLOAT,

    bbox JSONB NOT NULL,
    bbox_area INT,

    snapshot_url TEXT,
    snapshot_path TEXT,

    model_version VARCHAR(50),
    created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_detections_plate ON detections(plate_number)
    WHERE plate_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_detections_plate_normalized ON detections(plate_normalized)
    WHERE plate_normalized IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_detections_camera_time ON detections(camera_id, detected_at);
CREATE INDEX IF NOT EXISTS idx_detections_type ON detections(detection_type);
CREATE INDEX IF NOT EXISTS idx_detections_created ON detections(created_at DESC);

-- ─── Watchlist ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS watchlist (
    id SERIAL PRIMARY KEY,

    type VARCHAR(20) NOT NULL
        CHECK (type IN ('vehicle','person')),

    plate_number VARCHAR(20),
    plate_normalized VARCHAR(20),

    person_name VARCHAR(200),
    person_photo_url TEXT,

    reason VARCHAR(500) NOT NULL,
    category VARCHAR(50) CHECK (category IN (
        'stolen_vehicle', 'wanted_person', 'missing_person',
        'blacklisted', 'suspect', 'other'
    )),
    priority VARCHAR(20) DEFAULT 'medium'
        CHECK (priority IN ('low','medium','high','critical')),

    source_system VARCHAR(50) DEFAULT 'manual',
    external_id VARCHAR(100),
    fir_number VARCHAR(50),

    is_active BOOLEAN DEFAULT true,

    added_by VARCHAR(100),
    added_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),
    expires_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_watchlist_plate ON watchlist(plate_normalized)
    WHERE type = 'vehicle' AND is_active = true;
CREATE INDEX IF NOT EXISTS idx_watchlist_active ON watchlist(is_active, type);
CREATE INDEX IF NOT EXISTS idx_watchlist_category ON watchlist(category);
CREATE INDEX IF NOT EXISTS idx_watchlist_priority ON watchlist(priority);

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

DROP TRIGGER IF EXISTS trg_watchlist_normalize ON watchlist;
CREATE TRIGGER trg_watchlist_normalize
    BEFORE INSERT OR UPDATE OF plate_number ON watchlist
    FOR EACH ROW EXECUTE FUNCTION normalize_plate_number();

-- ─── Alerts ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alerts (
    id BIGSERIAL PRIMARY KEY,

    watchlist_id INT REFERENCES watchlist(id) ON DELETE SET NULL,
    detection_id BIGINT REFERENCES detections(id) ON DELETE SET NULL,
    camera_id UUID REFERENCES cameras(id) ON DELETE SET NULL,

    triggered_at TIMESTAMP DEFAULT now(),

    severity VARCHAR(20) DEFAULT 'medium'
        CHECK (severity IN ('low','medium','high','critical')),
    status VARCHAR(20) DEFAULT 'new'
        CHECK (status IN ('new','acknowledged','dismissed','escalated')),

    match_type VARCHAR(20)
        CHECK (match_type IN ('plate_exact','plate_fuzzy','face_similarity')),
    match_confidence FLOAT,

    plate_number VARCHAR(20),
    watchlist_reason VARCHAR(500),
    camera_name VARCHAR(150),
    camera_lat DOUBLE PRECISION,
    camera_lng DOUBLE PRECISION,
    snapshot_url TEXT,

    acknowledged_by VARCHAR(100),
    acknowledged_at TIMESTAMP,
    dismissed_by VARCHAR(100),
    dismissed_at TIMESTAMP,
    notes TEXT,

    created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_time ON alerts(triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_camera ON alerts(camera_id);
CREATE INDEX IF NOT EXISTS idx_alerts_watchlist ON alerts(watchlist_id);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_unread ON alerts(triggered_at DESC) WHERE status = 'new';

-- ─── Audit Log ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
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

CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);

-- ─── System Config ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_config (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_by VARCHAR(100),
    updated_at TIMESTAMP DEFAULT now()
);

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
    ('camera.reconnect_delays', '[5,10,30,60]', 'Exponential backoff delays in seconds')
ON CONFLICT (key) DO NOTHING;

-- ─── Demo Cameras (Removed for live deployment) ───────────────────────
-- Real cameras will be auto-provisioned by the alert worker when detections arrive.

-- ─── Demo Watchlist Entries ─────────────────────────────────
INSERT INTO watchlist (type, plate_number, reason, category, priority, added_by)
VALUES
    ('vehicle', 'GJ01AB1234', 'Stolen white Swift Dzire reported in FIR #2026/4521', 'stolen_vehicle', 'critical', 'admin'),
    ('vehicle', 'GJ05CD5678', 'Suspect vehicle in robbery case FIR #2026/3892', 'suspect', 'high', 'admin'),
    ('vehicle', 'GJ27EF9012', 'Blacklisted for unpaid toll violations', 'blacklisted', 'medium', 'admin'),
    ('vehicle', 'GJ03GH3456', 'Missing person vehicle - last seen 2026-08-25', 'missing_person', 'high', 'admin'),
    ('person', NULL, 'Wanted in connection with extortion case', 'wanted_person', 'critical', 'admin');
