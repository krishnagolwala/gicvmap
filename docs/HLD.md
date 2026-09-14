# High-Level Design (HLD)
## GICVMAP — System Architecture Document

---

## 1. Architecture Overview

### 1.1 Design Principles

| Principle | Implementation |
|-----------|---------------|
| Microservice Independence | Each service owns its data; independent deployment and scaling |
| Event-Driven Decoupling | Kafka/Redis Streams for all analytics and alert flows |
| Adapter Pattern | Camera integration via protocol adapters; vendor-neutral |
| Config-Driven | FPS, thresholds, camera sources — all configurable |
| Fail-Safe Degradation | Single camera failure must not affect others |
| Open Source Only | All components use open-source technologies |

### 1.2 Architecture Style

**Hybrid: Model 1 (Registry & GIS) + Model 2 (Unified Viewing & Analytics)**

- **Model 1 Foundation**: Camera registry with PostGIS spatial database
- **Model 2 Implementation**: Direct RTSP/ONVIF ingestion with AI analytics
- **Model 3/4 Ready**: Architecture supports federation middleware and central VMS evolution

---

## 2. System Context Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          GICVMAP PLATFORM                                │
│                                                                         │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌──────────┐│
│  │  Camera   │ │    AI     │ │  Alert    │ │  Search   │ │  Auth    ││
│  │ Registry  │ │ Analytics │ │  Engine   │ │ & Track   │ │ Service  ││
│  └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └────┬─────┘│
│        │              │              │              │             │      │
│        └──────────────┴──────────────┴──────────────┴─────────────┘      │
│                              │                                          │
│                    ┌─────────▼──────────┐                               │
│                    │   React Dashboard   │                               │
│                    │  (GIS + Video Wall) │                               │
│                    └────────────────────┘                               │
└───────────────────────────┬─────────────────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            │               │               │
            ▼               ▼               ▼
   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
   │ CCTV Cameras │ │  Government  │ │   Citizens   │
   │ (RTSP/ONVIF) │ │  Databases   │ │  (Indirect)  │
   │              │ │ (Mock Data)  │ │              │
   └──────────────┘ └──────────────┘ └──────────────┘
```

---

## 3. Component Architecture

### 3.1 Service Registry

```
┌─────────────────────────────────────────────────────────────────┐
│                        SERVICE TOPOLOGY                          │
│                                                                  │
│  PRESENTATION TIER                                               │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ React SPA (Port 3000)                                    │   │
│  │ ├── GIS Map (Leaflet + PostGIS)                          │   │
│  │ ├── Video Wall (WebRTC/HLS Player)                       │   │
│  │ ├── Vehicle Search & Route Playback                      │   │
│  │ ├── Alert Console (Real-time WebSocket)                  │   │
│  │ ├── Camera Admin (CRUD + Bulk Import)                    │   │
│  │ └── Watchlist Admin (CRUD + Bulk Import)                 │   │
│  └──────────────────────────┬───────────────────────────────┘   │
│                              │                                    │
│  API GATEWAY TIER            │                                    │
│  ┌──────────────────────────▼───────────────────────────────┐   │
│  │ NGINX (Port 80/443)                                       │   │
│  │ ├── Reverse Proxy (service routing)                       │   │
│  │ ├── Rate Limiting (30 req/s per IP)                       │   │
│  │ ├── WebSocket Proxy (alert push)                          │   │
│  │ └── Static File Serving (frontend build)                  │   │
│  └──┬──────────┬──────────┬──────────┬──────────┬──────────┘   │
│     │          │          │          │          │                │
│  APPLICATION TIER                                              │
│  ┌────▼───┐ ┌──▼────┐ ┌──▼────┐ ┌──▼────┐ ┌──▼────┐         │
│  │Registry│ │Watch- │ │ Alert │ │Search │ │ Auth  │         │
│  │Service │ │list   │ │Service│ │Service│ │Service│         │
│  │  :8001 │ │ :8002 │ │ :8003 │ │ :8004 │ │ :8005 │         │
│  └────┬───┘ └──┬────┘ └──┬────┘ └──┬────┘ └──┬────┘         │
│       │        │         │         │         │                │
│  INFRASTRUCTURE TIER                                          │
│  ┌────▼────────▼─────────▼─────────▼─────────▼────────────┐  │
│  │ PostgreSQL + PostGIS (5432) │ Redis (6379) │ MinIO     │  │
│  │ pgvector extension          │ Cache+Streams │ (9000)    │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                                │
│  AI/ML TIER                                                   │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ AI Inference Service (:8010)                            │  │
│  │ ├── Frame Sampler (OpenCV)                              │  │
│  │ ├── YOLOv8 Detector (PyTorch)                           │  │
│  │ ├── ANPR Engine (EasyOCR)                             │  │
│  │ └── Face Recognition (InsightFace, optional)            │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                                │
│  STREAMING TIER                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ MediaMTX Stream Gateway (:8554)                         │  │
│  │ ├── RTSP Input (camera feeds)                           │  │
│  │ ├── WebRTC Output (browser playback)                    │  │
│  │ └── HLS Output (fallback)                               │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                                │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Service Specifications

