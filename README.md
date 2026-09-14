# GICVMAP — Gujarat Integrated CCTV Video Management & Analytics Platform

> **Gujarat Police Innovation Hackathon 2026** — A unified, scalable, AI-powered CCTV management and analytics platform for 26 government departments across Gujarat.

---

## What This Is

GICVMAP connects to Gujarat's **Sentinel Camera Grid** (30 live cameras across Ahmedabad), runs **real-time AI inference** (YOLOv8 object detection + EasyOCR license plate recognition), and pushes **CRITICAL alerts** to a web dashboard in under 1 second — all orchestrated as 13 Docker containers.

**Core capability:** Camera sees a stolen vehicle → AI reads the plate → system matches against watchlist → CRITICAL alert pops on every connected dashboard instantly.

---

## Architecture

```
Sentinel Camera Grid (30 cameras, RTSP)
        |
        v
MediaMTX (RTSP relay + HLS gateway)
        |
        +---> AI Service (YOLOv8 + EasyOCR) ---> Redis Stream ---> Alert Worker
        |                                                        |
        v                                                        v
   HLS/WebRTC                                          PostgreSQL (detections + alerts)
        |                                                        |
        v                                                        v
   NGINX (SSL :443) <--- WebSocket push <------------------------+
        |
        v
   React Dashboard (17 components)
```

### 13 Docker Containers

| Container | Image | Port | Purpose |
|-----------|-------|------|---------|
| gicvmap-postgres | pgvector/pgvector:pg15 | 5432 | Database (PostGIS + pgvector) |
| gicvmap-redis | redis:7-alpine | 6379 | Event streaming + cache |
| gicvmap-minio | minio/minio:latest | 9000/9001 | S3 object storage |
| gicvmap-mediamtx | bluenviron/mediamtx:latest | 8554/8888/8889 | RTSP relay + HLS + WebRTC |
| gicvmap-registry | python:3.11-slim | 8001 | Camera registry (9 endpoints) |
| gicvmap-watchlist | python:3.11-slim | 8002 | Watchlist management (6 endpoints) |
| gicvmap-alert | python:3.11-slim | 8003 | Alerts + WebSocket (10 endpoints) |
| gicvmap-search | python:3.11-slim | 8004 | Vehicle search (12 endpoints) |
| gicvmap-auth | python:3.11-slim | 8005 | Auth + RBAC (15 endpoints) |
| gicvmap-ai | nvidia/cuda:12.4.1-base | 8010 | YOLOv8 + EasyOCR inference |
| gicvmap-demo-seeder | python:3.11-slim | — | Synthetic detection generator |
| gicvmap-frontend | node:20-alpine + nginx | 3000/80 | React SPA |
| gicvmap-nginx | nginx:alpine | 80/443 | Reverse proxy + SSL termination |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Tailwind CSS, Zustand, hls.js, Leaflet.js |
| Backend | Python 3.11, FastAPI (async), SQLAlchemy + asyncpg, Pydantic v2 |
| Database | PostgreSQL 15 with PostGIS (spatial), pgvector, uuid-ossp, pg_trgm |
| Cache/Queue | Redis 7 (append-only, LRU eviction, Streams, pub/sub) |
| AI/ML | YOLOv8 nano (object detection), EasyOCR (license plate recognition), OpenCV |
| Streaming | MediaMTX (RTSP relay, HLS fmp4, WebRTC) |
| Storage | MinIO (S3-compatible) |
| Proxy | NGINX (SSL termination, rate limiting, WebSocket proxy) |
| Auth | JWT (HS256, 60min access, 7-day refresh), bcrypt |
| Container | Docker Compose, multi-stage builds |

---

## Quick Start

### Prerequisites
- Docker Desktop 4.x (with Docker Compose V2)
- 8GB+ RAM (AI service uses 2.3GB)
- Sentinel Camera Grid access (for live feeds) — or use demo-seeder for synthetic data

