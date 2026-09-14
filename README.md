# 🎥 GICVMAP — Gujarat Integrated CCTV Video Management & Analytics Platform

> **Gujarat Police Innovation Hackathon 2026** — A unified, scalable, AI-powered CCTV management and analytics platform for 26 government departments across Gujarat.

---

## 🏗️ Architecture

```
Camera (RTSP) → MediaMTX → WebRTC/HLS → Dashboard
                 ↓
            Frame Sampler (OpenCV)
                 ↓
         AI Inference (YOLOv8 + PaddleOCR)
                 ↓
          Event Bus (Redis/Kafka)
                 ↓
    ┌────────────┼────────────┐
    ↓            ↓            ↓
 Detection   Watchlist     Vehicle
 Store       Matcher       Tracker
    ↓            ↓            ↓
 PostgreSQL   Alert Engine  Route Builder
                ↓              ↓
          WebSocket → Dashboard
```

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Tailwind CSS, Leaflet, Socket.IO |
| Backend | Python FastAPI, SQLAlchemy, Pydantic |
| AI/ML | YOLOv8, PaddleOCR, OpenCV, PyTorch |
| Database | PostgreSQL + PostGIS + pgvector |
| Cache/MQ | Redis (Streams) |
| Streaming | MediaMTX (RTSP→WebRTC/HLS) |
| Storage | MinIO (S3-compatible) |
| Container | Docker, Docker Compose |

## 🚀 Quick Start

### Prerequisites
- Docker Desktop 4.x
- Docker Compose V2
- FFmpeg (for simulated camera feeds)
- 8GB+ RAM recommended

### 1. Clone & Setup
```bash
git clone https://github.com/your-team/gujarat-cctv-platform.git
cd gujarat-cctv-platform

# Create environment file
cp .env.example .env
# Edit .env with your settings (or use defaults)
```

### 2. Start Services
```bash
docker compose up -d

# Wait for services to be healthy
docker compose ps
```

### 3. Seed Demo Data
```bash
# Create demo cameras, watchlist entries, and test user
python scripts/seed_demo_data.py
```

### 4. Start Simulated Camera Feeds
```bash
# Download sample traffic videos and run:
ffmpeg -re -stream_loop -1 -i sample_traffic_1.mp4 -c copy -f rtsp rtsp://localhost:8554/cam1 &
ffmpeg -re -stream_loop -1 -i sample_traffic_2.mp4 -c copy -f rtsp rtsp://localhost:8554/cam2 &
ffmpeg -re -stream_loop -1 -i sample_traffic_3.mp4 -c copy -f rtsp rtsp://localhost:8554/cam3 &
```

### 5. Access Dashboard
```
http://localhost

Login:
  Username: admin
  Password: admin123
```

## 📁 Project Structure

```
gujarat-cctv-platform/
├── backend/                    # Python FastAPI services
│   ├── registry-service/       # Camera CRUD + GIS metadata
│   ├── watchlist-service/      # Watchlist CRUD + matching
│   ├── alert-service/          # Alert CRUD + WebSocket
│   ├── search-service/         # Vehicle search + route
│   ├── auth-service/           # JWT authentication + RBAC
│   ├── ai-service/             # YOLOv8 + ANPR + face recognition
│   └── shared/                 # Common utilities
├── frontend/                   # React SPA dashboard
│   ├── src/
│   │   ├── components/         # UI components
│   │   ├── hooks/              # Custom React hooks
│   │   ├── services/           # API client
│   │   ├── store/              # Zustand state management
│   │   └── pages/              # Page components
│   └── public/
├── stream-gateway/             # MediaMTX configuration
├── database/                   # SQL init scripts
├── docker/                     # NGINX config, Dockerfiles
├── models/                     # AI model weights
├── scripts/                    # Setup and utility scripts
├── docs/                       # Documentation
│   ├── PRD.md                  # Product Requirements
│   ├── design/TRD.md           # Technical Requirements
│   ├── database/SCHEMA.md      # Database Schema
│   ├── api/SPECIFICATION.md    # API Specification
│   ├── architecture/HLD.md     # High-Level Design
│   ├── ai-ml/PIPELINE.md       # AI/ML Pipeline
│   ├── security/ARCHITECTURE.md# Security Architecture
│   ├── design/SCALABILITY.md   # Scalability Plan
│   ├── frontend/DESIGN.md      # Frontend Design
│   └── testing/STRATEGY.md     # Test Strategy
├── docker-compose.yml          # Service orchestration
├── .env.example                # Environment variables
└── README.md                   # This file
```