| Service | Port | Language | Framework | Database | Responsibility |
|---------|------|----------|-----------|----------|---------------|
| registry-service | 8001 | Python | FastAPI | PostgreSQL | Camera CRUD, GIS metadata |
| watchlist-service | 8002 | Python | FastAPI | PostgreSQL | Watchlist CRUD, matching |
| alert-service | 8003 | Python | FastAPI | PostgreSQL | Alert CRUD, WebSocket push |
| search-service | 8004 | Python | FastAPI | PostgreSQL | Vehicle history, route |
| auth-service | 8005 | Python | FastAPI | PostgreSQL | JWT auth, RBAC |
| ai-service | 8010 | Python | FastAPI | None | YOLOv8, ANPR, face |
| frame-sampler | 8011 | Python | Script | None | OpenCV frame extraction |
| stream-gateway | 8554 | Binary | MediaMTX | None | RTSP→WebRTC/HLS |
| frontend | 3000 | JS/TS | React | None | SPA dashboard |
| nginx | 80/443 | Config | NGINX | None | Reverse proxy |
| postgres | 5432 | Binary | PostgreSQL | — | Primary database |
| redis | 6379 | Binary | Redis | — | Cache, streams |
| minio | 9000 | Binary | MinIO | — | Object storage |

---

## 4. Data Flow Diagrams

### 4.1 Detection Event Lifecycle

```
                    ┌──────────┐
                    │  Camera  │
                    │ (RTSP)   │
                    └────┬─────┘
                         │ H.264 stream
                         ▼
                    ┌──────────┐
                    │MediaMTX  │
                    │(Gateway) │
                    └──┬───┬──┘
                       │   │
          ┌────────────┘   └────────────┐
          ▼                             ▼
   ┌──────────┐                 ┌──────────────┐
   │Dashboard │                 │Frame Sampler │
   │(WebRTC)  │                 │(OpenCV @2fps)│
   └──────────┘                 └──────┬───────┘
                                       │ JPEG frame
                                       ▼
                                ┌──────────────┐
                                │ AI Inference  │
                                │ Service       │
                                │               │
                                │ YOLOv8 → bbox │
                                │ Plate → OCR   │
                                │ Normalize     │
                                └──────┬───────┘
                                       │ DetectionEvent JSON
                                       ▼
                                ┌──────────────┐
                                │ Event Bus     │
                                │ (Redis/Kafka) │
                                └──┬─────┬──┬──┘
                                   │     │  │
                    ┌──────────────┘     │  └──────────────┐
                    ▼                    ▼                   ▼
             ┌────────────┐    ┌──────────────┐    ┌──────────────┐
             │ Detection  │    │  Watchlist   │    │  Analytics   │
             │ Store      │    │  Matcher     │    │  Aggregator  │
             │ (Postgres) │    │              │    │  (Future)    │
             └────────────┘    └──────┬───────┘    └──────────────┘
                                      │
                              Match found?
                              ┌────┴────┐
                              │  YES    │  NO
                              ▼         ▼
                       ┌────────────┐  (discard)
                       │ Alert      │
                       │ Engine     │
                       └──────┬─────┘
                              │ AlertEvent JSON
                              ▼
                       ┌────────────┐
                       │ WebSocket  │
                       │ Notifier   │
                       └──────┬─────┘
                              │ Push notification
                              ▼
                       ┌────────────┐
                       │ Dashboard  │
                       │ Alert Card │
                       │ + Sound    │
                       └────────────┘
```

### 4.2 Vehicle Search & Route Reconstruction Flow

```
┌──────────────┐
│   Officer    │
│ searches     │
│ "GJ01AB1234" │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Dashboard   │
│  Vehicle     │
│  Search Page │
└──────┬───────┘
       │ GET /api/v1/vehicle/GJ01AB1234/route
       ▼
┌──────────────┐
│Search Service│
│              │
│ 1. Query     │
│ detections   │
│ WHERE        │
│ plate_normalized = 'GJ01AB1234'│
│ ORDER BY     │
│ detected_at  │
│              │
│ 2. JOIN with │
│ cameras for  │
│ lat/lng      │
│              │
│ 3. Calculate │
│ distances    │
│ and speeds   │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Response:    │
│              │
│ GeoJSON      │
│ LineString   │
│ + Waypoints  │
│ + Metadata   │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Dashboard   │
│              │
│ Render:      │
│ 1. Polyline  │
│    on map    │
│ 2. Numbered  │
│    markers   │
│ 3. Snapshot  │
│    thumbnails│
│ 4. Timeline  │
│    table     │
└──────────────┘
```