### 1. Clone & Setup
```bash
git clone https://github.com/krishnagolwala/gicvmap.git
cd gicvmap

# Copy environment template
cp .env.example .env
```

### 2. Configure Sentinel Credentials (optional — for live camera feeds)
Edit `.env` and set your Sentinel Camera Grid credentials:
```
SENTINEL_USER=your-email%40gmail.com
SENTINEL_PASS=your-access-password
```
Then copy and customize the MediaMTX config:
```bash
cp stream-gateway/mediamtx.example.yml stream-gateway/mediamtx.yml
# Replace YOUR_EMAIL_URLENCODED and YOUR_SENTINEL_PASSWORD in mediamtx.yml
```

### 3. Start All Services
```bash
docker compose up -d

# Verify all 13 containers are running
docker compose ps
```

### 4. Seed Demo Data
```bash
# Wait for postgres to be healthy, then seed:
docker compose exec postgres psql -U gicvmap_admin -d gicvmap -f /docker-entrypoint-initdb.d/01-init.sql

# Or run the Python seeder for additional demo data:
python scripts/seed_demo_data.py
```

### 5. Access Dashboard
```
URL:      https://localhost
Login:    admin / admin123
```

---

## Project Structure

```
gicvmap/
├── backend/                         # Python FastAPI microservices
│   ├── app.py                       # Shared FastAPI app entry point
│   ├── Dockerfile                   # Single Dockerfile for all services
│   ├── requirements.txt             # Python dependencies
│   ├── shared/                      # Common modules
│   │   ├── auth.py                  # JWT auth + UserContext
│   │   ├── config.py                # Environment config
│   │   ├── database.py              # SQLAlchemy async engine
│   │   ├── models.py                # Pydantic request/response models
│   │   ├── dept.py                  # Multi-department data isolation
│   │   ├── audit.py                 # Audit logging
│   │   └── errors.py                # Error handlers
│   ├── auth/router.py               # 15 endpoints: JWT, user CRUD, RBAC
│   ├── registry/router.py           # 9 endpoints: camera CRUD, bulk upload
│   ├── watchlist/router.py          # 6 endpoints: watchlist CRUD
│   ├── alert/router.py              # 10 endpoints: alerts, rules, WebSocket, CSV
│   ├── search/router.py             # 12 endpoints: vehicle search, trajectory, CSV
│   ├── integrations/router.py       # 10 endpoints: Sentinel status, health
│   ├── alert_worker.py              # Detection → watchlist match → alert pipeline
│   ├── demo_seeder.py               # Synthetic detection event generator
│   ├── check_sentinel.py            # Sentinel connectivity checker
│   ├── ai-service/                  # Standalone AI inference service
│   │   ├── Dockerfile               # CUDA base + YOLO + EasyOCR
│   │   ├── main.py                  # 691 lines: 30 stream processors, YOLO, OCR
│   │   └── requirements-gpu.txt     # GPU dependencies
│   └── tests/                       # Unit tests
│       ├── unit/test_alert_engine.py
│       ├── unit/test_plate_normalizer.py
│       └── unit/test_watchlist_matcher.py
├── frontend/                        # React SPA
│   ├── Dockerfile                   # Multi-stage: node build + nginx serve
│   ├── src/
│   │   ├── components/              # 17 UI components
│   │   │   ├── LoginPage.tsx        # JWT auth with role display
│   │   │   ├── Dashboard.tsx        # 10+ tab dashboard
│   │   │   ├── VideoWall.tsx        # 30-camera HLS grid (hls.js)
│   │   │   ├── VehicleSearch.tsx    # Plate search + Leaflet route map
│   │   │   ├── AlertPanel.tsx       # Real-time alert list
│   │   │   ├── AlertToast.tsx       # Toast notifications
│   │   │   ├── CameraMap.tsx        # Leaflet GIS map (30 cameras)
│   │   │   ├── CameraManagement.tsx # Camera CRUD
│   │   │   ├── WatchlistManagement.tsx # Stolen vehicles + wanted persons
│   │   │   ├── AlertRules.tsx       # Configurable trigger rules
│   │   │   ├── Reports.tsx          # Detection statistics + charts
│   │   │   ├── UserManagement.tsx   # User CRUD + 13-permission matrix
│   │   │   ├── AuditLog.tsx         # Full audit trail
│   │   │   ├── AIStatusPanel.tsx    # AI inference status
│   │   │   ├── IntegrationsPanel.tsx # Sentinel integration status
│   │   │   ├── Sidebar.tsx          # Role-based navigation
│   │   │   └── LazyVideoPlayer.tsx  # HLS + WebRTC with auto-reconnect
│   │   ├── services/api.ts          # API client (62 endpoints)
│   │   ├── hooks/useAlertWebSocket.ts # WebSocket hook
│   │   └── store/auth.ts            # Zustand auth state
│   └── vite.config.ts               # Vite + PostCSS (inlined)
├── database/
│   ├── init.sql                     # DDL + seed data (13 tables)
│   ├── migration_granular_access.sql # RBAC tables + demo users
│   ├── sentinel_cameras.sql         # 30 Sentinel cameras (cam01-cam30)
│   └── seed_alert_rules.sql         # 4 alert rules
├── stream-gateway/
│   ├── mediamtx.example.yml         # Template (safe to commit)
│   └── mediamtx.yml                 # Real config with credentials (gitignored)
├── docker/
│   ├── nginx.conf                   # SSL, routing, WebSocket, HLS proxy
│   ├── default.conf                 # Default server block
│   └── certs/                       # Self-signed SSL (gitignored)
├── docker-compose.yml               # 13-service orchestration
├── .env.example                     # Environment template
├── .gitignore                       # Excludes: .env, mediamtx.yml, certs, node_modules
├── models/                          # AI weights (downloaded at build)
├── scripts/
│   ├── seed_demo_data.py            # Python demo data seeder
│   └── seed_detections_alerts.sql   # SQL seed data
├── docs/
│   ├── PRD.md                       # Product Requirements Document
│   ├── TRD.md                       # Technical Requirements Document
│   ├── HLD.md                       # High-Level Design
│   ├── SCHEMA.md                    # Database schema reference
│   ├── SPECIFICATION.md             # API specification
│   ├── PIPELINE.md                  # AI/ML pipeline design
│   ├── SECURITY.md                  # Security architecture
│   ├── SCALABILITY.md               # Scalability plan
│   ├── FRONTEND.md                  # Frontend design
│   ├── TESTING.md                   # Test strategy
│   ├── LOAD_TEST_REPORT.md          # Load testing results
│   ├── DISASTER_RECOVERY.md         # Disaster recovery plan
│   ├── VIDEO_OUTPUT_REPORT.md       # Video output analysis
│   └── presentation/                # Hackathon presentation materials
│       ├── GICVMAP-Presentation.pdf
│       ├── GICVMAP_Hackathon2026.pptx
│       ├── architecture-diagram.svg
│       └── workflow-diagram.svg
└── README.md                        # This file
```

