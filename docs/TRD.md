# Technical Requirements Document (TRD)
## Gujarat Integrated CCTV Video Management & Analytics Platform (GICVMAP)

---

**Document Control**

| Field | Detail |
|-------|--------|
| Document Title | Technical Requirements Document |
| Version | 1.0 |
| Status | Final Draft for Build |
| Owner | Engineering Lead |
| Related PRD | docs/PRD.md |
| Tech Stack | React, Python, Node.js, PostgreSQL, PostGIS, WebRTC, RTSP, Kafka, RabbitMQ, TensorFlow, PyTorch, FFmpeg, GStreamer, Leaflet, OpenLayers |

---

## Table of Contents

1. [Technical Overview](#1-technical-overview)
2. [System Architecture — Detailed Design](#2-system-architecture--detailed-design)
3. [Technology Stack Selection & Justification](#3-technology-stack-selection--justification)
4. [Service Specifications](#4-service-specifications)
5. [Database Technical Design](#5-database-technical-design)
6. [API Technical Specification](#6-api-technical-specification)
7. [Stream Processing Architecture](#7-stream-processing-architecture)
8. [AI/ML Pipeline Technical Design](#8-aiml-pipeline-technical-design)
9. [Message Queue & Event Architecture](#9-message-queue--event-architecture)
10. [Frontend Technical Design](#10-frontend-technical-design)
11. [WebSocket & Real-Time Communication](#11-websocket--real-time-communication)
12. [Authentication & Authorization Technical Design](#12-authentication--authorization-technical-design)
13. [Containerization & Deployment](#13-containerization--deployment)
14. [Monitoring & Observability](#14-monitoring--observability)
15. [Performance Engineering](#15-performance-engineering)
16. [Error Handling & Resilience](#16-error-handling--resilience)
17. [Development Environment Setup](#17-development-environment-setup)
18. [Coding Standards & Conventions](#18-coding-standards--conventions)
19. [Testing Technical Requirements](#19-testing-technical-requirements)
20. [Security Implementation Details](#20-security-implementation-details)

---

## 1. Technical Overview

### 1.1 System Summary

GICVMAP is a microservices-based, event-driven platform that ingests heterogeneous CCTV feeds, performs AI-powered video analytics (ANPR, object detection, optional facial recognition), correlates detections against watchlist databases, and provides a unified React-based dashboard with GIS visualization, live video wall, vehicle search/route reconstruction, and real-time alerting.

### 1.2 Core Technical Capabilities

| Capability | Technical Implementation |
|-----------|------------------------|
| Camera Registry & GIS | PostgreSQL + PostGIS, FastAPI REST API, React + Leaflet frontend |
| Live Stream Ingestion | MediaMTX (RTSP→WebRTC/HLS), FFmpeg frame sampling |
| AI Video Analytics | YOLOv8 (detection), EasyOCR (ANPR), InsightFace (FRS), PyTorch backend |
| Event Processing | Kafka/Redis Streams for async detection event pipeline |
| Real-Time Alerts | WebSocket (Socket.IO) for push notifications |
| Vehicle Tracking | PostGIS spatial queries + chronological plate matching |
| Watchlist Matching | Exact string matching (plates) + vector similarity (faces) via pgvector |
| Object Storage | MinIO (S3-compatible) for detection snapshots |

### 1.3 Design Principles

1. **Microservice Independence**: Each service owns its data, can be deployed/scaled independently.
2. **Event-Driven Decoupling**: All detection/alert flows go through message bus; no synchronous service-to-service calls for analytics.
3. **Adapter Pattern**: Camera integration via protocol adapters; new vendors = new adapter, no core changes.
4. **Config-Driven**: FPS sampling, confidence thresholds, camera sources — all configurable without code changes.
5. **Fail-Safe Degradation**: Single camera failure must not affect others; stream reconnection with exponential backoff.

---

## 2. System Architecture — Detailed Design

### 2.1 Service Topology

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND TIER                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    React SPA (Port 3000)                            │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐│    │
│  │  │ GIS Map  │ │ Video    │ │ Vehicle  │ │ Alerts   │ │ Camera   ││    │
│  │  │ (Leaflet)│ │ Wall     │ │ Search   │ │ Panel    │ │ Admin    ││    │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘│    │
│  └──────────────────────┬──────────────────────────┬────────────────┘    │
│                         │ REST API                  │ WebSocket           │
└─────────────────────────┼──────────────────────────┼─────────────────────┘
                          │                          │
┌─────────────────────────┼──────────────────────────┼─────────────────────┐
│                         │        API GATEWAY         │                     │
│                    ┌────▼────────────────────────────▼────┐               │
│                    │      NGINX (Port 80/443)              │               │
│                    │   Reverse Proxy + Rate Limiting        │               │
│                    └────────┬──────────────────────────┬──┘               │
└─────────────────────────────┼──────────────────────────┼──────────────────┘
                              │                          │
┌─────────────────────────────┼──────────────────────────┼──────────────────┐
│                         │      APPLICATION TIER        │                    │
│                         │                                │                    │
│  ┌──────────┐  ┌────────▼──┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Registry │  │ Watchlist │  │ Alert    │  │ Search   │  │ Auth     │  │
│  │ Service  │  │ Service   │  │ Service  │  │ Service  │  │ Service  │  │
│  │ (Py-FAS) │  │ (Py-FAS)  │  │ (Py-FAS) │  │ (Py-FAS) │  │ (Py-FAS) │  │
│  │ :8001    │  │ :8002     │  │ :8003    │  │ :8004    │  │ :8005    │  │
│  └────┬─────┘  └─────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  │
│       │              │              │              │              │         │
└───────┼──────────────┼──────────────┼──────────────┼──────────────┼─────────┘
        │              │              │              │              │
┌───────┼──────────────┼──────────────┼──────────────┼──────────────┼─────────┐
│       │        INFRASTRUCTURE TIER  │              │              │         │
│       │              │              │              │              │         │
│  ┌────▼─────┐  ┌─────▼─────┐  ┌────▼─────┐  ┌────▼─────┐  ┌────▼─────┐  │
│  │PostgreSQL│  │  Redis    │  │  MinIO   │  │  Kafka/  │  │ MediaMTX │  │
│  │+PostGIS  │  │  :6379    │  │  :9000   │  │  Redis   │  │  :8554   │  │
│  │  :5432   │  │           │  │          │  │ Streams  │  │          │  │
│  └──────────┘  └───────────┘  └──────────┘  └──────────┘  └──────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         AI/ML TIER                                           │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    AI Inference Service (Port 8010)                   │  │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────────────┐  │  │
│  │  │  Frame     │ │  YOLOv8    │ │  ANPR      │ │  Face Recognition │  │  │
│  │  │  Sampler   │ │  Detector  │ │  OCR       │ │  (Optional)       │  │  │
│  │  │  (OpenCV)  │ │  (PyTorch) │ │  (Paddle)  │ │  (InsightFace)    │  │  │
│  │  └────────────┘ └────────────┘ └────────────┘ └──────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │              Stream Gateway (MediaMTX, Port 8554)                     │  │
│  │  RTSP Input → WebRTC/HLS Output                                      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Inter-Service Communication Matrix

| Producer | Consumer | Protocol | Data Format |
|----------|----------|----------|-------------|
| Camera | Stream Gateway | RTSP/ONVIF | H.264/H.265 video |
| Stream Gateway | Dashboard | WebRTC/HLS | Encoded video |
| Stream Gateway | Frame Sampler | RTSP (internal) | Raw video |
| Frame Sampler | AI Inference | HTTP POST (multipart) | JPEG frame + metadata |
| AI Inference | Event Bus | Kafka/Redis Stream | JSON detection event |
| Event Bus | Detection Store | Consumer API | JSON detection event |
| Event Bus | Watchlist Matcher | Consumer API | JSON detection event |
| Watchlist Matcher | Alert Service | Kafka/Redis Stream | JSON alert event |
| Alert Service | Dashboard | WebSocket | JSON alert push |
| Dashboard | Registry Service | HTTP REST | JSON API |
| Dashboard | Search Service | HTTP REST | JSON API |
| Dashboard | Watchlist Service | HTTP REST | JSON API |

### 2.3 Data Flow — Detection Pipeline (Detailed)

```
Frame Extraction:
  Camera (RTSP) → MediaMTX → OpenCV VideoCapture → frame (BGR numpy array)
  ↓
Frame Preprocessing:
  frame → resize to 640x640 (YOLO input) → normalize → tensor
  ↓
Object Detection (YOLOv8):
  tensor → YOLOv8 inference → detections: [{class, confidence, bbox}]
  ↓ Filter: confidence >= 0.5, class in [car, truck, motorcycle, bus, person]
  ↓
Plate Detection:
  vehicle_bbox → crop from original frame → plate_detector inference → plate_bbox
  ↓
Plate OCR:
  plate_image → EasyOCR inference → raw_text
  ↓ Normalize: regex cleanup → "GJ01AB1234"
  ↓
Detection Event Created:
  {camera_id, timestamp, detection_type, plate_number, confidence, bbox, snapshot_url}
  ↓
Event Bus Publish:
  Kafka/Redis → topic: "detections"
  ↓
Parallel Consumers:
  ├→ Detection Store (PostgreSQL persist)
  ├→ Watchlist Matcher (real-time check)
  └→ (Future: Analytics aggregator, reporting pipeline)
```

### 2.4 Data Flow — Alert Pipeline (Detailed)

```
Detection Event (from Event Bus):
  ↓
Watchlist Matcher:
  IF detection_type == "vehicle":
    SELECT * FROM watchlist WHERE type='vehicle' AND plate_number = '{detected_plate}' AND is_active = true
  IF detection_type == "person" AND face_embedding IS NOT NULL:
    SELECT id, cosine_similarity(face_embedding, '{detected_embedding}') as similarity
    FROM watchlist WHERE type='person' AND is_active = true
    HAVING similarity >= 0.6
  ↓
Match Found:
  → Create alert record in PostgreSQL
  → Publish to Kafka/Redis topic: "alerts"
  ↓
Alert Service:
  → Consume from "alerts" topic
  → Fan out to all connected WebSocket clients
  ↓
Dashboard:
  → WebSocket receive → render alert card (snapshot, camera, timestamp, severity)
  → Play alert sound (if enabled)
  → Update alert count badge
```

---

## 3. Technology Stack Selection & Justification

### 3.1 Complete Stack Matrix

| Layer | Technology | Version | Justification |
|-------|-----------|---------|---------------|
| **Frontend** | React.js | 18.x | Component-based, large ecosystem, team familiarity |
| | Leaflet | 1.9.x | Lightweight GIS, good PostGIS integration |
| | react-leaflet | 4.x | React bindings for Leaflet |
| | Socket.IO Client | 4.x | Real-time alert push |
| | Axios | 1.x | HTTP client for REST API calls |
| | React Router | 6.x | Client-side routing |
| | Tailwind CSS | 3.x | Utility-first CSS for rapid UI |
| | Video.js / simple-peer | latest | WebRTC/HLS video playback |
| **Backend** | Python FastAPI | 0.104+ | Async, fast, auto-docs, Pydantic validation |
| | Uvicorn | latest | ASGI server for FastAPI |
| | SQLAlchemy | 2.x | ORM for PostgreSQL |
| | Alembic | latest | Database migrations |
| | Pydantic | 2.x | Data validation and serialization |
| **AI/ML** | PyTorch | 2.x | Deep learning framework |
| | Ultralytics YOLOv8 | 8.x | Object detection (vehicles, persons) |
| | EasyOCR | 2.x | ANPR text recognition |
| | EasyOCR | 1.x | Alternative ANPR OCR |
| | OpenCV (cv2) | 4.x | Frame capture and image processing |
| | InsightFace | 0.7.x | Facial recognition (optional) |
| | NumPy | latest | Numerical operations |
| | Pillow | latest | Image I/O |
| **Database** | PostgreSQL | 15+ | Primary relational database |
| | PostGIS | 3.x | Spatial queries for GIS |
| | pgvector | 0.5+ | Vector similarity for face embeddings |
| | Redis | 7.x | Caching, session store, Redis Streams |
| **Message Queue** | Redis Streams | 7.x | Lightweight event bus (PoC) |
| | Kafka (documented) | 3.x | Production-scale event streaming |
| **Streaming** | MediaMTX | latest | RTSP→WebRTC/HLS gateway |
| | FFmpeg | 6.x | Frame extraction, video transcoding |
| | GStreamer | 1.x | Alternative pipeline (documented) |
| **Object Storage** | MinIO | latest | S3-compatible snapshot storage |
| **Containerization** | Docker | 24.x | Service containerization |
| | Docker Compose | 2.x | Local orchestration |
| **Web Server** | NGINX | 1.25+ | Reverse proxy, static file serving |
| **Auth** | PyJWT | latest | JWT token generation/verification |
| | bcrypt | latest | Password hashing |

### 3.2 Why Each Technology Was Chosen

#### Python FastAPI (Backend)
- **Async support**: Critical for handling concurrent stream processing and WebSocket connections.
- **Auto-generated API docs**: Built-in Swagger/ReDoc for API documentation.
- **Pydantic integration**: Automatic request/response validation.
- **Performance**: Near-Node.js performance for I/O-bound workloads.

#### PostgreSQL + PostGIS (Database)
- **PostGIS**: Native spatial queries — "find cameras within 5km radius", "plot route polyline".
- **pgvector**: Vector similarity search for face embeddings without external vector DB.
- **JSONB**: Flexible storage for bounding box data and audit trail details.
- **Maturity**: Battle-tested for government/enterprise deployments.

#### YOLOv8 (AI Detection)
- **Speed**: Nano/small variants run real-time on CPU.
- **Accuracy**: State-of-the-art for vehicle/person detection on COCO classes.
- **Ease of use**: `pip install ultralytics`, 3 lines of code to run inference.
- **Export flexibility**: Can export to ONNX, TensorRT for production optimization.

#### MediaMTX (Stream Gateway)
- **Lightweight**: Single binary, no heavy dependencies.
- **WebRTC + HLS**: Both low-latency and fallback streaming.
- **Config-driven**: Add cameras via config file or API.
- **Active maintenance**: Regularly updated open-source project.

#### React + Leaflet (Frontend)
- **React**: Component-based UI, virtual DOM for real-time updates.
- **Leaflet**: Lightweight, mobile-friendly, excellent PostGIS integration.
- **react-leaflet**: Clean React bindings, hooks-based API.

---

## 4. Service Specifications

### 4.1 Service Inventory

| Service | Port | Language | Framework | Database | Description |
|---------|------|----------|-----------|----------|-------------|
| registry-service | 8001 | Python | FastAPI | PostgreSQL | Camera CRUD, GIS metadata, departments |
| watchlist-service | 8002 | Python | FastAPI | PostgreSQL | Watchlist CRUD, matching logic |
| alert-service | 8003 | Python | FastAPI | PostgreSQL | Alert CRUD, WebSocket push, acknowledge |
| search-service | 8004 | Python | FastAPI | PostgreSQL | Vehicle history, route reconstruction |
| auth-service | 8005 | Python | FastAPI | PostgreSQL | JWT auth, user management, RBAC |
| ai-service | 8010 | Python | FastAPI | None (stateless) | YOLOv8, ANPR, face recognition |
| frame-sampler | 8011 | Python | Script/Worker | None | OpenCV frame extraction from RTSP |
| stream-gateway | 8554 | Binary | MediaMTX | None | RTSP→WebRTC/HLS relay |
| frontend | 3000 | JS/TS | React | None | SPA dashboard |
| nginx | 80/443 | Config | NGINX | None | Reverse proxy, static files |
| postgres | 5432 | Binary | PostgreSQL | — | Primary database |
| redis | 6379 | Binary | Redis | — | Cache, sessions, streams |
| minio | 9000 | Binary | MinIO | — | Object storage |

### 4.2 Service Dependency Graph

```
                    ┌──────────┐
                    │ Frontend │
                    └────┬─────┘
                         │
                    ┌────▼─────┐
                    │  NGINX   │
                    └────┬─────┘
          ┌──────────────┼──────────────────┐
          │              │                  │
     ┌────▼────┐   ┌────▼────┐   ┌─────────▼─────────┐
     │ Registry │   │ Watchlist│   │    Alert Service   │
     │ Service  │   │ Service  │   │   (WebSocket)     │
     └────┬─────┘   └────┬─────┘   └─────────┬─────────┘
          │              │                    │
          │         ┌────▼────┐              │
          │         │ Search  │              │
          │         │ Service │              │
          │         └────┬────┘              │
          │              │                    │
     ┌────▼──────────────▼────────────────────▼────┐
     │              PostgreSQL + PostGIS            │
     └──────────────────────────────────────────────┘

     ┌──────────┐
     │ AI Svc   │──── Event Bus (Redis/Kafka)
     └──────────┘        │
                    ┌────▼────┐
                    │ Detection│
                    │ Store    │
                    └─────────┘

     ┌──────────┐
     │ MediaMTX │──── RTSP Feeds
     └──────────┘
```

### 4.3 Service Health Check Endpoints

Each service must expose:
```
GET /health → { "status": "healthy", "service": "registry-service", "version": "1.0.0", "uptime": "2h30m" }
GET /ready  → { "status": "ready", "dependencies": { "database": "connected", "redis": "connected" } }
```

---

## 5. Database Technical Design

### 5.1 PostgreSQL Extensions Required

```sql
CREATE EXTENSION IF NOT EXISTS postgis;          -- Spatial queries
CREATE EXTENSION IF NOT EXISTS postgis_topology; -- Topology support
CREATE EXTENSION IF NOT EXISTS pgvector;         -- Vector similarity (face embeddings)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";      -- UUID generation
CREATE EXTENSION IF NOT EXISTS pg_trgm;          -- Fuzzy text search (plate number tolerance)
```

### 5.2 Complete DDL

#### users
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(200),
    role VARCHAR(30) NOT NULL CHECK (role IN ('superadmin','dept_admin','operator','viewer')),
    department_id INT REFERENCES departments(id),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_users_department ON users(department_id);
CREATE INDEX idx_users_role ON users(role);
```

#### departments
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

INSERT INTO departments (name, code) VALUES
    ('Home Department / Police', 'HOME'),
    ('Municipal Corporation', 'MUNI'),
    ('RTO', 'RTO'),
    ('Food & Civil Supplies', 'FCS'),
    ('Education Department', 'EDU'),
    ('Health Department', 'HLT'),
    ('Social Justice Department', 'SJD'),
    ('Tribal Development Department', 'TDD');
```

#### cameras
```sql
CREATE TABLE cameras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    department_id INT REFERENCES departments(id),
    camera_type VARCHAR(20) NOT NULL CHECK (camera_type IN ('analog','ip')),
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
    geom GEOGRAPHY(Point, 4326) NOT NULL,
    elevation_m DOUBLE PRECISION,
    direction_deg INT CHECK (direction_deg >= 0 AND direction_deg <= 360),
    field_of_view_deg INT DEFAULT 90,
    storage_type VARCHAR(20) CHECK (storage_type IN ('cloud','local','nvr','none')),
    retention_days INT DEFAULT 7,
    resolution VARCHAR(20),
    fps INT DEFAULT 25,
    status VARCHAR(20) DEFAULT 'unknown' CHECK (status IN ('online','offline','degraded','unknown','maintenance')),
    is_analytics_enabled BOOLEAN DEFAULT true,
    analytics_config JSONB DEFAULT '{}',
    onboarded_by VARCHAR(100),
    onboarded_at TIMESTAMP DEFAULT now(),
    last_seen TIMESTAMP,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_cameras_geom ON cameras USING GIST (geom);
CREATE INDEX idx_cameras_department ON cameras(department_id);
CREATE INDEX idx_cameras_status ON cameras(status);
CREATE INDEX idx_cameras_rtsp_url ON cameras(rtsp_url);

-- Trigger to auto-update geom from lat/lng
CREATE OR REPLACE FUNCTION update_camera_geom()
RETURNS TRIGGER AS $$
BEGIN
    NEW.geom = ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326)::geography;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_camera_geom
    BEFORE INSERT OR UPDATE OF lat, lng ON cameras
    FOR EACH ROW EXECUTE FUNCTION update_camera_geom();
```

#### camera_health_log
```sql
CREATE TABLE camera_health_log (
    id BIGSERIAL PRIMARY KEY,
    camera_id UUID REFERENCES cameras(id) ON DELETE CASCADE,
    checked_at TIMESTAMP DEFAULT now(),
    status VARCHAR(20) NOT NULL,
    latency_ms INT,
    stream_bitrate_kbps INT,
    error_message TEXT,
    checked_by VARCHAR(50) DEFAULT 'system'
);

CREATE INDEX idx_health_camera_time ON camera_health_log(camera_id, checked_at DESC);
```

#### detections
```sql
CREATE TABLE detections (
    id BIGSERIAL PRIMARY KEY,
    camera_id UUID REFERENCES cameras(id) ON DELETE SET NULL,
    detected_at TIMESTAMP NOT NULL,
    detection_type VARCHAR(20) NOT NULL CHECK (detection_type IN ('vehicle','person','object')),
    plate_number VARCHAR(20),
    plate_confidence FLOAT,
    plate_raw_ocr TEXT,
    object_class VARCHAR(50),
    object_confidence FLOAT,
    bbox JSONB NOT NULL,
    bbox_area INT,
    face_embedding VECTOR(512),
    face_confidence FLOAT,
    snapshot_url TEXT,
    snapshot_path TEXT,
    frame_number BIGINT,
    processing_time_ms INT,
    model_version VARCHAR(50),
    created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_detections_plate ON detections(plate_number) WHERE plate_number IS NOT NULL;
CREATE INDEX idx_detections_camera_time ON detections(camera_id, detected_at);
CREATE INDEX idx_detections_type ON detections(detection_type);
CREATE INDEX idx_detections_created ON detections(created_at DESC);

-- Partial index for active plate lookups
CREATE INDEX idx_detections_plate_time ON detections(plate_number, detected_at)
    WHERE plate_number IS NOT NULL;
```

#### watchlist
```sql
CREATE TABLE watchlist (
    id SERIAL PRIMARY KEY,
    type VARCHAR(20) NOT NULL CHECK (type IN ('vehicle','person')),
    plate_number VARCHAR(20),
    plate_normalized VARCHAR(20),
    face_embedding VECTOR(512),
    face_reference_url TEXT,
    person_name VARCHAR(200),
    person_photo_url TEXT,
    reason VARCHAR(500) NOT NULL,
    category VARCHAR(50) CHECK (category IN ('stolen_vehicle','wanted_person','missing_person','blacklisted','suspect','other')),
    source_system VARCHAR(50) DEFAULT 'manual',
    external_id VARCHAR(100),
    fir_number VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
    added_by VARCHAR(100),
    added_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),
    expires_at TIMESTAMP
);

CREATE INDEX idx_watchlist_plate ON watchlist(plate_normalized) WHERE type = 'vehicle' AND is_active = true;
CREATE INDEX idx_watchlist_active ON watchlist(is_active, type);
CREATE INDEX idx_watchlist_category ON watchlist(category);
```

#### alerts
```sql
CREATE TABLE alerts (
    id BIGSERIAL PRIMARY KEY,
    watchlist_id INT REFERENCES watchlist(id) ON DELETE SET NULL,
    detection_id BIGINT REFERENCES detections(id) ON DELETE SET NULL,
    camera_id UUID REFERENCES cameras(id) ON DELETE SET NULL,
    triggered_at TIMESTAMP DEFAULT now(),
    severity VARCHAR(20) DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
    status VARCHAR(20) DEFAULT 'new' CHECK (status IN ('new','acknowledged','dismissed','escalated')),
    match_type VARCHAR(20) CHECK (match_type IN ('plate_exact','plate_fuzzy','face_similarity')),
    match_confidence FLOAT,
    acknowledged_by VARCHAR(100),
    acknowledged_at TIMESTAMP,
    dismissed_by VARCHAR(100),
    dismissed_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_time ON alerts(triggered_at DESC);
CREATE INDEX idx_alerts_camera ON alerts(camera_id);
CREATE INDEX idx_alerts_watchlist ON alerts(watchlist_id);
CREATE INDEX idx_alerts_severity ON alerts(severity);
```

#### audit_log
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
```

#### system_config
```sql
CREATE TABLE system_config (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_by VARCHAR(100),
    updated_at TIMESTAMP DEFAULT now()
);

INSERT INTO system_config (key, value, description) VALUES
    ('ai.fps_default', '2', 'Default frame sampling rate per camera'),
    ('ai.confidence_threshold', '0.5', 'Minimum confidence for detection persistence'),
    ('ai.plate_confidence_threshold', '0.6', 'Minimum confidence for plate OCR'),
    ('ai.face_similarity_threshold', '0.6', 'Minimum cosine similarity for face match'),
    ('alert.push_enabled', 'true', 'Enable WebSocket alert push'),
    ('stream.default_protocol', '"webrtc"', 'Default streaming protocol'),
    ('camera.health_check_interval_seconds', '30', 'Health check interval');
```

### 5.3 ER Diagram (Textual)

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  departments │────<│     cameras       │────<│    detections     │
│──────────────│     │──────────────────│     │──────────────────│
│ id (PK)      │     │ id (PK, UUID)    │     │ id (PK, BIGINT)  │
│ name         │     │ name             │     │ camera_id (FK)   │
│ code (UQ)    │     │ department_id(FK)│     │ detected_at      │
│ contact_email│     │ camera_type      │     │ detection_type   │
│ created_at   │     │ rtsp_url         │     │ plate_number     │
└──────────────┘     │ lat, lng         │     │ plate_confidence │
                     │ geom (GEOGRAPHY) │     │ bbox (JSONB)     │
                     │ status           │     │ face_embedding   │
                     │ onboarded_by     │     │ snapshot_url     │
                     └────────┬─────────┘     └────────┬─────────┘
                              │                        │
                              │                        │
                     ┌────────▼─────────┐     ┌────────▼─────────┐
                     │camera_health_log │     │     alerts        │
                     │──────────────────│     │──────────────────│
                     │ id (PK)          │     │ id (PK)          │
                     │ camera_id (FK)   │     │ watchlist_id(FK) │
                     │ checked_at       │     │ detection_id(FK) │
                     │ status           │     │ camera_id (FK)   │
                     │ latency_ms       │     │ triggered_at     │
                     └──────────────────┘     │ severity         │
                                              │ status           │
                     ┌──────────────────┐     └────────┬─────────┘
                     │    watchlist     │              │
                     │──────────────────│              │
                     │ id (PK)          │──────────────┘
                     │ type             │
                     │ plate_number     │
                     │ face_embedding   │
                     │ reason           │
                     │ category         │
                     │ is_active        │
                     │ priority         │
                     └──────────────────┘

                     ┌──────────────────┐
                     │    audit_log     │
                     │──────────────────│
                     │ id (PK)          │
                     │ actor            │
                     │ action           │
                     │ entity           │
                     │ entity_id        │
                     │ old_values       │
                     │ new_values       │
                     │ created_at       │
                     └──────────────────┘

                     ┌──────────────────┐
                     │   system_config  │
                     │──────────────────│
                     │ key (PK)         │
                     │ value (JSONB)    │
                     │ description      │
                     │ updated_at       │
                     └──────────────────┘
```

---

## 6. API Technical Specification

### 6.1 API Design Standards

- **Base URL**: `/api/v1`
- **Authentication**: Bearer JWT in `Authorization` header
- **Content-Type**: `application/json` (except file uploads: `multipart/form-data`)
- **Pagination**: `?page=1&per_page=20` (default: page=1, per_page=20, max_per_page=100)
- **Filtering**: `?field=value` query parameters
- **Sorting**: `?sort=field:asc` or `?sort=field:desc`
- **Date format**: ISO 8601 (`2026-09-10T14:32:05Z`)
- **Error format**:
```json
{
  "error": {
    "code": "CAMERA_NOT_FOUND",
    "message": "Camera with id 'xyz' not found",
    "details": {}
  }
}
```

### 6.2 Camera Registry API (Detailed)

#### POST /api/v1/cameras
```
Request:
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
  "fps": 25
}

Response (201):
{
  "id": "b3f1a2c4-...",
  "name": "Ring Road Junction Cam 3",
  "status": "unknown",
  "onboarded_at": "2026-09-10T10:00:00Z",
  ...
}
```

#### GET /api/v1/cameras
```
Query Parameters:
  ?department_id=1
  &camera_type=ip
  &status=online
  &lat_min=23.0&lat_max=23.1&lng_min=72.5&lng_max=72.6  (bounding box)
  &search=ring+road
  &sort=created_at:desc
  &page=1&per_page=20

Response (200):
{
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 50,
    "total_pages": 3
  }
}
```

#### POST /api/v1/cameras/bulk-upload
```
Request: multipart/form-data
  file: cameras.csv

CSV Format:
  name,department_code,camera_type,vendor,ip_address,port,rtsp_url,lat,lng,storage_type,retention_days
  "Cam 1","HOME","ip","Hikvision","192.168.1.1","554","rtsp://...",23.041,72.564,"nvr",14

Response (200):
{
  "imported": 45,
  "failed": 5,
  "errors": [
    { "row": 12, "reason": "Invalid RTSP URL format" },
    ...
  ]
}
```

### 6.3 Detection & Vehicle Search API

#### GET /api/v1/vehicle/{plate_number}/history
```
Response (200):
{
  "plate_number": "GJ01AB1234",
  "total_detections": 8,
  "detections": [
    {
      "id": 1001,
      "camera_id": "b3f1...",
      "camera_name": "Ring Road Junction Cam 3",
      "department": "Home Department",
      "detected_at": "2026-09-10T14:32:05Z",
      "lat": 23.0410,
      "lng": 72.5645,
      "confidence": 0.87,
      "snapshot_url": "/api/v1/snapshots/det_1001.jpg"
    },
    ...
  ]
}
```

#### GET /api/v1/vehicle/{plate_number}/route
```
Response (200):
{
  "plate_number": "GJ01AB1234",
  "route": {
    "type": "Feature",
    "geometry": {
      "type": "LineString",
      "coordinates": [
        [72.5645, 23.0410],
        [72.5700, 23.0450],
        [72.5800, 23.0500]
      ]
    },
    "properties": {
      "total_distance_km": 3.2,
      "estimated_duration_min": 8,
      "estimated_avg_speed_kmh": 24
    }
  },
  "waypoints": [
    {
      "sequence": 1,
      "camera_name": "Ring Road Junction Cam 3",
      "lat": 23.0410,
      "lng": 72.5645,
      "detected_at": "2026-09-10T14:32:05Z",
      "snapshot_url": "/api/v1/snapshots/det_1001.jpg"
    },
    ...
  ]
}
```

### 6.4 Watchlist API

#### POST /api/v1/watchlist
```
Request:
{
  "type": "vehicle",
  "plate_number": "GJ01AB1234",
  "reason": "Stolen Vehicle - FIR 2026/1123",
  "category": "stolen_vehicle",
  "source_system": "VAHAN-mock",
  "priority": "high"
}

Response (201):
{
  "id": 42,
  "type": "vehicle",
  "plate_number": "GJ01AB1234",
  "plate_normalized": "GJ01AB1234",
  "is_active": true,
  "added_at": "2026-09-10T10:00:00Z"
}
```

### 6.5 Alert API

#### GET /api/v1/alerts
```
Query Parameters:
  ?status=new
  &severity=high
  &camera_id=b3f1...
  &from=2026-09-10T00:00:00Z
  &to=2026-09-11T00:00:00Z
  &page=1&per_page=20

Response (200):
{
  "data": [
    {
      "id": 5521,
      "watchlist_reason": "Stolen Vehicle - FIR 2026/1123",
      "plate_number": "GJ01AB1234",
      "camera_id": "b3f1...",
      "camera_name": "Ring Road Junction Cam 3",
      "lat": 23.0410,
      "lng": 72.5645,
      "triggered_at": "2026-09-10T14:32:07Z",
      "severity": "high",
      "status": "new",
      "snapshot_url": "/api/v1/snapshots/alert_5521.jpg"
    }
  ],
  "pagination": { ... }
}
```

#### PUT /api/v1/alerts/{id}/acknowledge
```
Request:
{
  "notes": "Dispatched unit to location"
}

Response (200):
{
  "id": 5521,
  "status": "acknowledged",
  "acknowledged_by": "operator1",
  "acknowledged_at": "2026-09-10T14:35:00Z"
}
```

### 6.6 WebSocket Protocol

#### Connection
```
ws://localhost:8003/ws/alerts?token={jwt_token}
```

#### Alert Push Message
```json
{
  "event": "alert.new",
  "data": {
    "alert_id": 5521,
    "watchlist_reason": "Stolen Vehicle - FIR 2026/1123",
    "plate_number": "GJ01AB1234",
    "camera_id": "b3f1...",
    "camera_name": "Ring Road Junction Cam 3",
    "lat": 23.0410,
    "lng": 72.5645,
    "triggered_at": "2026-09-10T14:32:07Z",
    "severity": "high",
    "snapshot_url": "/api/v1/snapshots/alert_5521.jpg"
  }
}
```

#### Client Acknowledgment
```json
{
  "event": "alert.acknowledge",
  "data": {
    "alert_id": 5521,
    "notes": "Unit dispatched"
  }
}
```

---

## 7. Stream Processing Architecture

### 7.1 Stream Ingestion Flow

```
Camera (RTSP) ──────────────────────────────┐
                                             │
                                    ┌────────▼────────┐
                                    │    MediaMTX      │
                                    │  (Stream Gateway) │
                                    │                  │
                                    │  Input: RTSP     │
                                    │  Output: WebRTC  │
                                    │         HLS      │
                                    └───┬──────────┬───┘
                                        │          │
                          ┌─────────────┘          └─────────────┐
                          ▼                                      ▼
                 ┌────────────────┐                    ┌────────────────┐
                 │  Dashboard     │                    │ Frame Sampler  │
                 │  WebRTC Player │                    │  (OpenCV)      │
                 └────────────────┘                    │                │
                                                       │  cv2.VideoCapture(rtsp_url)
                                                       │  frame = cap.read()
                                                       │  @ configurable FPS
                                                       └───────┬────────┘
                                                               │
                                                               ▼
                                                       ┌────────────────┐
                                                       │  AI Inference   │
                                                       └────────────────┘
```

### 7.2 MediaMTX Configuration

```yaml
# mediamtx.yml
rtsp: true
rtspAddress: :8554
webrtc: true
webrtcAddress: :8889
hls: true
hlsAddress: :8888

paths:
  cam1:
    source: rtsp://192.168.1.100:554/stream1
  cam2:
    source: rtsp://192.168.1.101:554/stream1
  # Dynamic paths added via API or config reload
```

### 7.3 FFmpeg Frame Extraction

```bash
# Extract frames at 2 FPS from RTSP stream for AI processing
ffmpeg -i rtsp://localhost:8554/cam1 \
  -vf "fps=2" \
  -q:v 2 \
  -f image2pipe \
  -vcodec mjpeg \
  pipe:1

# Alternative: Extract frames to a directory for batch processing
ffmpeg -i rtsp://localhost:8554/cam1 \
  -vf "fps=2" \
  -q:v 2 \
  frames/cam1_%04d.jpg
```

### 7.4 Python Frame Sampler Implementation Pattern

```python
import cv2
import time
import asyncio
import httpx
from datetime import datetime

class FrameSampler:
    def __init__(self, camera_id: str, rtsp_url: str, fps: int = 2):
        self.camera_id = camera_id
        self.rtsp_url = rtsp_url
        self.fps = fps
        self.running = False
        self.cap = None

    async def start(self):
        self.running = True
        self.cap = cv2.VideoCapture(self.rtsp_url)
        interval = 1.0 / self.fps

        while self.running:
            ret, frame = self.cap.read()
            if not ret:
                await self._reconnect()
                continue

            # Send frame to AI service
            await self._send_frame(frame, datetime.utcnow())

            # Wait for next frame
            await asyncio.sleep(interval)

    async def _send_frame(self, frame, timestamp):
        # Encode frame as JPEG
        _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])

        async with httpx.AsyncClient() as client:
            await client.post(
                "http://ai-service:8010/api/v1/infer",
                files={"frame": ("frame.jpg", buffer.tobytes(), "image/jpeg")},
                data={
                    "camera_id": self.camera_id,
                    "timestamp": timestamp.isoformat()
                }
            )

    async def _reconnect(self):
        """Exponential backoff reconnection"""
        for delay in [5, 10, 30, 60]:
            await asyncio.sleep(delay)
            self.cap = cv2.VideoCapture(self.rtsp_url)
            if self.cap.isOpened():
                return
```

---

## 8. AI/ML Pipeline Technical Design

### 8.1 Model Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   AI INFERENCE SERVICE                    │
│                                                          │
│  Input: JPEG frame + camera_id + timestamp               │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Stage 1: Object Detection (YOLOv8)                │   │
│  │                                                    │   │
│  │ Model: yolov8n.pt (nano, 3.2M params)            │   │
│  │         or yolov8s.pt (small, 11.2M params)       │   │
│  │ Input: 640x640 RGB tensor                         │   │
│  │ Output: [{class_id, confidence, bbox}]            │   │
│  │ Classes: [car, truck, motorcycle, bus, person]     │   │
│  │ Confidence threshold: 0.5                          │   │
│  └───────────────┬──────────────────────────────────┘   │
│                  │                                       │
│  ┌───────────────▼──────────────────────────────────┐   │
│  │ Stage 2: Plate Detection (YOLOv8 custom)          │   │
│  │                                                    │   │
│  │ Model: yolov8-plate.pt (fine-tuned, ~5MB)        │   │
│  │ Input: cropped vehicle region from Stage 1        │   │
│  │ Output: plate_bbox within vehicle crop            │   │
│  └───────────────┬──────────────────────────────────┘   │
│                  │                                       │
│  ┌───────────────▼──────────────────────────────────┐   │
│  │ Stage 3: Plate OCR (EasyOCR)                    │   │
│  │                                                    │   │
│  │ Model: EasyOCR v3 (det + rec)                   │   │
│  │ Input: cropped plate image                        │   │
│  │ Output: raw text string                           │   │
│  └───────────────┬──────────────────────────────────┘   │
│                  │                                       │
│  ┌───────────────▼──────────────────────────────────┐   │
│  │ Stage 4: Plate Normalization                      │   │
│  │                                                    │   │
│  │ Regex: ^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$  │   │
│  │ Cleanup: remove spaces, special chars             │   │
│  │ Output: "GJ01AB1234"                              │   │
│  └───────────────┬──────────────────────────────────┘   │
│                  │                                       │
│  ┌───────────────▼──────────────────────────────────┐   │
│  │ Stage 5: Face Detection + Embedding (Optional)    │   │
│  │                                                    │   │
│  │ Detection: RetinaFace                             │   │
│  │ Embedding: ArcFace (InsightFace)                  │   │
│  │ Input: person bbox from Stage 1                   │   │
│  │ Output: 512-dim vector                            │   │
│  └───────────────┬──────────────────────────────────┘   │
│                  │                                       │
│  Output: DetectionEvent JSON → Event Bus                 │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### 8.2 AI Service API

```python
# POST /api/v1/infer
# Request: multipart/form-data
#   - frame: JPEG image
#   - camera_id: string
#   - timestamp: ISO datetime string
#
# Response:
# {
#   "detections": [
#     {
#       "detection_type": "vehicle",
#       "plate_number": "GJ01AB1234",
#       "plate_confidence": 0.87,
#       "plate_raw_ocr": "GJ 01 AB 1234",
#       "object_class": "car",
#       "object_confidence": 0.92,
#       "bbox": {"x": 120, "y": 340, "w": 200, "h": 90},
#       "processing_time_ms": 145
#     }
#   ],
#   "processing_time_ms": 145,
#   "model_version": "yolov8n-1.0"
# }
```

### 8.3 Model Configuration

```python
# config/ai_config.yaml
detection:
  model: "yolov8n.pt"
  input_size: 640
  confidence_threshold: 0.5
  nms_threshold: 0.45
  classes: ["car", "truck", "motorcycle", "bus", "person"]

plate_detection:
  model: "yolov8-plate.pt"
  input_size: 320
  confidence_threshold: 0.6

ocr:
  engine: "EasyOCR"  # or "easyocr"
  languages: ["en"]
  confidence_threshold: 0.5

normalization:
  indian_plate_regex: "^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$"
  min_plate_length: 8
  max_plate_length: 12

face_recognition:
  enabled: false
  detection_model: "retinaface"
  embedding_model: "arcface"
  embedding_dim: 512
  similarity_threshold: 0.6

pipeline:
  fps_sampling: 2
  batch_size: 1
  device: "cpu"  # or "cuda:0" for GPU
  max_concurrent_cameras: 20
```

---

## 9. Message Queue & Event Architecture

### 9.1 Event Topics (Redis Streams)

| Stream | Producer | Consumer(s) | Purpose |
|--------|----------|-------------|---------|
| `detections` | ai-service | detection-store, watchlist-matcher, (analytics-aggregator) | All detection events |
| `alerts` | watchlist-matcher | alert-service | Matched watchlist alerts |
| `camera-health` | health-checker | registry-service, alert-service | Camera status changes |

### 9.2 Event Schemas

#### Detection Event (detections stream)
```json
{
  "event_id": "uuid-v4",
  "event_type": "detection",
  "camera_id": "uuid",
  "detected_at": "2026-09-10T14:32:05.123Z",
  "detection_type": "vehicle",
  "plate_number": "GJ01AB1234",
  "plate_confidence": 0.87,
  "plate_raw_ocr": "GJ 01 AB 1234",
  "object_class": "car",
  "object_confidence": 0.92,
  "bbox": {"x": 120, "y": 340, "w": 200, "h": 90},
  "snapshot_url": "minio://detections/2026-09-10/cam3/1425.jpg",
  "processing_time_ms": 145,
  "model_version": "yolov8n-1.0"
}
```

#### Alert Event (alerts stream)
```json
{
  "event_id": "uuid-v4",
  "event_type": "alert",
  "alert_id": 5521,
  "watchlist_id": 42,
  "detection_id": 1001,
  "camera_id": "uuid",
  "match_type": "plate_exact",
  "match_confidence": 1.0,
  "triggered_at": "2026-09-10T14:32:07.456Z",
  "severity": "high",
  "plate_number": "GJ01AB1234",
  "watchlist_reason": "Stolen Vehicle - FIR 2026/1123",
  "camera_name": "Ring Road Junction Cam 3",
  "lat": 23.0410,
  "lng": 72.5645,
  "snapshot_url": "minio://alerts/2026-09-10/alert_5521.jpg"
}
```

### 9.3 Consumer Implementation Pattern

```python
import redis
import json
import asyncio

class DetectionConsumer:
    def __init__(self, redis_client, consumer_name):
        self.redis = redis_client
        self.consumer_name = consumer_name
        self.group = "detection-processors"

    async def start_consuming(self):
        # Create consumer group if not exists
        try:
            self.redis.xgroup_create("detections", self.group, id="0", mkstream=True)
        except redis.exceptions.ResponseError:
            pass  # Group already exists

        while True:
            try:
                messages = self.redis.xreadgroup(
                    self.group,
                    self.consumer_name,
                    {"detections": ">"},
                    count=10,
                    block=1000
                )
                for stream, entries in messages:
                    for message_id, data in entries:
                        event = json.loads(data[b"event"])
                        await self.process_detection(event)
                        self.redis.xack("detections", self.group, message_id)
            except Exception as e:
                logger.error(f"Consumer error: {e}")
                await asyncio.sleep(1)
```

---

## 10. Frontend Technical Design

### 10.1 Application Structure

```
frontend/
├── public/
│   ├── index.html
│   └── favicon.ico
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   └── MainLayout.tsx
│   │   ├── map/
│   │   │   ├── GisMap.tsx          # Leaflet map container
│   │   │   ├── CameraMarker.tsx    # Camera pin component
│   │   │   ├── RoutePolyline.tsx   # Vehicle route overlay
│   │   │   └── AlertMarker.tsx     # Pulsing alert markers
│   │   ├── video/
│   │   │   ├── VideoWall.tsx       # Multi-camera grid
│   │   │   ├── VideoTile.tsx       # Single camera tile (WebRTC/HLS)
│   │   │   └── VideoControls.tsx   # Play/pause/fullscreen
│   │   ├── alerts/
│   │   │   ├── AlertPanel.tsx      # Real-time alert list
│   │   │   ├── AlertCard.tsx       # Single alert card
│   │   │   └── AlertBadge.tsx      # Count badge
│   │   ├── vehicles/
│   │   │   ├── VehicleSearch.tsx   # Search input + results
│   │   │   ├── DetectionTable.tsx  # Detection history table
│   │   │   └── RouteMap.tsx        # Route visualization
│   │   ├── cameras/
│   │   │   ├── CameraList.tsx      # Camera table view
│   │   │   ├── CameraForm.tsx      # Add/edit camera
│   │   │   ├── BulkUpload.tsx      # CSV import
│   │   │   └── CameraHealth.tsx    # Health dashboard
│   │   └── watchlist/
│   │       ├── WatchlistTable.tsx  # Watchlist entries
│   │       └── WatchlistForm.tsx   # Add/edit entry
│   ├── hooks/
│   │   ├── useWebSocket.ts         # Socket.IO connection hook
│   │   ├── useCameraApi.ts         # Camera CRUD hook
│   │   ├── useAlerts.ts            # Alert state management
│   │   └── useVehicleSearch.ts     # Vehicle search hook
│   ├── services/
│   │   ├── api.ts                  # Axios instance + interceptors
│   │   ├── cameraService.ts        # Camera API calls
│   │   ├── alertService.ts         # Alert API calls
│   │   ├── vehicleService.ts       # Vehicle search API calls
│   │   └── websocketService.ts     # Socket.IO client setup
│   ├── store/
│   │   ├── authStore.ts            # Auth state (Zustand)
│   │   ├── alertStore.ts           # Alert state
│   │   └── cameraStore.ts          # Camera state
│   ├── types/
│   │   ├── camera.ts               # Camera type definitions
│   │   ├── detection.ts            # Detection type definitions
│   │   ├── alert.ts                # Alert type definitions
│   │   └── api.ts                  # API response types
│   ├── utils/
│   │   ├── plateNormalizer.ts      # Plate number formatting
│   │   ├── dateFormatter.ts        # Date display utilities
│   │   └── mapUtils.ts             # Leaflet helpers
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

### 10.2 Page Routes

```tsx
// src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <BrowserRouter>
      <MainLayout>
        <Routes>
          <Route path="/" element={<GisMapPage />} />
          <Route path="/video-wall" element={<VideoWallPage />} />
          <Route path="/vehicle-search" element={<VehicleSearchPage />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/cameras" element={<CameraAdminPage />} />
          <Route path="/watchlist" element={<WatchlistAdminPage />} />
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </MainLayout>
    </BrowserRouter>
  );
}
```

### 10.3 Real-Time Alert Integration

```tsx
// src/hooks/useWebSocket.ts
import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAlertStore } from '../store/alertStore';

export function useWebSocket(token: string) {
  const socketRef = useRef<Socket | null>(null);
  const addAlert = useAlertStore(state => state.addAlert);

  useEffect(() => {
    const socket = io('ws://localhost:8003/ws/alerts', {
      auth: { token },
      transports: ['websocket']
    });

    socket.on('alert.new', (data) => {
      addAlert(data);
      // Play alert sound
      new Audio('/alert-sound.mp3').play();
    });

    socket.on('alert.acknowledged', (data) => {
      // Update alert status in store
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [token]);

  return socketRef;
}
```

---

## 11. WebSocket & Real-Time Communication

### 11.1 WebSocket Server (FastAPI + Socket.IO)

```python
# alert_service/websocket.py
import socketio
from datetime import datetime

sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*'
)

@sio.event
async def connect(sid, environ, auth):
    token = auth.get('token')
    user = await verify_jwt(token)
    if not user:
        raise socketio.exceptions.ConnectionRefusedError('Unauthorized')
    await sio.enter_room(sid, f"dept_{user.department_id}")
    await sio.enter_room(sid, "all_users")

@sio.event
async def alert_acknowledge(sid, data):
    alert_id = data['alert_id']
    notes = data.get('notes', '')
    user = await get_user_from_sid(sid)
    await acknowledge_alert(alert_id, user.username, notes)
    await sio.emit('alert.acknowledged', {
        'alert_id': alert_id,
        'acknowledged_by': user.username
    }, room='all_users')

async def push_alert(alert_data):
    """Called by alert engine when new alert is created"""
    severity = alert_data['severity']
    if severity in ('high', 'critical'):
        await sio.emit('alert.new', alert_data, room='all_users')
    else:
        await sio.emit('alert.new', alert_data, room=f"dept_{alert_data['department_id']}")
```

---

## 12. Authentication & Authorization Technical Design

### 12.1 JWT Token Structure

```json
{
  "sub": "user123",
  "email": "operator@gujarat.gov.in",
  "role": "operator",
  "department_id": 1,
  "permissions": ["cameras.read", "alerts.read", "alerts.acknowledge", "vehicles.search"],
  "iat": 1725964800,
  "exp": 1725968400
}
```

### 12.2 RBAC Permission Matrix

| Resource | superadmin | dept_admin | operator | viewer |
|----------|-----------|------------|----------|--------|
| cameras.create | ✅ | ✅ (own dept) | ❌ | ❌ |
| cameras.read | ✅ (all) | ✅ (own dept) | ✅ (own dept) | ✅ (own dept) |
| cameras.update | ✅ | ✅ (own dept) | ❌ | ❌ |
| cameras.delete | ✅ | ✅ (own dept) | ❌ | ❌ |
| cameras.bulk_upload | ✅ | ✅ (own dept) | ❌ | ❌ |
| watchlist.create | ✅ | ✅ | ❌ | ❌ |
| watchlist.read | ✅ | ✅ | ✅ | ✅ |
| alerts.read | ✅ | ✅ | ✅ | ✅ |
| alerts.acknowledge | ✅ | ✅ | ✅ | ❌ |
| alerts.dismiss | ✅ | ✅ | ❌ | ❌ |
| vehicles.search | ✅ | ✅ | ✅ | ✅ |
| users.manage | ✅ | ❌ | ❌ | ❌ |
| system.config | ✅ | ❌ | ❌ | ❌ |

### 12.3 Auth Middleware Implementation

```python
# auth/middleware.py
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    try:
        payload = jwt.decode(
            credentials.credentials,
            SECRET_KEY,
            algorithms=["HS256"]
        )
        user = await get_user_by_id(payload["sub"])
        if not user or not user.is_active:
            raise HTTPException(status_code=401, detail="Inactive user")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def require_role(*roles):
    async def role_checker(user = Depends(get_current_user)):
        if user.role not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return role_checker

def require_department_access(user, resource_department_id):
    """Ensure user can only access their own department's resources"""
    if user.role == 'superadmin':
        return True
    if user.department_id != resource_department_id:
        raise HTTPException(status_code=403, detail="Access denied to this department's resources")
```

---

## 13. Containerization & Deployment

### 13.1 Docker Compose Structure

```yaml
# docker-compose.yml
version: '3.8'

services:
  # ─── Database ──────────────────────────────────
  postgres:
    image: pgvector/pgvector:pg15
    container_name: gicvmap-postgres
    environment:
      POSTGRES_DB: gicvmap
      POSTGRES_USER: gicvmap_admin
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U gicvmap_admin -d gicvmap"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ─── Cache / Message Queue ────────────────────
  redis:
    image: redis:7-alpine
    container_name: gicvmap-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ─── Object Storage ────────────────────────────
  minio:
    image: minio/minio:latest
    container_name: gicvmap-minio
    environment:
      MINIO_ROOT_USER: ${MINIO_ACCESS_KEY}
      MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY}
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data
    command: server /data --console-address ":9001"

  # ─── Stream Gateway ────────────────────────────
  mediamtx:
    image: bluenviron/mediamtx:latest
    container_name: gicvmap-mediamtx
    ports:
      - "8554:8554"   # RTSP
      - "8888:8888"   # HLS
      - "8889:8889"   # WebRTC
    volumes:
      - ./stream-gateway/mediamtx.yml:/mediamtx.yml

  # ─── Backend Services ──────────────────────────
  registry-service:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: gicvmap-registry
    environment:
      - SERVICE_NAME=registry
      - DATABASE_URL=postgresql+asyncpg://gicvmap_admin:${DB_PASSWORD}@postgres:5432/gicvmap
      - REDIS_URL=redis://redis:6379/0
    ports:
      - "8001:8000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  watchlist-service:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: gicvmap-watchlist
    environment:
      - SERVICE_NAME=watchlist
      - DATABASE_URL=postgresql+asyncpg://gicvmap_admin:${DB_PASSWORD}@postgres:5432/gicvmap
      - REDIS_URL=redis://redis:6379/0
    ports:
      - "8002:8000"
    depends_on:
      postgres:
        condition: service_healthy

  alert-service:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: gicvmap-alert
    environment:
      - SERVICE_NAME=alert
      - DATABASE_URL=postgresql+asyncpg://gicvmap_admin:${DB_PASSWORD}@postgres:5432/gicvmap
      - REDIS_URL=redis://redis:6379/0
    ports:
      - "8003:8000"
    depends_on:
      postgres:
        condition: service_healthy

  search-service:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: gicvmap-search
    environment:
      - SERVICE_NAME=search
      - DATABASE_URL=postgresql+asyncpg://gicvmap_admin:${DB_PASSWORD}@postgres:5432/gicvmap
    ports:
      - "8004:8000"
    depends_on:
      postgres:
        condition: service_healthy

  auth-service:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: gicvmap-auth
    environment:
      - SERVICE_NAME=auth
      - DATABASE_URL=postgresql+asyncpg://gicvmap_admin:${DB_PASSWORD}@postgres:5432/gicvmap
      - JWT_SECRET=${JWT_SECRET}
    ports:
      - "8005:8000"
    depends_on:
      postgres:
        condition: service_healthy

  # ─── AI Service ────────────────────────────────
  ai-service:
    build:
      context: ./backend/ai-service
      dockerfile: Dockerfile.gpu  # or Dockerfile.cpu
    container_name: gicvmap-ai
    environment:
      - REDIS_URL=redis://redis:6379/0
      - MINIO_ENDPOINT=minio:9000
      - MINIO_ACCESS_KEY=${MINIO_ACCESS_KEY}
      - MINIO_SECRET_KEY=${MINIO_SECRET_KEY}
    ports:
      - "8010:8000"
    volumes:
      - ./models:/app/models  # Mount model weights
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]

  # ─── Frontend ──────────────────────────────────
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: gicvmap-frontend
    ports:
      - "3000:80"

  # ─── Reverse Proxy ─────────────────────────────
  nginx:
    image: nginx:alpine
    container_name: gicvmap-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./docker/nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - frontend
      - registry-service
      - alert-service

volumes:
  postgres_data:
  redis_data:
  minio_data:
```

### 13.2 Dockerfile (Backend)

```dockerfile
# backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Run the appropriate service based on SERVICE_NAME env var
CMD ["sh", "-c", "uvicorn ${SERVICE_NAME:-registry}.main:app --host 0.0.0.0 --port 8000"]
```

### 13.3 Dockerfile (AI Service - GPU)

```dockerfile
# backend/ai-service/Dockerfile.gpu
FROM pytorch/pytorch:2.1.0-cuda12.1-cudnn8-runtime

WORKDIR /app

RUN apt-get update && apt-get install -y \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgl1-mesa-glx \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 13.4 NGINX Configuration

```nginx
# docker/nginx.conf
events {
    worker_connections 1024;
}

http {
    upstream frontend {
        server frontend:80;
    }

    upstream registry {
        server registry-service:8000;
    }

    upstream alert {
        server alert-service:8000;
    }

    upstream search {
        server search-service:8000;
    }

    upstream watchlist {
        server watchlist-service:8000;
    }

    upstream auth {
        server auth-service:8000;
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=30r/s;

    server {
        listen 80;
        server_name localhost;

        # Frontend
        location / {
            proxy_pass http://frontend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }

        # API Routes
        location /api/v1/cameras {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://registry;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }

        location /api/v1/watchlist {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://watchlist;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }

        location /api/v1/alerts {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://alert;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }

        location /api/v1/vehicle {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://search;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }

        location /api/v1/auth {
            proxy_pass http://auth;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }

        # WebSocket for alerts
        location /ws/alerts {
            proxy_pass http://alert;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_read_timeout 86400;
        }

        # MediaMTX endpoints
        location /streams/ {
            proxy_pass http://mediamtx:8888/;
            proxy_set_header Host $host;
        }
    }
}
```

---

## 14. Monitoring & Observability

### 14.1 Health Check Matrix

| Service | Health Endpoint | Check Method | Interval |
|---------|----------------|--------------|----------|
| PostgreSQL | pg_isready | TCP connection | 10s |
| Redis | redis-cli ping | TCP connection | 10s |
| MediaMTX | HTTP GET /v3/paths/list | HTTP 200 | 15s |
| Registry Service | HTTP GET /health | HTTP 200 | 30s |
| AI Service | HTTP GET /health | HTTP 200 + GPU check | 30s |
| Alert Service | HTTP GET /health | HTTP 200 + WS check | 30s |

### 14.2 Logging Standards

```python
# Structured JSON logging for all services
import structlog

logger = structlog.get_logger()

# Detection event log
logger.info(
    "detection_created",
    camera_id=camera_id,
    detection_type="vehicle",
    plate_number="GJ01AB1234",
    confidence=0.87,
    processing_time_ms=145
)

# Alert event log
logger.warning(
    "watchlist_match_detected",
    alert_id=5521,
    watchlist_id=42,
    plate_number="GJ01AB1234",
    severity="high",
    camera_id=camera_id
)
```

### 14.3 Metrics to Track

| Metric | Type | Labels | Purpose |
|--------|------|--------|---------|
| `detections_total` | Counter | camera_id, detection_type, class | Total detections per camera/type |
| `detection_confidence` | Histogram | detection_type, class | Confidence distribution |
| `processing_time_ms` | Histogram | service, model_version | AI inference latency |
| `alerts_total` | Counter | severity, match_type | Total alerts by severity |
| `alert_latency_ms` | Histogram | — | Detection-to-alert latency |
| `stream_active` | Gauge | camera_id | Active streams count |
| `stream_errors_total` | Counter | camera_id, error_type | Stream connection failures |
| `camera_health_status` | Gauge | camera_id, status | Camera online/offline |

---

## 15. Performance Engineering

### 15.1 Performance Budgets

| Operation | Target | Measurement |
|-----------|--------|-------------|
| Dashboard initial load | <3s | Lighthouse |
| Map render (50 markers) | <1s | Chrome DevTools |
| Vehicle search query | <2s | API response time |
| Detection-to-alert push | <5s | End-to-end |
| AI inference per frame | <200ms | Processing time |
| WebSocket message delivery | <500ms | Network latency |

### 15.2 Database Optimization

```sql
-- Query optimization for vehicle route reconstruction
-- Before: Full table scan
SELECT * FROM detections WHERE plate_number = 'GJ01AB1234' ORDER BY detected_at;

-- After: Indexed lookup
CREATE INDEX CONCURRENTLY idx_detections_plate_time_opt
ON detections(plate_number, detected_at ASC)
WHERE plate_number IS NOT NULL;

-- Materialized view for camera status dashboard
CREATE MATERIALIZED VIEW camera_status_summary AS
SELECT
    c.id,
    c.name,
    c.department_id,
    c.status,
    c.lat,
    c.lng,
    COUNT(d.id) as total_detections_today,
    MAX(d.detected_at) as last_detection_at
FROM cameras c
LEFT JOIN detections d ON c.id = d.camera_id
    AND d.detected_at >= CURRENT_DATE
GROUP BY c.id, c.name, c.department_id, c.status, c.lat, c.lng;

-- Refresh periodically
REFRESH MATERIALIZED VIEW CONCURRENTLY camera_status_summary;
```

### 15.3 Caching Strategy

| Data | Cache Duration | Store | Invalidation |
|------|---------------|-------|-------------|
| Camera list (all) | 60s | Redis | On camera CRUD |
| Camera status | 30s | Redis | On health check update |
| Department list | 300s | Redis | On department CRUD |
| Active watchlist | 60s | Redis | On watchlist CRUD |
| Route calculation | 300s | Redis | On new detection for that plate |
| Dashboard stats | 60s | Redis | On detection/alert events |

---

## 16. Error Handling & Resilience

### 16.1 Error Response Standards

```python
from fastapi import HTTPException
from pydantic import BaseModel

class ErrorResponse(BaseModel):
    error: dict

# Standard error codes
class ErrorCode:
    CAMERA_NOT_FOUND = "CAMERA_NOT_FOUND"
    CAMERA_ALREADY_EXISTS = "CAMERA_ALREADY_EXISTS"
    INVALID_RTSP_URL = "INVALID_RTSP_URL"
    STREAM_CONNECTION_FAILED = "STREAM_CONNECTION_FAILED"
    WATCHLIST_ENTRY_EXISTS = "WATCHLIST_ENTRY_EXISTS"
    DETECTION_NOT_FOUND = "DETECTION_NOT_FOUND"
    ALERT_NOT_FOUND = "ALERT_NOT_FOUND"
    UNAUTHORIZED = "UNAUTHORIZED"
    FORBIDDEN = "FORBIDDEN"
    INVALID_CSV_FORMAT = "INVALID_CSV_FORMAT"
    AI_MODEL_LOAD_FAILED = "AI_MODEL_LOAD_FAILED"
```

### 16.2 Circuit Breaker Pattern (AI Service)

```python
from circuitbreaker import circuit

@circuit(failure_threshold=5, recovery_timeout=30)
async def run_ai_inference(frame, camera_id):
    """AI inference with circuit breaker for resilience"""
    # If AI service is down, skip inference and log
    response = await ai_client.post("/api/v1/infer", files={"frame": frame})
    return response.json()
```

### 16.3 Retry Policy

| Operation | Max Retries | Backoff | Timeout |
|-----------|-------------|---------|---------|
| RTSP reconnection | ∞ | Exponential (5s, 10s, 30s, 60s) | — |
| Database query | 3 | Linear (1s) | 10s |
| AI inference | 2 | Linear (2s) | 30s |
| Alert push (WebSocket) | 5 | Exponential (1s, 2s, 4s) | 5s |
| MinIO upload | 3 | Linear (1s) | 15s |

---

## 17. Development Environment Setup

### 17.1 Prerequisites

```bash
# Required software
Docker Desktop 4.x          # Container runtime
Docker Compose V2           # Multi-container orchestration
Python 3.11+                # Backend services
Node.js 20+                 # Frontend build
FFmpeg 6.x                  # Video processing
Git 2.x                     # Version control

# Optional (for GPU support)
NVIDIA Docker Runtime       # GPU access in containers
CUDA 12.x                   # GPU compute
cuDNN 8.x                   # GPU deep learning
```

### 17.2 Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/your-team/gujarat-cctv-platform.git
cd gujarat-cctv-platform

# 2. Create environment file
cp .env.example .env
# Edit .env with your settings

# 3. Start all services
docker compose up -d

# 4. Initialize database
docker compose exec postgres psql -U gicvmap_admin -d gicvmap -f /docker-entrypoint-initdb.d/init.sql

# 5. Seed demo data
python scripts/seed_demo_data.py

# 6. Access the dashboard
open http://localhost
# Login: admin / admin123

# 7. Start simulated camera feeds
ffmpeg -re -stream_loop -1 -i sample_traffic_1.mp4 -c copy -f rtsp rtsp://localhost:8554/cam1 &
ffmpeg -re -stream_loop -1 -i sample_traffic_2.mp4 -c copy -f rtsp rtsp://localhost:8554/cam2 &
ffmpeg -re -stream_loop -1 -i sample_traffic_3.mp4 -c copy -f rtsp rtsp://localhost:8554/cam3 &
```

### 17.3 Environment Variables

```bash
# .env.example

# ─── Database ─────────────────────────────────
DATABASE_URL=postgresql+asyncpg://gicvmap_admin:your_password@postgres:5432/gicvmap
DB_PASSWORD=your_password

# ─── Redis ────────────────────────────────────
REDIS_URL=redis://redis:6379/0

# ─── Auth ─────────────────────────────────────
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_ALGORITHM=HS256
JWT_EXPIRY_MINUTES=60

# ─── MinIO ────────────────────────────────────
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=detections

# ─── AI Service ───────────────────────────────
AI_MODEL_PATH=/app/models
AI_DEVICE=cpu  # or cuda:0
AI_FPS_DEFAULT=2
AI_CONFIDENCE_THRESHOLD=0.5

# ─── MediaMTX ─────────────────────────────────
MEDIAMTX_RTSP_PORT=8554
MEDIAMTX_HLS_PORT=8888
MEDIAMTX_WEBRTC_PORT=8889

# ─── Frontend ─────────────────────────────────
REACT_APP_API_URL=http://localhost/api/v1
REACT_APP_WS_URL=ws://localhost/ws/alerts
```

---

## 18. Coding Standards & Conventions

### 18.1 Python (Backend)

- **Formatter**: Black (line length 88)
- **Linter**: Ruff
- **Type hints**: Required for all function signatures
- **Async**: Use async/await for all I/O operations
- **Naming**: snake_case for functions/variables, PascalCase for classes
- **Docstrings**: Google style for all public functions
- **Error handling**: Use structured error responses, never bare except

### 18.2 TypeScript (Frontend)

- **Formatter**: Prettier
- **Linter**: ESLint
- **Type safety**: Strict mode, no `any` types
- **Components**: Functional components with hooks
- **State management**: Zustand for global state
- **Naming**: PascalCase for components, camelCase for functions/variables

### 18.3 Git Workflow

```
main          ← Production-ready code
  └── develop ← Integration branch
       ├── feature/camera-registry
       ├── feature/ai-pipeline
       ├── feature/alert-engine
       └── feature/frontend-dashboard
```

---

## 19. Testing Technical Requirements

### 19.1 Test Frameworks

| Layer | Framework | Coverage Target |
|-------|-----------|----------------|
| Python Unit Tests | pytest + pytest-asyncio | 80% |
| Python Integration Tests | pytest + httpx | Key flows |
| Frontend Unit Tests | Vitest + React Testing Library | 70% |
| E2E Tests | Playwright | Critical paths |
| API Tests | httpx + pytest | All endpoints |

### 19.2 Test Structure

```
backend/
├── tests/
│   ├── unit/
│   │   ├── test_plate_normalizer.py
│   │   ├── test_watchlist_matcher.py
│   │   └── test_alert_engine.py
│   ├── integration/
│   │   ├── test_camera_crud.py
│   │   ├── test_detection_pipeline.py
│   │   └── test_alert_websocket.py
│   └── conftest.py

frontend/
├── src/
│   └── __tests__/
│       ├── components/
│       │   ├── CameraMarker.test.tsx
│       │   └── AlertCard.test.tsx
│       └── services/
│           └── api.test.ts
```

---

## 20. Security Implementation Details

### 20.1 Data Encryption

```python
# Password hashing
from passlib.context import CryptContext
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

hashed = pwd_context.hash("admin123")
verified = pwd_context.verify("admin123", hashed)
```

### 20.2 RTSP Credential Security

```python
# Store camera credentials encrypted
from cryptography.fernet import Fernet

cipher = Fernet(ENCRYPTION_KEY)
encrypted_password = cipher.encrypt(b"camera_password")
decrypted_password = cipher.decrypt(encrypted_password).decode()
```

### 20.3 API Security Headers

```nginx
# NGINX security headers
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'" always;
```

---

*End of TRD — Version 1.0*
*This document should be updated as implementation decisions are made during the hackathon build.*