### 4.3 Watchlist Match & Real-Time Alert Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  AI Service  │────▶│  Event Bus   │────▶│  Watchlist   │
│  detects     │     │  detections  │     │  Matcher     │
│  GJ01AB1234  │     │  topic       │     │              │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                  │
                                          Match found!
                                                  │
                                                  ▼
                          ┌──────────────────────────────────────┐
                          │ Watchlist Matcher Logic               │
                          │                                      │
                          │ SELECT * FROM watchlist               │
                          │ WHERE type = 'vehicle'               │
                          │   AND plate_normalized = 'GJ01AB1234'│
                          │   AND is_active = true;               │
                          │                                      │
                          │ Result: Found! (stolen_vehicle)      │
                          └──────────────┬───────────────────────┘
                                         │
                                         ▼
                          ┌──────────────────────────────────────┐
                          │ Create Alert Record                   │
                          │                                      │
                          │ INSERT INTO alerts                    │
                          │ (watchlist_id, detection_id,          │
                          │  camera_id, severity, match_type,    │
                          │  plate_number, ...)                   │
                          └──────────────┬───────────────────────┘
                                         │
                                         ▼
                          ┌──────────────────────────────────────┐
                          │ Publish to "alerts" stream            │
                          └──────────────┬───────────────────────┘
                                         │
                                         ▼
                          ┌──────────────────────────────────────┐
                          │ Alert Service (WebSocket)             │
                          │                                      │
                          │ sio.emit('alert.new', alert_data,    │
                          │          room='all_users')            │
                          └──────────────┬───────────────────────┘
                                         │
                                         ▼
                          ┌──────────────────────────────────────┐
                          │ Dashboard                             │
                          │                                      │
                          │ 🔔 CRITICAL ALERT                     │
                          │ "Stolen Vehicle GJ01AB1234 detected" │
                          │ Camera: Ring Road Junction Cam 3     │
                          │ Time: 2026-09-10 14:32:07            │
                          │ [View] [Acknowledge] [Dismiss]       │
                          │ 🔊 *alert sound plays*               │
                          └──────────────────────────────────────┘