---

## Features

### 1. Camera Registry
- 30 Sentinel cameras in database (cam01-cam30 across Ahmedabad)
- PostGIS spatial queries for GIS-based camera mapping
- Bulk CSV import for rapid onboarding
- Camera health monitoring and status tracking
- Department-scoped access control (25 Police + 5 Municipal Corp)

### 2. Unified Video Viewing
- 30-camera HLS grid with hls.js (batch loading, auto-reconnect)
- WebRTC low-latency preview for single-camera expansion
- MediaMTX RTSP relay with on-demand streaming
- Sentinel Camera Grid integration (RTSP/HLS/WebRTC protocols)
- Resilient reconnection with exponential backoff (2s to 30s cap)

### 3. AI Video Analytics
- **YOLOv8 nano** — detects persons, cars, motorcycles, buses, trucks (CPU)
- **EasyOCR** — reads Indian license plates (pre-baked models: craft_mlt_25k + english_g2)
- 30 concurrent stream processors (2 FPS per camera)
- Max 4 simultaneous inferences (semaphore)
- Confidence threshold: 0.5 (configurable)
- 10,340+ detection events processed in live run

### 4. Detection-to-Alert Pipeline
```
Frame capture (0ms)
  → MediaMTX relay (~50ms)
  → YOLO + OCR processing (~500ms)
  → Redis Stream publish (~550ms)
  → Alert Worker consume + watchlist match (~650ms)
  → PostgreSQL insert (~700ms)
  → WebSocket broadcast (~750ms)
  → Dashboard alert visible (~800ms)
Total: <1 second camera-to-dashboard
```