## 📊 Features

### ✅ Camera Registry (Model 1)
- GIS-based camera map with PostGIS spatial queries
- Bulk CSV import for rapid onboarding
- Camera health monitoring and status tracking
- Department-scoped access control

### ✅ Unified Viewing (Model 2)
- WebRTC low-latency live streaming (<3s glass-to-glass)
- HLS fallback for broader browser support
- Multi-camera video wall (4/9/16 grid)
- No disruption to existing department VMS

### ✅ AI Video Analytics
- YOLOv8 vehicle/person detection (runs on CPU or GPU)
- ANPR with Indian plate format normalization
- Optional facial recognition (InsightFace)
- Configurable FPS sampling per camera

### ✅ Vehicle Tracking
- Cross-camera route reconstruction via plate matching
- Timeline view with detection history
- Map-based route visualization with timestamps
- CSV/PDF export for evidence documentation

### ✅ Watchlist & Alerting
- CRUD for watchlist entries (vehicles + persons)
- Real-time detection-to-alert matching (<5 seconds)
- WebSocket push notifications with sound
- Alert acknowledgment and status management

### ✅ Security
- JWT authentication with role-based access control
- Department-scoped data isolation
- TLS encryption for all API traffic
- Comprehensive audit logging

## 🔧 Development

### Running Locally (without Docker)
```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn registry.main:app --reload --port 8001

# Frontend
cd frontend
npm install
npm run dev
```

### Running Tests
```bash
# Unit tests
cd backend
pytest tests/unit/ -v

# Integration tests
pytest tests/integration/ -v

# Frontend tests
cd frontend
npm test
```

## 📈 Scalability

| Dimension | PoC (50 cameras) | Statewide (80,000 cameras) |
|-----------|-----------------|---------------------------|
| Ingestion | 1 MediaMTX | Edge nodes + regional clusters |
| AI Compute | 1 CPU/GPU worker | GPU Triton clusters, auto-scaled |
| Database | Single PostgreSQL | Sharded PostgreSQL (Citus) |
| Message Bus | Redis Streams | Kafka cluster (multi-broker) |

## 📝 Documentation

| Document | Location | Description |
|----------|----------|-------------|
| Product Requirements | `docs/PRD.md` | Full PRD (1000+ lines) |
| Technical Requirements | `docs/design/TRD.md` | Detailed technical specs |
| Database Schema | `docs/database/SCHEMA.md` | Complete DDL + ER diagrams |
| API Specification | `docs/api/SPECIFICATION.md` | REST API reference |
| Architecture | `docs/architecture/HLD.md` | High-level design |
| AI/ML Pipeline | `docs/ai-ml/PIPELINE.md` | Analytics pipeline design |
| Security | `docs/security/ARCHITECTURE.md` | Security architecture |
| Scalability | `docs/design/SCALABILITY.md` | Scaling strategy |
| Frontend Design | `docs/frontend/DESIGN.md` | UI/UX specification |
| Test Strategy | `docs/testing/STRATEGY.md` | Testing approach |

## 🏆 Hackathon Submission

- **Problem Statement**: Integrated CCTV Video Management & Analytics Platform
- **Model Choice**: Hybrid (Model 1 + Model 2) with Model 3/4 readiness
- **Tech Stack**: 100% Open Source
- **Target Event**: 10–11 September 2026

## 📄 License

This project is built for the Gujarat Police Innovation Hackathon 2026.

---

**Built with ❤️ for Gujarat Police Innovation Hackathon 2026**