```

---

## 5. Technology Stack

### 5.1 Complete Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Frontend** | React.js | 18.x | SPA dashboard |
| | Tailwind CSS | 3.x | UI styling |
| | Leaflet | 1.9.x | GIS mapping |
| | react-leaflet | 4.x | React Leaflet bindings |
| | Socket.IO Client | 4.x | Real-time alerts |
| | Axios | 1.x | HTTP client |
| | React Router | 6.x | Client routing |
| | Zustand | 4.x | State management |
| **Backend** | Python | 3.11+ | All backend services |
| | FastAPI | 0.104+ | REST API framework |
| | SQLAlchemy | 2.x | ORM |
| | Alembic | latest | DB migrations |
| | Pydantic | 2.x | Data validation |
| | Uvicorn | latest | ASGI server |
| **AI/ML** | PyTorch | 2.x | Deep learning |
| | Ultralytics YOLOv8 | 8.x | Object detection |
| | EasyOCR | 2.x | ANPR OCR |
| | OpenCV | 4.x | Frame capture |
| | InsightFace | 0.7.x | Face recognition |
| | NumPy | latest | Numerical ops |
| | Pillow | latest | Image I/O |
| **Database** | PostgreSQL | 15+ | Primary DB |
| | PostGIS | 3.x | Spatial queries |
| | pgvector | 0.5+ | Vector similarity |
| **Cache/MQ** | Redis | 7.x | Cache, streams, sessions |
| **Streaming** | MediaMTX | latest | RTSP→WebRTC/HLS |
| | FFmpeg | 6.x | Video processing |
| **Storage** | MinIO | latest | S3-compatible snapshots |
| **Proxy** | NGINX | 1.25+ | Reverse proxy |
| **Container** | Docker | 24.x | Containerization |
| | Docker Compose | 2.x | Orchestration |

---

## 6. Deployment Architecture

### 6.1 PoC Deployment (Docker Compose)

```
┌─────────────────────────────────────────────────┐
│              SINGLE HOST (Dev Machine/VM)         │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │           Docker Compose Stack               │ │
│  │                                              │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  │ │
│  │  │ Frontend │  │ NGINX    │  │ MediaMTX │  │ │
│  │  │ :3000    │  │ :80      │  │ :8554    │  │ │
│  │  └──────────┘  └──────────┘  └──────────┘  │ │
│  │                                              │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  │ │
│  │  │ Registry │  │ Watchlist│  │  Alert   │  │ │
│  │  │ :8001    │  │ :8002    │  │  :8003   │  │ │
│  │  └──────────┘  └──────────┘  └──────────┘  │ │
│  │                                              │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  │ │
│  │  │ Search   │  │ Auth     │  │ AI Svc   │  │ │
│  │  │ :8004    │  │ :8005    │  │ :8010    │  │ │
│  │  └──────────┘  └──────────┘  └──────────┘  │ │
│  │                                              │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  │ │
│  │  │ Postgres │  │ Redis    │  │  MinIO   │  │ │
│  │  │ :5432    │  │ :6379    │  │  :9000   │  │ │
│  │  └──────────┘  └──────────┘  └──────────┘  │ │
│  │                                              │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  Hardware: 8+ vCPU, 16-32GB RAM, Optional GPU    │
└─────────────────────────────────────────────────┘
```

**As-built (September 2026):** the PoC runs 13 containers (above + a demo-data seeder that feeds the same event pipeline) on a Windows host with WSL2 (4.8 GiB VM) and an **NVIDIA RTX 2050 (CUDA)** serving YOLOv8 inference. Live inputs are 8 government **Sentinel Camera Grid** RTSP feeds (mixed H.264/H.265, TCP, authenticated) relayed through MediaMTX; every service carries `restart: unless-stopped` and a bounded memory limit so the stack self-heals. See `LOAD_TEST_REPORT.md` and `DISASTER_RECOVERY.md` for measured numbers and the 80,000-camera model.

### 6.2 Production Deployment (Kubernetes — Documented)

```
┌─────────────────────────────────────────────────────────────┐
│                    KUBERNETES CLUSTER                         │
│                                                               │
│  ┌─────────────────────┐  ┌─────────────────────┐           │
│  │    Ingress (NGINX)   │  │    Cert Manager      │           │
│  └──────────┬──────────┘  └─────────────────────┘           │
│             │                                                 │
│  ┌──────────▼──────────────────────────────────────────┐    │
│  │                  Application Namespace                │    │
│  │                                                      │    │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │    │
│  │  │Registry │ │Watchlist│ │ Alert   │ │ Search  │  │    │
│  │  │ (3 repl)│ │(2 repl) │ │(3 repl) │ │(2 repl) │  │    │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘  │    │
│  │                                                      │    │
│  │  ┌─────────────────────────────────────────────┐    │    │
│  │  │ AI Workers (HPA: 2-10 replicas, GPU nodes)  │    │    │
│  │  └─────────────────────────────────────────────┘    │    │
│  │                                                      │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐    │
│  │                  Data Namespace                       │    │
│  │                                                      │    │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │    │
│  │  │Postgres │ │ Redis   │ │ MinIO   │ │Kafka    │  │    │
│  │  │ (3 repl)│ │(3 repl) │ │(3 repl) │ │(3 broker│  │    │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘  │    │
│  │                                                      │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐    │
│  │              Observability Namespace                   │    │
│  │                                                      │    │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────────────────┐   │    │
│  │  │Prometheu│ │ Grafana │ │ Loki / ELK Stack    │   │    │
│  │  │ s       │ │         │ │                     │   │    │
│  │  └─────────┘ └─────────┘ └─────────────────────┘   │    │
│  │                                                      │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Security Architecture

### 7.1 Security Layers

```
┌─────────────────────────────────────────────────────────┐
│                    SECURITY ARCHITECTURE                   │
│                                                           │
│  Layer 1: Network                                         │
│  ├── Camera VLAN segmentation                             │
│  ├── DMZ-based stream gateway                             │
│  ├── API Gateway (NGINX) rate limiting                    │
│  └── TLS/HTTPS for all external traffic                   │
│                                                           │
│  Layer 2: Authentication                                  │
│  ├── JWT-based auth (all API endpoints)                   │
│  ├── Refresh token rotation                               │
│  └── Session management via Redis                         │
│                                                           │
│  Layer 3: Authorization                                   │
│  ├── RBAC: SuperAdmin, DeptAdmin, Operator, Viewer        │
│  ├── Department-scoped data isolation                     │
│  └── Permission matrix per resource/action                │
│                                                           │
│  Layer 4: Data Protection                                 │
│  ├── TLS in transit (HTTPS/WSS)                           │
│  ├── Encryption at rest (pgcrypto for sensitive fields)   │
│  ├── MinIO bucket policies (no public access)             │
│  └── Signed URLs for temporary snapshot access            │
│                                                           │
│  Layer 5: Audit                                           │
│  ├── All admin actions logged to audit_log table          │
│  ├── Actor identity, timestamp, before/after values       │
│  └── API access logging (NGINX access logs)               │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

---

## 8. Scalability Architecture

### 8.1 Scaling Path: 50 → 80,000 Cameras

| Dimension | PoC (50 cameras) | Pilot (500 cameras) | Statewide (80,000 cameras) |
|-----------|-----------------|---------------------|---------------------------|
| Ingestion | 1 MediaMTX | 3 MediaMTX (load-balanced) | Regional gateway clusters |
| AI Compute | 1 CPU/GPU worker | 5 GPU workers | GPU Triton clusters, auto-scaled |
| Message Bus | Redis Streams (1 node) | Redis Cluster (3 nodes) | Kafka cluster (multi-broker) |
| Database | Single PostgreSQL | PostgreSQL + Read Replica | Sharded PostgreSQL (Citus) + Elasticsearch |
| Storage | MinIO (single node) | MinIO distributed (4 nodes) | Ceph/S3-compatible distributed |
| Network | Localhost | Regional datacenter | Statewide backbone + edge nodes |
| Frontend | Single React app | CDN-fronted | CDN + multi-tenant dashboard |

### 8.2 Edge Computing Strategy (Production Vision)

```
┌─────────────────────────────────────────────────────────────┐
│                    EDGE ARCHITECTURE                          │
│                                                               │
│  ┌──────────────────────┐    ┌──────────────────────┐       │
│  │   Edge Node (District)│    │   Edge Node (District)│       │
│  │                       │    │                       │       │
│  │  ┌─────────────────┐ │    │  ┌─────────────────┐ │       │
│  │  │ Local AI Inference│ │    │  │ Local AI Inference│ │       │
│  │  │ (YOLOv8 + ANPR)  │ │    │  │ (YOLOv8 + ANPR)  │ │       │
│  │  └────────┬────────┘ │    │  └────────┬────────┘ │       │
│  │           │           │    │           │           │       │
│  │  ┌────────▼────────┐ │    │  ┌────────▼────────┐ │       │
│  │  │ Local Storage    │ │    │  │ Local Storage    │ │       │
│  │  │ (7 days hot)     │ │    │  │ (7 days hot)     │ │       │
│  │  └────────┬────────┘ │    │  └────────┬────────┘ │       │
│  │           │           │    │           │           │       │
│  │  Only metadata +     │    │  Only metadata +     │       │
│  │  alerts sent to      │    │  alerts sent to      │       │
│  │  central platform    │    │  central platform    │       │
│  └───────────┬──────────┘    └───────────┬──────────┘       │
│              │                            │                   │
│              └────────────┬───────────────┘                   │
│                           │                                   │
│                    ┌──────▼──────┐                            │
│                    │   Central   │                            │
│                    │  Platform   │                            │
│                    │  (Gandhinagar)│                          │
│                    │              │                            │
│                    │  Aggregated  │                            │
│                    │  alerts +    │                            │
│                    │  metadata    │                            │
│                    └─────────────┘                            │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 9. Integration Architecture

### 9.1 External System Integration (Production Vision)

```
┌─────────────────────────────────────────────────────────────┐
│                 EXTERNAL INTEGRATIONS                         │
│                                                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │  VAHAN   │ │  SARTHI  │ │ eGujCop  │ │  AFIS/   │       │
│  │(Vehicle) │ │(License) │ │ (CCTNS)  │ │  NAFIS   │       │
│  │          │ │          │ │          │ │(Fingerpr)│       │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘       │
│       │             │             │             │             │
│       └─────────────┴──────┬──────┴─────────────┘             │
│                            │                                   │
│                    ┌───────▼───────┐                          │
│                    │  API Gateway  │                          │
│                    │  (Kong/NGINX) │                          │
│                    │  mTLS + Auth  │                          │
│                    └───────┬───────┘                          │
│                            │                                   │
│                    ┌───────▼───────┐                          │
│                    │  Watchlist    │                          │
│                    │  Mirror DB    │                          │
│                    │  (Local copy) │                          │
│                    └───────────────┘                          │
│                                                               │
│  PoC: Mock/representative data only                          │
│  Production: Scheduled sync via secure API/SFTP              │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

*End of High-Level Design Document*