### 5. Vehicle Tracking
- Cross-camera route reconstruction via plate matching
- Timeline view with detection history
- Map-based route visualization with Leaflet
- CSV export for evidence documentation

### 6. Watchlist & Alerting
- 5 seeded watchlist entries (stolen vehicles, wanted persons)
- Real-time plate-to-watchlist matching
- Alert severity: CRITICAL (stolen/wanted), HIGH (priority), MEDIUM, LOW
- 1,758+ alerts auto-generated in live run
- Alert acknowledgment and status management

### 7. Role-Based Access Control (RBAC)
- **6 roles**: superadmin, dept_admin, operator, analyst, viewer, auditor
- **13 feature permissions**: view_live_feeds, playback_recording, search_vehicles, view_analytics, manage_alerts, acknowledge_alerts, export_data, view_reports, manage_cameras, manage_watchlist, manage_users, view_audit_logs, system_config
- **Multi-department access**: users can access multiple departments
- **Camera-level isolation**: granular per-camera permissions
- **5 demo users** pre-configured with different access levels

### 8. Security
- JWT authentication (HS256, 60min access, 7-day refresh)
- bcrypt password hashing
- SSL/TLS termination (self-signed for PoC)
- NGINX rate limiting (30 req/s API, burst 10-20)
- Security headers (HSTS, X-Frame-Options, X-Content-Type-Options)
- Comprehensive audit logging

---

## Database Schema (13 Tables)

| Table | Purpose | Key Fields |
|-------|---------|------------|
| departments | 10 government departments | id, name, code |
| users | 5 demo users + RBAC | id, username, role, department_id |
| cameras | 30 Sentinel cameras | id, name, lat, lng, status, analytics_config (JSONB) |
| camera_health_log | Health check history | camera_id, checked_at, status |
| detections | AI detection events | camera_id, detection_type, plate_number, bbox (JSONB) |
| watchlist | Stolen/wanted/missing | plate_number, type, priority, reason |
| alerts | Auto-generated alerts | severity, status, match_type, plate_number |
| alert_rules | Configurable trigger rules | rule_type, conditions (JSONB), severity |
| audit_log | User action audit trail | user_id, action, resource, details |
| system_config | 11 configuration entries | key, value, description |
| user_departments | Multi-department access | user_id, department_id |
| user_cameras | Camera-level access | user_id, camera_id |
| user_features | Feature permissions | user_id, feature |

---

## API Endpoints (62 Total)

### Auth Service (15 endpoints) — `/api/v1/auth/`
- `POST /login` — JWT login
- `POST /register` — Create user
- `POST /refresh` — Refresh token
- `GET /me` — Current user info
- `PUT /me/password` — Change password
- `GET /users` — List users (paginated)
- `GET /users/{id}` — User detail
- `POST /users` — Create user (admin)
- `PUT /users/{id}` — Update user
- `DELETE /users/{id}` — Delete user
- `GET /users/{id}/permissions` — Get user permissions
- `PUT /users/{id}/permissions` — Update user permissions
- `GET /roles` — List roles
- `GET /features` — List available features
- `GET /audit` — Audit log

### Registry Service (9 endpoints) — `/api/v1/cameras`
- `GET /` — List cameras (paginated, filterable)
- `GET /{id}` — Camera detail
- `POST /` — Create camera
- `PUT /{id}` — Update camera
- `DELETE /{id}` — Delete camera
- `POST /bulk` — Bulk CSV import
- `GET /health` — Camera health status
- `PUT /{id}/status` — Update camera status
- `GET /stats` — Camera statistics

### Watchlist Service (6 endpoints) — `/api/v1/watchlist`
- `GET /` — List watchlist (paginated)
- `GET /{id}` — Watchlist detail
- `POST /` — Create entry
- `PUT /{id}` — Update entry
- `DELETE /{id}` — Delete entry
- `GET /search` — Search by plate number

### Alert Service (10 endpoints) — `/api/v1/alerts`
- `GET /` — List alerts (paginated, filterable)
- `GET /{id}` — Alert detail
- `PUT /{id}/acknowledge` — Acknowledge alert
- `PUT /{id}/dismiss` — Dismiss alert
- `DELETE /{id}` — Delete alert
- `GET /rules` — List alert rules
- `POST /rules` — Create alert rule
- `DELETE /rules/{id}` — Delete alert rule
- `GET /export` — CSV export
- `WS /ws` — WebSocket for real-time alerts

### Search Service (12 endpoints) — `/api/v1/vehicles`
- `GET /search` — Vehicle plate search
- `GET /{plate}/timeline` — Detection timeline
- `GET /{plate}/route` — Route reconstruction
- `GET /{plate}/stats` — Vehicle statistics
- `GET /stats/overview` — System overview
- `GET /stats/detections` — Detection statistics
- `GET /stats/alerts` — Alert statistics
- `GET /stats/cameras` — Per-camera stats
- `GET /reports/daily` — Daily report
- `GET /reports/export` — CSV export
- `GET /integrations/sentinel` — Sentinel status
- `GET /integrations/streams` — Stream health

---

## Sentinel Camera Grid Integration

### Camera Details
- **30 cameras** (cam01-cam30) across Ahmedabad
- **Location zones**: Central, Western, Eastern, North Ahmedabad
- **Department split**: 25 Police (dept 1), 5 Municipal Corp (dept 2 — cam04, cam07, cam08, cam09, cam10)
- **All 1080p H.264, 25fps native**

### Supported Protocols
- **RTSP**: `rtsp://email:password@103.250.160.189:8554/stream/<id>` (TCP mandatory)
- **HLS**: `https://cctv.corp8.cloud/<id>/index.m3u8` (CDN, password-protected)
- **WebRTC/WHEP**: `http://email:password@103.250.160.189:8889/stream/<id>/whep`

### Resilience
- Exponential backoff reconnection (2s to 30s cap)
- Per-camera stream isolation
- Graceful H.264/H.265 mix handling
- PTS-based timing (never CAP_PROP_FPS)
- Inter-frame gap tolerance
- On-demand streaming (sourceOnDemand: yes)
- 5-minute keepalive after last viewer (sourceOnDemandCloseAfter: 300s)

---

## Watchlist Entries (5 Seeded)

| Plate | Type | Priority | Reason |
|-------|------|----------|--------|
| GJ01AB1234 | stolen_vehicle | high | Stolen white Swift Dzire, FIR #2026/4521 |
| GJ05CD5678 | suspect_vehicle | high | Suspect vehicle in robbery case, FIR #2026/3892 |
| GJ27EF9012 | vehicle | medium | Blacklisted for unpaid toll violations |
| GJ03GH3456 | missing_person | high | Missing person vehicle, last seen 2026-08-25 |
| — | wanted_person | critical | Extortion case (no plate) |

---

## Demo Users

| Username | Password | Role | Access |
|----------|----------|------|--------|
| admin | admin123 | superadmin | Full system access, all features |
| muni_operator | admin123 | operator | Municipal Corp cameras (cam04,07,08,09,10) |
| rto_analyst | admin123 | analyst | RTO + Police, 6 features |
| police_viewer | admin123 | viewer | Police cameras, view_live_feeds only |
| state_auditor | admin123 | auditor | All departments, 3 features (audit, reports, export) |

---

## Verified Metrics (Live Run)

| Metric | Value |
|--------|-------|
| Detection events in Redis | 10,340+ |
| Alerts auto-generated | 1,758+ |
| Cameras connected to AI | 26/30 |
| OCR confirmed readings | GJ27EF9012 (0.82 confidence) |
| Watchlist matches | CRITICAL alerts for stolen plates |
| Camera-to-dashboard latency | <1 second |
| Total containers | 13 |
| Total API endpoints | 62 |
| Total frontend components | 17 |
| Total database tables | 13 |

---

## Development

### Running Locally (without Docker)
```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate  # or .\venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn app:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev
```

### Running Tests
```bash
# Backend unit tests
cd backend
pytest tests/unit/ -v

# Frontend
cd frontend
npm test
```

---

## Documentation

| Document | File | Description |
|----------|------|-------------|
| Product Requirements | `docs/PRD.md` | Full PRD |
| Technical Requirements | `docs/TRD.md` | Technical specs |
| High-Level Design | `docs/HLD.md` | Architecture design |
| Database Schema | `docs/SCHEMA.md` | DDL + ER diagrams |
| API Specification | `docs/SPECIFICATION.md` | REST API reference |
| AI/ML Pipeline | `docs/PIPELINE.md` | Analytics pipeline |
| Security | `docs/SECURITY.md` | Security architecture |
| Scalability | `docs/SCALABILITY.md` | Scaling strategy |
| Frontend Design | `docs/FRONTEND.md` | UI/UX spec |
| Testing | `docs/TESTING.md` | Test strategy |
| Load Test Report | `docs/LOAD_TEST_REPORT.md` | Performance results |
| Disaster Recovery | `docs/DISASTER_RECOVERY.md` | Recovery plan |

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_PASSWORD` | gicvmap_secret_2026 | PostgreSQL password |
| `REDIS_PORT` | 6379 | Redis port |
| `MINIO_ACCESS_KEY` | minioadmin | MinIO access key |
| `MINIO_SECRET_KEY` | minioadmin | MinIO secret key |
| `JWT_SECRET` | gicvmap-jwt-secret-key-2026... | JWT signing key |
| `SENTINEL_USER` | — | Sentinel Camera Grid email (URL-encoded) |
| `SENTINEL_PASS` | — | Sentinel Camera Grid password |
| `AI_DEVICE` | cpu | AI device (cpu or cuda:0) |
| `AI_FPS` | 2 | Frame sampling rate per camera |
| `AI_CONFIDENCE` | 0.5 | Detection confidence threshold |
| `ENCRYPTION_KEY` | — | Camera credential encryption key |

---

## Scalability Path

| Dimension | PoC (30 cameras) | District (500 cameras) | Statewide (80,000 cameras) |
|-----------|-----------------|----------------------|---------------------------|
| Ingestion | 1 MediaMTX | Edge nodes | Regional clusters |
| AI Compute | 1 CPU worker | GPU server | Triton clusters, auto-scaled |
| Database | Single PostgreSQL | Read replicas | Sharded PostgreSQL (Citus) |
| Message Bus | Redis Streams | Redis Cluster | Kafka multi-broker |
| Storage | MinIO single node | MinIO cluster | S3-compatible distributed |

---

## Hackathon Submission

- **Project**: GICVMAP — Gujarat Integrated CCTV Video Management & Analytics Platform
- **Hackathon**: Gujarat Police Innovation Hackathon 2026
- **Solution Model**: Hybrid / Innovative Architecture (Models 1, 2, 3, and 4)
- **GitHub**: https://github.com/krishnagolwala/gicvmap
- **Tech Stack**: 100% Open Source
- **Target**: 10 government departments, 80,000+ cameras statewide

---

## License

This project is built for the Gujarat Police Innovation Hackathon 2026.
