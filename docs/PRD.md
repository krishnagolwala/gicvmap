# Product Requirements Document (PRD)
## Gujarat Integrated CCTV Video Management & Analytics Platform (GICVMAP)

---

**Document Control**

| Field | Detail |
|-------|--------|
| Document Title | Product Requirements Document — Integrated CCTV Video Management & Analytics Platform |
| Prepared For | Gujarat Police Innovation Hackathon 2026 (SCRB, Home Department, Government of Gujarat) |
| Version | 1.0 |
| Status | Final Draft for Build |
| Owner | Product/Engineering Lead |
| Related Program | Gujarat CCTV Hackathon 2026 |
| Target Event | 10–11 September 2026 |
| Classification | Internal — Hackathon Submission |
| Deadline | 07 September 2026 |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Background & Problem Statement](#2-background--problem-statement)
3. [Goals & Objectives](#3-goals--objectives)
4. [Scope Definition](#4-scope-definition)
5. [Stakeholders & User Personas](#5-stakeholders--user-personas)
6. [User Stories & Use Cases](#6-user-stories--use-cases)
7. [Functional Requirements](#7-functional-requirements)
8. [Non-Functional Requirements](#8-non-functional-requirements)
9. [System Architecture Overview](#9-system-architecture-overview)
10. [Data Model & Database Design](#10-data-model--database-design)
11. [API Specification Summary](#11-api-specification-summary)
12. [AI/ML Pipeline Requirements](#12-aiml-pipeline-requirements)
13. [Integration Requirements (External Databases)](#13-integration-requirements-external-databases)
14. [Security & Compliance Requirements](#14-security--compliance-requirements)
15. [Infrastructure, Deployment & DevOps](#15-infrastructure-deployment--devops)
16. [Scalability & Future Roadmap](#16-scalability--future-roadmap)
17. [Testing Strategy](#17-testing-strategy)
18. [Success Metrics / KPIs](#18-success-metrics--kpis)
19. [Milestones & Build Timeline](#19-milestones--build-timeline)
20. [Risks, Assumptions & Dependencies](#20-risks-assumptions--dependencies)
21. [Glossary](#21-glossary)
22. [Appendix — Diagrams & Reference Material](#22-appendix--diagrams--reference-material)

---

## 1. Executive Summary

The Government of Gujarat operates over 26 departments, each running independent CCTV ecosystems with heterogeneous vendors, video management systems (VMS), storage architectures, retention policies, and camera types. This fragmentation prevents unified monitoring, cross-departmental analytics, and rapid law-enforcement response.

This PRD defines the requirements for building the **Gujarat Integrated CCTV Video Management & Analytics Platform (GICVMAP)** — a hackathon proof-of-concept (PoC) that demonstrates a scalable, secure, and interoperable architecture capable of:

- **Onboarding heterogeneous CCTV feeds** (~50 cameras for PoC, ~80,000 cameras at full statewide scale) into a single unified platform.
- **Performing AI-powered video analytics**: Automatic Number Plate Recognition (ANPR), Facial Recognition (FRS), object/person detection, and multi-camera vehicle tracking.
- **Cross-referencing live detections** against watchlist databases (stolen vehicles, wanted persons, missing persons, blacklisted vehicles) and generating real-time automated alerts.
- **Visualizing cameras, vehicle routes, and alerts** on a GIS-based command dashboard.
- **Providing a foundation** that can evolve from a lightweight registry into a full statewide Central VMS without major redesign.

The system is built using a **hybrid architecture**: Model 1 (Registry & GIS Foundation) as the base layer, combined with Model 2 (Unified Viewing & Analytics) for the PoC demonstration, with an architecture explicitly designed to extend toward Model 3 (Federation Middleware) and Model 4 (Central VMS & AI Platform) at scale.

### 1.1 Key Value Proposition

| Dimension | Current State | After GICVMAP |
|-----------|--------------|---------------|
| Monitoring | 26 separate VMS viewers | Single unified dashboard |
| Analytics | None / department-specific | AI-powered ANPR, FRS, tracking |
| Alerting | Manual, reactive | Automated, real-time, proactive |
| Vehicle Tracking | Impossible across departments | Cross-camera route reconstruction |
| Asset Visibility | No central inventory | GIS-based camera registry |
| Watchlist Integration | No cross-system correlation | Real-time database matching |

### 1.2 Technology Stack Summary

All components are built on **open-source technologies**:

| Layer | Technology |
|-------|-----------|
| Frontend | React.js, Leaflet/OpenLayers, WebRTC/HLS player |
| Backend | Python (FastAPI), Node.js |
| Database | PostgreSQL + PostGIS, Redis |
| Message Queue | Kafka / Redis Streams |
| AI/ML | YOLOv8, EasyOCR/EasyOCR, InsightFace, PyTorch/TensorFlow |
| Streaming | MediaMTX, FFmpeg, GStreamer |
| Storage | MinIO (S3-compatible) |
| Containerization | Docker, Docker Compose |
| Search | Elasticsearch (planned for scale) |

---

## 2. Background & Problem Statement

### 2.1 Current State

- **26 Government Departments** operate independent CCTV systems (Home/Police, Municipal Corporations, RTO, Food & Civil Supplies, etc.).
- **Camera types**: analog + IP-based, deployed across geographically dispersed locations (border districts, Valsad, Dahod, Somnath, Jamnagar, Dwarka), spanning distances up to ~1,000 km.
- **Storage**: mixed cloud and on-premise; retention varies (7 to 15+ days).
- **No centralized inventory** of camera assets, locations, ownership, or health status.
- **No mechanism** to correlate video feeds with law-enforcement databases (VAHAN, SARTHI, eGujCop/CCTNS, AFIS, NAFIS).
- Each department's VMS is a **silo** — a central command center currently needs multiple separate viewers to monitor different departments' feeds.

### 2.2 Problem Statement

There is no unified, scalable, and secure way to:

1. **Discover and catalog** all CCTV assets across departments (heterogeneity in metadata).
2. **View live/recorded feeds** from multiple vendor systems in one interface.
3. **Run AI analytics** (ANPR, FRS, tracking) uniformly across heterogeneous feeds.
4. **Correlate detections** with law-enforcement watchlists in real time.
5. **Scale the solution** from a handful of pilot cameras to ~80,000 cameras statewide without re-architecture.

### 2.3 Why Now

Rising need for proactive public safety monitoring, crime detection, and traffic law enforcement requires moving from **reactive** (manually reviewing footage after an incident) to **proactive** (real-time detection and alerting) policing — this requires a unified data and AI layer across all camera infrastructure in the state.

### 2.4 Key Challenges

| Challenge | Description |
|-----------|-------------|
| Heterogeneous Infrastructure | Different vendors, VMS platforms, AMC periods, storage architectures, camera types, formats, and feed-sharing protocols |
| Geographical Dispersion | Camera sites distributed across the State, distances extending ~1,000 km |
| Unified Analytics | Solution must support analytics and event handling across onboarded cameras through a unified framework |
| Scalability | New cameras, departments, systems, and future analytics must onboard without major redesign |

---

## 3. Goals & Objectives

### 3.1 Primary Goals

| Goal | Description |
|------|-------------|
| G1 | Build a centralized CCTV asset registry with GIS visualization (Model 1 foundation) |
| G2 | Build a unified viewing platform connecting to heterogeneous camera/VMS sources without disrupting existing infrastructure (Model 2) |
| G3 | Implement AI-powered analytics: vehicle detection, ANPR, person detection, optional facial recognition |
| G4 | Implement cross-camera vehicle tracking / route reconstruction using timestamped detections |
| G5 | Implement real-time watchlist correlation and alerting |
| G6 | Design (and document, not necessarily fully build) a security architecture suitable for statewide law-enforcement-grade deployment |
| G7 | Design a scalability plan proving the architecture can grow from 50 to ~80,000 cameras |
| G8 | Produce all mandatory hackathon submission artifacts (PPT, HLD, demo videos, output report) |

### 3.2 Success Definition

The PoC is successful if, using ~50 test cameras (own + government-provided):

1. A camera can be **onboarded** into the registry within minutes (bulk or manual).
2. **Live feeds** are visible in a unified dashboard regardless of source vendor.
3. Given a vehicle registration number, the system can show its **route/timeline** across multiple camera locations using real detections (not simulated).
4. A representative **watchlist match** triggers a real-time alert on the dashboard within a few seconds of detection.
5. The **architecture and documentation** demonstrate a credible path to 80,000-camera scale.

### 3.3 Non-Goals (Explicitly Out of Scope for PoC)

- Full statewide rollout or production hardening.
- Full integration with live production VAHAN/SARTHI/eGujCop/AFIS/NAFIS (PoC will use representative/mock watchlist data modeled on these).
- 100% accuracy AI models — focus is on demonstrating the pipeline and architecture, not production-grade model accuracy.
- Building a fully custom VMS from scratch (leverage open-source components).
- Mobile applications (web-first only for PoC).

---

## 4. Scope Definition

### 4.1 In Scope (Hackathon PoC Build)

| Module | Description |
|--------|-------------|
| Camera Registry Service | With GIS map (Model 1) |
| Stream Gateway | Ingest RTSP/ONVIF feeds and re-stream to browser (WebRTC/HLS) |
| AI Analytics Service | Object detection (vehicles/persons), ANPR, optional face recognition |
| Cross-Camera Vehicle Tracking | Route reconstruction via plate matching across cameras + timestamps |
| Watchlist Management Service | CRUD for representative watchlist entries |
| Real-Time Alert Engine | Detection → watchlist match → alert → push notification |
| Unified Web Dashboard | GIS map, live video wall, vehicle search & route playback, alert console, camera registry admin UI |
| Documentation | HLD, architecture diagrams, security/scalability write-ups |
| Demo recordings | Own feed + government feed |

### 4.2 Out of Scope (Documented Only, Not Built)

- Full Kubernetes multi-region production deployment.
- Actual integration with production government databases (only mock/representative data used).
- Full disaster recovery infrastructure (DR strategy document only).
- Edge AI hardware deployment at 80,000 physical camera sites.
- Mobile applications (web-first only for PoC).

---

## 5. Stakeholders & User Personas

### 5.1 Stakeholders

| Stakeholder | Interest |
|-------------|----------|
| Gujarat Police / SCRB | Primary evaluator; needs law-enforcement-grade proactive alerting |
| Home Department | Policy oversight, statewide rollout decision-maker |
| Departmental CCTV Owners (RTO, Municipal Corp, etc.) | Data/infrastructure providers; need assurance their systems aren't disrupted |
| Hackathon Participants (Build Team) | Builders of the PoC |
| Citizens (indirect) | Beneficiaries of improved public safety |

### 5.2 User Personas

#### Persona 1: Control Room Operator
- **Role**: Monitors live feeds across departments from a central command center.
- **Needs**: Single-pane-of-glass video wall, quick camera search by location/department, ability to see alerts instantly.
- **Frequency**: Continuous (8-hour shifts).
- **Technical Level**: Low-to-medium.

#### Persona 2: Investigating Officer
- **Role**: Needs to trace a specific vehicle or suspect across time and locations.
- **Needs**: Search by vehicle number/face, see full timestamped route on a map, export report/evidence.
- **Frequency**: On-demand (per investigation).
- **Technical Level**: Medium.

#### Persona 3: System Administrator
- **Role**: Onboards new cameras/departments, manages users and roles, monitors camera health.
- **Needs**: Bulk import tools, health dashboards, RBAC configuration.
- **Frequency**: Periodic (setup + maintenance).
- **Technical Level**: High.

#### Persona 4: Department IT Coordinator
- **Role**: Provides camera credentials/feed access for their department without giving up control of their own VMS.
- **Needs**: Simple onboarding process (API key/RTSP URL registration), assurance of data isolation/security.
- **Frequency**: One-time + periodic updates.
- **Technical Level**: Medium.

---

## 6. User Stories & Use Cases

### 6.1 User Stories

| ID | As a... | I want to... | So that... |
|----|---------|-------------|-----------|
| US-01 | System Admin | Bulk upload camera metadata via CSV | I can onboard many cameras quickly |
| US-02 | System Admin | See all cameras plotted on a GIS map | I can identify coverage gaps |
| US-03 | Control Room Operator | View live feeds from multiple departments in one grid | I don't need multiple separate viewers |
| US-04 | Investigating Officer | Search a vehicle registration number | I can see everywhere it was detected and when |
| US-05 | Investigating Officer | See the route of a vehicle plotted on a map with timestamps | I can reconstruct its movement history |
| US-06 | System Admin | Add entries to a watchlist (plate/person) | The system can auto-detect matches |
| US-07 | Control Room Operator | Receive a real-time alert when a watchlisted vehicle/person is detected | I can respond immediately |
| US-08 | Department Coordinator | Register my department's camera without exposing full VMS control | My existing system remains untouched |
| US-09 | System Admin | View camera health/status (online/offline/last-seen) | I can maintain infrastructure proactively |
| US-10 | Investigating Officer | Export a report of a vehicle's detected history | I can use it as evidence documentation |

### 6.2 Primary Use Case Flow (Evaluation Scenario)

```
1. Admin onboards ~50 cameras (own simulated + government-provided) into the registry.
2. Cameras appear on the GIS map with live status.
3. Operator opens video wall — sees selected feeds streaming.
4. AI pipeline runs continuously on each feed, extracting vehicle plates and (optionally) faces.
5. Evaluator provides a target vehicle registration number.
6. Officer searches that number in the platform.
7. Platform returns a table + map route of all detections of that vehicle across cameras with timestamps.
8. Separately, evaluator/team pre-loads a representative watchlist including some test plates.
9. As feeds are processed, any detection matching the watchlist triggers a alert visible
   on the dashboard within seconds, including snapshot, camera, and timestamp.
10. Team demonstrates all of the above live plus with a government-provided feed,
    submitting a report of detected plates/timestamps.
```

### 6.3 Use Case Diagram (Textual)

```
                    ┌─────────────────────────────────────────┐
                    │          GICVMAP Platform                │
                    │                                         │
  ┌──────────┐     │  ┌─────────────┐  ┌──────────────┐     │
  │ System   │────▶│  │ Onboard     │  │ Manage       │     │
  │ Admin    │     │  │ Cameras     │  │ Watchlist    │     │
  └──────────┘     │  └─────────────┘  └──────────────┘     │
                    │                                         │
  ┌──────────┐     │  ┌─────────────┐  ┌──────────────┐     │
  │ Control  │────▶│  │ View Live   │  │ Receive      │     │
  │ Room Op  │     │  │ Feeds       │  │ Alerts       │     │
  └──────────┘     │  └─────────────┘  └──────────────┘     │
                    │                                         │
  ┌──────────┐     │  ┌─────────────┐  ┌──────────────┐     │
  │ Invest.  │────▶│  │ Search      │  │ View Route   │     │
  │ Officer  │     │  │ Vehicle     │  │ on Map       │     │
  └──────────┘     │  └─────────────┘  └──────────────┘     │
                    │                                         │
  ┌──────────┐     │  ┌─────────────┐  ┌──────────────┐     │
  │ Dept IT  │────▶│  │ Register    │  │ Monitor      │     │
  │ Coord.   │     │  │ Camera      │  │ Health       │     │
  └──────────┘     │  └─────────────┘  └──────────────┘     │
                    └─────────────────────────────────────────┘
```

---

## 7. Functional Requirements

### 7.1 Module: Camera Registry (Model 1 Foundation)

| Req ID | Requirement | Priority |
|--------|-------------|----------|
| FR-1.1 | System shall allow manual entry of camera metadata: name, department, lat/lng, camera type (analog/IP), vendor, RTSP/ONVIF URL, storage type, retention period | P0 |
| FR-1.2 | System shall support bulk onboarding via CSV/Excel upload | P0 |
| FR-1.3 | System shall expose a REST API for programmatic camera onboarding | P0 |
| FR-1.4 | System shall display all cameras on an interactive GIS map (Leaflet/OpenLayers) with markers colored by status (online/offline/degraded) | P0 |
| FR-1.5 | System shall support filtering/search by department, camera type, status, and location radius | P1 |
| FR-1.6 | System shall maintain an audit trail of metadata changes (who onboarded/edited, when) | P1 |
| FR-1.7 | System shall provide a periodic health check (ping/stream availability check) per camera and update status accordingly | P1 |
| FR-1.8 | System shall generate a basic "coverage gap" report highlighting geographic zones with low camera density | P2 |
| FR-1.9 | System shall support role-based access such that department users only see/manage their own cameras (Admin sees all) | P1 |

### 7.2 Module: Stream Gateway / Unified Viewing (Model 2)

| Req ID | Requirement | Priority |
|--------|-------------|----------|
| FR-2.1 | System shall connect to camera feeds via RTSP and/or ONVIF protocol | P0 |
| FR-2.2 | System shall relay/transcode incoming RTSP streams to browser-compatible formats (WebRTC preferred for low latency; HLS as fallback) | P0 |
| FR-2.3 | System shall support a configurable multi-camera grid ("video wall") view (e.g., 4/9/16 tiles) | P0 |
| FR-2.4 | System shall not modify, disrupt, or require reconfiguration of the source department's existing VMS/storage system | P0 |
| FR-2.5 | System shall support adding/removing a camera from the live view without service restart | P1 |
| FR-2.6 | System shall log stream connection/disconnection events for diagnostics | P1 |
| FR-2.7 | System shall support at least 8–16 concurrent live streams in the PoC dashboard without significant lag (<3s glass-to-glass latency target) | P0 |

### 7.3 Module: AI Analytics Pipeline

| Req ID | Requirement | Priority |
|--------|-------------|----------|
| FR-3.1 | System shall sample frames from each active stream at a configurable rate (default: 2–5 FPS) for AI inference | P0 |
| FR-3.2 | System shall detect vehicles and persons in sampled frames using an object detection model (e.g., YOLOv8) | P0 |
| FR-3.3 | System shall detect and localize license plates within vehicle bounding boxes | P0 |
| FR-3.4 | System shall perform OCR on detected plates and normalize output to standard Indian plate format (regex: `^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$`) | P0 |
| FR-3.5 | System shall store each detection event with: camera_id, timestamp, detection_type, plate_number (if applicable), confidence score, bounding box, snapshot image reference | P0 |
| FR-3.6 | System shall (optionally) extract facial embeddings from detected persons for facial recognition matching | P2 |
| FR-3.7 | System shall discard/not persist low-confidence detections below a configurable threshold (default 0.5) to reduce noise, while still logging for tuning purposes | P1 |
| FR-3.8 | System shall be modular such that new analytics models can be added as independent pipeline stages without redesigning ingestion | P1 |

### 7.4 Module: Cross-Camera Vehicle Tracking

| Req ID | Requirement | Priority |
|--------|-------------|----------|
| FR-4.1 | System shall allow searching detection history by vehicle registration number (exact or fuzzy match to tolerate OCR errors) | P0 |
| FR-4.2 | System shall return all detection events for a given plate ordered chronologically, each including camera location and timestamp | P0 |
| FR-4.3 | System shall visualize the resulting sequence as a connected route/polyline on the GIS map | P0 |
| FR-4.4 | System shall display estimated inter-camera travel time/speed where distance and timestamp data allow | P1 |
| FR-4.5 | System shall support exporting the route/history as a report (PDF/CSV) | P2 |

### 7.5 Module: Watchlist Management

| Req ID | Requirement | Priority |
|--------|-------------|----------|
| FR-5.1 | System shall provide CRUD operations for watchlist entries: type (vehicle/person), identifying value, reason/category, source, added-by, added-at | P0 |
| FR-5.2 | System shall support bulk import of watchlist entries via CSV | P1 |
| FR-5.3 | System shall support marking a watchlist entry active/inactive without deletion (soft-disable) | P1 |
| FR-5.4 | System shall log every watchlist modification with a timestamp and user identity (audit trail) | P1 |

### 7.6 Module: Real-Time Alert Engine

| Req ID | Requirement | Priority |
|--------|-------------|----------|
| FR-6.1 | System shall check every new detection event against active watchlist entries in near real time (target: <5 seconds from detection to alert) | P0 |
| FR-6.2 | For plate matches: exact string match (post-normalization) against watchlist plate values | P0 |
| FR-6.3 | For face matches (if implemented): cosine similarity between detected embedding and stored watchlist embeddings above a configurable threshold (default 0.6) | P2 |
| FR-6.4 | On a match, system shall create an alert record containing: watchlist_id, detection_id, camera_id, timestamp, snapshot, severity/category | P0 |
| FR-6.5 | System shall push new alerts to connected dashboard clients in real time via WebSocket | P0 |
| FR-6.6 | System shall allow an operator to acknowledge/dismiss an alert, updating its status | P1 |
| FR-6.7 | System shall maintain a searchable historical log of all past alerts | P1 |

### 7.7 Module: Unified Dashboard (Frontend)

| Req ID | Requirement | Priority |
|--------|-------------|----------|
| FR-7.1 | Dashboard shall present a GIS map view as the primary landing page, showing all onboarded cameras | P0 |
| FR-7.2 | Dashboard shall provide a live video wall view with selectable camera tiles | P0 |
| FR-7.3 | Dashboard shall provide a "Vehicle Search" page: input plate number → output timeline table + map route | P0 |
| FR-7.4 | Dashboard shall provide an "Alerts" panel showing real-time and historical alerts with filter/search | P0 |
| FR-7.5 | Dashboard shall provide a "Camera Management" (admin) page: add/edit/bulk-import cameras, view health status | P0 |
| FR-7.6 | Dashboard shall provide a "Watchlist Management" page for CRUD on watchlist entries | P0 |
| FR-7.7 | Dashboard shall implement role-based views (Admin vs. Operator vs. Department User) | P1 |
| FR-7.8 | Dashboard shall be responsive enough for a control-room-style large display and standard laptop screens | P1 |

---

## 8. Non-Functional Requirements

### 8.1 Performance

| NFR ID | Requirement |
|--------|-------------|
| NFR-1 | Live stream latency (glass-to-glass) should not exceed ~3–5 seconds in PoC environment |
| NFR-2 | Detection-to-alert latency should not exceed ~5 seconds under normal load |
| NFR-3 | Vehicle search query should return results within 2 seconds for PoC-scale data volumes (<1M detection records) |
| NFR-4 | Dashboard map with 50 camera markers should render within 1–2 seconds |

### 8.2 Scalability

| NFR ID | Requirement |
|--------|-------------|
| NFR-5 | Architecture shall support horizontal scaling of AI inference workers independently from ingestion/gateway components |
| NFR-6 | Architecture shall support addition of new camera sources without downtime or redeployment |
| NFR-7 | Data storage design shall support partitioning/sharding strategies to scale from ~50 to ~80,000 cameras |

### 8.3 Reliability & Availability

| NFR ID | Requirement |
|--------|-------------|
| NFR-8 | Individual camera stream failure shall not affect processing of other camera streams |
| NFR-9 | System shall automatically attempt reconnection to a dropped RTSP stream (exponential backoff: 5s, 10s, 30s, 60s) |
| NFR-10 | Core services should target ≥99% uptime during PoC demo window |

### 8.4 Security

| NFR ID | Requirement |
|--------|-------------|
| NFR-11 | All API endpoints shall require authentication (JWT-based) except public health-check endpoints |
| NFR-12 | Role-based access control (RBAC) shall govern access to department-specific camera data |
| NFR-13 | All data in transit shall use TLS (HTTPS/WSS); RTSP feeds should support secure variants |
| NFR-14 | Sensitive data (watchlist entries, face embeddings) shall be encrypted at rest |
| NFR-15 | All administrative actions shall be logged with actor identity and timestamp (audit trail) |

### 8.5 Usability

| NFR ID | Requirement |
|--------|-------------|
| NFR-16 | Dashboard shall follow a consistent, intuitive UI/UX suitable for control-room operators with minimal training |
| NFR-17 | Critical alerts shall be visually distinct (color/animation) and audibly notify operators if feasible |

### 8.6 Maintainability & Extensibility

| NFR ID | Requirement |
|--------|-------------|
| NFR-18 | Each functional module shall be built as an independently deployable microservice/container |
| NFR-19 | New camera vendor protocols shall be integrable via an adapter pattern without modifying core services |
| NFR-20 | New AI models/analytics types shall be pluggable as independent pipeline stages |

---

## 9. System Architecture Overview

### 9.1 Architectural Style

- **Microservices-based**, containerized (Docker), orchestrated via Docker Compose for PoC and designed for Kubernetes at scale.
- **Event-driven core**: detections and alerts flow through a message bus (Kafka or Redis Streams) decoupling ingestion, AI processing, matching, and notification.
- **Adapter pattern** for camera/VMS integration to remain vendor-neutral.

### 9.2 High-Level Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         CAMERA SOURCES                          │
│   Govt Dept Cameras (RTSP/ONVIF)  |  Simulated Feeds (ffmpeg)   │
└───────────────────────────┬───────────────────────────────────┘
                            │
                            ▼
                ┌───────────────────────┐
                │   Stream Gateway       │  (MediaMTX / go2rtc)
                │  RTSP → WebRTC/HLS     │
                └───────────┬───────────┘
                            │
              ┌─────────────┼──────────────┐
              ▼                            ▼
   ┌────────────────────┐       ┌─────────────────────┐
   │ Frontend Dashboard  │       │ Frame Sampler        │
   │ (React + Leaflet)   │       │ (grabs frames @N fps)│
   └────────────────────┘       └──────────┬───────────┘
                                            ▼
                                 ┌─────────────────────┐
                                 │   AI Inference Svc   │
                                 │ YOLOv8 + ANPR + FRS   │
                                 └──────────┬───────────┘
                                            ▼
                                 ┌─────────────────────┐
                                 │  Event/Message Bus   │
                                 │  (Kafka/Redis Stream) │
                                 └──────────┬───────────┘
                       ┌────────────────────┼───────────────────┐
                       ▼                    ▼                   ▼
           ┌─────────────────┐  ┌────────────────────┐ ┌───────────────┐
           │ Detection Store  │  │ Watchlist Matcher   │ │ Track/Route    │
           │ (Postgres/TSDB)  │  │ → Alert Engine       │ │ Builder Svc    │
           └─────────────────┘  └──────────┬──────────┘ └───────┬───────┘
                                            ▼                     ▼
                                  ┌───────────────────┐  ┌────────────────┐
                                  │ WebSocket Notifier │  │ Search/Analytics│
                                  │  → Dashboard        │  │ API             │
                                  └───────────────────┘  └────────────────┘

     ┌───────────────────────────────────────────────┐
     │        Camera Registry Service (Model 1)        │
     │        PostgreSQL + PostGIS, GIS API             │
     └───────────────────────────────────────────────┘
```

### 9.3 Component Descriptions

#### 9.3.1 Stream Gateway
- **Technology**: MediaMTX (or go2rtc)
- **Responsibility**: Accept RTSP/ONVIF connections from cameras/NVRs; re-publish as WebRTC (low-latency browser playback) and/or HLS (fallback).
- **Config-driven**: each camera is added as a "path" in MediaMTX config or via its API, referencing the registry's stored RTSP URL.

#### 9.3.2 Frame Sampler
- A lightweight worker (OpenCV `cv2.VideoCapture`) per active camera subscribed for analytics.
- Pulls frames at configurable FPS (default low, e.g., 2 FPS) to control compute load.
- Publishes raw frame + camera_id + timestamp to the AI Inference Service.

#### 9.3.3 AI Inference Service
- Runs YOLOv8 for vehicle/person detection.
- Crops vehicle regions → plate detector → OCR (EasyOCR/EasyOCR) → normalized plate string.
- Optional: face detection + embedding extraction (InsightFace) for persons.
- Publishes structured detection events to the Event Bus.

#### 9.3.4 Event/Message Bus
- Kafka (production-style) or Redis Streams (lightweight PoC alternative).
- Topics/streams: `detections`, `alerts`, `camera-health`.
- Decouples producers (AI service) from consumers (storage writer, watchlist matcher, tracking builder).

#### 9.3.5 Detection Store
- PostgreSQL (with TimescaleDB extension recommended for time-series efficiency) storing all detection events.
- Indexed by `plate_number`, `camera_id`, `timestamp` for fast lookups.

#### 9.3.6 Watchlist Matcher & Alert Engine
- Subscribes to detections stream.
- For each detection, checks against active watchlist entries.
- On match: writes to alerts table and publishes to alerts stream → WebSocket Notifier pushes to connected dashboard clients.

#### 9.3.7 Track/Route Builder Service
- On-demand service that assembles all detections for a given plate number into a time-ordered sequence joined with camera GIS coordinates.
- Exposes a `/vehicle/{plate}/route` API returning ordered waypoints for map rendering.

#### 9.3.8 Camera Registry Service (Model 1)
- Independent service/module; PostgreSQL + PostGIS.
- Owns camera metadata; all other services reference `camera_id`.
- Provides the GIS API consumed by the frontend map and by the Track/Route Builder.

#### 9.3.9 Frontend Dashboard
- React SPA.
- Pages: Map/Home, Video Wall, Vehicle Search, Alerts, Camera Admin, Watchlist Admin.
- Consumes REST APIs for CRUD/search; consumes WebSocket for real-time alerts; embeds WebRTC/HLS players for live view.

### 9.4 Data Flow Summary

```
1. Camera → Stream Gateway → (a) Dashboard live view, (b) Frame Sampler.
2. Frame Sampler → AI Inference → Event Bus (detections topic).
3. Event Bus → Detection Store (persist) AND Watchlist Matcher (real-time check).
4. Watchlist Matcher → match found → Alerts table + alerts topic → WebSocket → Dashboard.
5. Dashboard "Vehicle Search" → Track/Route Builder API → Detection Store query
   joined with Registry GIS data → polyline response → map render.
```

### 9.5 Deployment Topology (PoC)

- **Single Docker Compose stack** on one host for the hackathon demo.
- **Services**: registry-service, stream-gateway, ai-service, watchlist-service, alert-service, search-service, frontend, postgres, redis, minio.

---

## 10. Data Model & Database Design

### 10.1 Entity-Relationship Overview

```
Department ──< Camera ──< Detection ──< Alert >── WatchlistEntry
                  │
                  └──< CameraHealthLog
```

### 10.2 Table Definitions

#### departments
```sql
CREATE TABLE departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    code VARCHAR(20) UNIQUE,
    contact_email VARCHAR(150),
    created_at TIMESTAMP DEFAULT now()
);
```

#### cameras
```sql
CREATE TABLE cameras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    department_id INT REFERENCES departments(id),
    camera_type VARCHAR(20) CHECK (camera_type IN ('analog','ip')),
    vendor VARCHAR(100),
    ip_address VARCHAR(50),
    rtsp_url TEXT,
    onvif_supported BOOLEAN DEFAULT false,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    geom GEOGRAPHY(Point, 4326),
    storage_type VARCHAR(20) CHECK (storage_type IN ('cloud','local')),
    retention_days INT DEFAULT 7,
    status VARCHAR(20) DEFAULT 'unknown',
    onboarded_by VARCHAR(100),
    onboarded_at TIMESTAMP DEFAULT now(),
    last_seen TIMESTAMP
);
CREATE INDEX idx_cameras_geom ON cameras USING GIST (geom);
```

#### camera_health_log
```sql
CREATE TABLE camera_health_log (
    id BIGSERIAL PRIMARY KEY,
    camera_id UUID REFERENCES cameras(id),
    checked_at TIMESTAMP DEFAULT now(),
    status VARCHAR(20),
    latency_ms INT
);
```

#### detections
```sql
CREATE TABLE detections (
    id BIGSERIAL PRIMARY KEY,
    camera_id UUID REFERENCES cameras(id),
    detected_at TIMESTAMP NOT NULL,
    detection_type VARCHAR(20) CHECK (detection_type IN ('vehicle','person')),
    plate_number VARCHAR(20),
    plate_confidence FLOAT,
    bbox JSONB,
    face_embedding VECTOR(512),
    snapshot_url TEXT,
    created_at TIMESTAMP DEFAULT now()
);
CREATE INDEX idx_detections_plate ON detections(plate_number);
CREATE INDEX idx_detections_camera_time ON detections(camera_id, detected_at);
```

#### watchlist
```sql
CREATE TABLE watchlist (
    id SERIAL PRIMARY KEY,
    type VARCHAR(20) CHECK (type IN ('vehicle','person')),
    plate_number VARCHAR(20),
    face_embedding VECTOR(512),
    reason VARCHAR(255),
    source_system VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    added_by VARCHAR(100),
    added_at TIMESTAMP DEFAULT now()
);
```

#### alerts
```sql
CREATE TABLE alerts (
    id BIGSERIAL PRIMARY KEY,
    watchlist_id INT REFERENCES watchlist(id),
    detection_id BIGINT REFERENCES detections(id),
    camera_id UUID REFERENCES cameras(id),
    triggered_at TIMESTAMP DEFAULT now(),
    severity VARCHAR(20) DEFAULT 'medium',
    status VARCHAR(20) DEFAULT 'new',
    acknowledged_by VARCHAR(100),
    acknowledged_at TIMESTAMP
);
```

#### audit_log
```sql
CREATE TABLE audit_log (
    id BIGSERIAL PRIMARY KEY,
    actor VARCHAR(100),
    action VARCHAR(100),
    entity VARCHAR(50),
    entity_id VARCHAR(100),
    details JSONB,
    created_at TIMESTAMP DEFAULT now()
);
```

#### users
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(30) CHECK (role IN ('superadmin','dept_admin','operator','viewer')),
    department_id INT REFERENCES departments(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT now()
);
```

### 10.3 Data Retention Strategy

| Tier | PoC | Statewide Vision |
|------|-----|------------------|
| Hot | All data in Postgres, no purge during hackathon | 7 days on SSD/NVMe |
| Warm | N/A | 30 days on HDD-backed object storage |
| Cold | N/A | 90+ days on archival/Glacier-class storage |

---

## 11. API Specification Summary

### 11.1 Camera Registry APIs
```
POST   /api/cameras                     Create camera
GET    /api/cameras                     List/filter cameras
GET    /api/cameras/{id}                Get camera details
PUT    /api/cameras/{id}                Update camera
DELETE /api/cameras/{id}                Remove camera
POST   /api/cameras/bulk-upload         CSV bulk import
GET    /api/cameras/{id}/health         Get health history
GET    /api/cameras/gaps                Gap-analysis report
```

### 11.2 Streaming APIs
```
GET    /api/streams/{camera_id}/webrtc   WebRTC session negotiation
GET    /api/streams/{camera_id}/hls      HLS manifest URL
GET    /api/streams/status               Active stream status list
```

### 11.3 Detection & Search APIs
```
GET    /api/detections?camera_id=&from=&to=       Query raw detections
GET    /api/vehicle/{plate_number}/history         Full detection history
GET    /api/vehicle/{plate_number}/route           Ordered GIS route
GET    /api/vehicle/{plate_number}/report          Export PDF/CSV report
```

### 11.4 Watchlist APIs
```
POST   /api/watchlist              Add entry
GET    /api/watchlist              List entries
PUT    /api/watchlist/{id}         Update entry
DELETE /api/watchlist/{id}         Deactivate entry
POST   /api/watchlist/bulk-upload  CSV bulk import
```

### 11.5 Alert APIs
```
GET    /api/alerts                     List alerts
GET    /api/alerts/{id}                Alert detail
PUT    /api/alerts/{id}/acknowledge    Acknowledge alert
WS     /ws/alerts                      Real-time alert push channel
```

### 11.6 Auth APIs
```
POST   /api/auth/login
POST   /api/auth/refresh
GET    /api/auth/me
```

---

## 12. AI/ML Pipeline Requirements

### 12.1 Object Detection
- **Model**: YOLOv8 (nano/small variant for CPU; medium/large if GPU available).
- **Classes**: car, truck, motorcycle, bus, person.
- **Input**: sampled frames at 2–5 FPS per camera.
- **Output**: bounding boxes + class + confidence.

### 12.2 ANPR (Automatic Number Plate Recognition)
- **Stage 1** — Plate Localization: dedicated plate-detector model or heuristic cropping.
- **Stage 2** — OCR: EasyOCR / EasyOCR on cropped plate image.
- **Stage 3** — Normalization: regex-based cleanup to standard Indian format; reject/flag low-confidence outputs.
- **Accuracy Target for Demo**: best-effort; emphasis on demonstrating working end-to-end pipeline.

### 12.3 Facial Recognition (Optional/Stretch)
- **Detection**: RetinaFace or MTCNN.
- **Embedding**: ArcFace/InsightFace (512-dim vector).
- **Matching**: cosine similarity against watchlist embeddings; threshold configurable (default 0.6).
- **Storage**: pgvector extension in Postgres or FAISS for in-memory similarity search.

### 12.4 Multi-Camera Tracking
- Primary tracking key: **plate number** — same plate at different cameras = same vehicle's journey.
- Route reconstruction = chronological join of all detection rows for that plate, enriched with camera GPS coordinates.
- Within a single camera's view, use ByteTrack/DeepSORT to maintain consistent object IDs.

### 12.5 Model Serving
- **PoC**: Python service loading models in-process (Ultralytics YOLO, EasyOCR) via FastAPI.
- **Scale (documented)**: NVIDIA Triton Inference Server or TorchServe with GPU batching.

### 12.6 Pipeline Configurability
- FPS sampling rate configurable per camera.
- Confidence thresholds configurable per model.
- Ability to enable/disable specific analytics modules per camera.

---

## 13. Integration Requirements (External Databases)

### 13.1 Target Systems

| System | Purpose | PoC Approach |
|--------|---------|-------------|
| VAHAN | Vehicle registration records | Mock table simulating VAHAN-style vehicle master data |
| SARTHI | Driving license records | Not required for PoC core flow |
| eGujCop (CCTNS) | FIR, arrests, wanted persons, stolen vehicles | Representative watchlist table modeled on this |
| AFIS | Fingerprint identification | Out of scope (documented only) |
| NAFIS | National fingerprint database | Out of scope (documented only) |

### 13.2 Integration Pattern (Documented for Production)
- Integration via secure REST API gateways or scheduled secure batch sync into a local "watchlist mirror" table.
- All cross-system integration through API Gateway with mutual TLS and department-level access tokens.
- Data minimization: only necessary fields mirrored locally.

### 13.3 PoC Representative Watchlist Design
Mock but realistically structured table mirroring CCTNS/VAHAN fields:
- `plate_number`, `owner_name`, `vehicle_type`, `reason`, `fir_number`, `added_by`, `added_at`.

---

## 14. Security & Compliance Requirements

### 14.1 Authentication & Authorization
- JWT-based authentication for all API access.
- RBAC roles: SuperAdmin, DepartmentAdmin, Operator, Viewer.
- Department-scoped data isolation.

### 14.2 Data Protection
- TLS/HTTPS for all external API traffic; WSS for WebSocket.
- Encryption at rest for watchlist and face embedding data.
- Snapshot images stored in MinIO with bucket policies restricting public access.

### 14.3 Network Security (Production Vision)
- Camera VLAN segmentation.
- DMZ-based stream gateway.
- API Gateway (Kong/NGINX) with rate limiting, IP allow-listing.
- mTLS for service-to-service communication.

### 14.4 Audit & Compliance
- All administrative actions logged to `audit_log` table.
- Alert and detection data retention policy documented.

### 14.5 Privacy Considerations
- Facial recognition module optional/configurable per camera location.
- Masking of non-essential personal data in UI views.

---

## 15. Infrastructure, Deployment & DevOps

### 15.1 PoC Deployment
- **Containerization**: Docker for every service.
- **Orchestration**: Docker Compose, single host.
- **Services to containerize**: postgres, redis, minio, mediamtx, registry-service, ai-service, watchlist-service, alert-service, search-service, frontend.

### 15.2 CI/CD (Lightweight for Hackathon)
- Git-based repo with clear folder structure per service.
- `docker-compose up --build` as the deployment pipeline.
- Optional: GitHub Actions to lint/build on push.

### 15.3 Environment Configuration
- `.env` file per environment defining DB credentials, JWT secret, model paths, thresholds.
- No hardcoded secrets in code.

### 15.4 Production Deployment Vision (Documented)

| Layer | Production Approach |
|-------|-------------------|
| Compute | Kubernetes clusters, regional with GPU node pools |
| Storage | Distributed object storage (Ceph/S3-compatible) |
| Networking | State-owned backbone/MPLS |
| Edge | Edge AI appliances co-located with camera clusters |
| Observability | Prometheus + Grafana; ELK/EFK for logs |
| DR | Multi-datacenter active-passive replication |

---

## 16. Scalability & Future Roadmap

### 16.1 Scaling Dimensions

| Dimension | PoC (50 cameras) | Statewide (80,000 cameras) |
|-----------|-----------------|---------------------------|
| Ingestion | Single stream gateway | Regional gateway clusters |
| AI Compute | 1 CPU/GPU worker | GPU-based Triton clusters |
| Message Bus | Redis Streams (single node) | Kafka cluster (multi-broker) |
| Storage | Single Postgres instance | Sharded Postgres (Citus) + Elasticsearch |
| Network | Localhost/single VM | Statewide backbone with edge nodes |
| Frontend | Single React app | CDN-fronted, multi-tenant dashboard |

### 16.2 Migration Path
1. **Phase 1 (PoC)**: Model 1 + Model 2 — Registry + Unified Viewing.
2. **Phase 2**: Introduce Model 3 (Federation Middleware) for deeper VMS integration.
3. **Phase 3**: Hybrid Model 4 (Central VMS) for net-new deployments.

### 16.3 Roadmap Beyond Hackathon
- Formal integration with VAHAN/SARTHI/eGujCop/AFIS/NAFIS.
- Edge AI hardware pilot.
- Expand analytics: crowd density, anomaly detection, weapon detection, accident detection.
- Mobile app for field officers.
- Formal SLA/AMC framework for multi-vendor camera maintenance.

---

## 17. Testing Strategy

### 17.1 Test Levels

| Level | Approach |
|-------|----------|
| Unit Testing | Test individual functions: plate normalization regex, watchlist matching logic, API request validation |
| Integration Testing | Test service-to-service flows: detection → event bus → storage → alert |
| End-to-End Testing | Simulate full flow: ingest RTSP feed → detect → match watchlist → verify alert |
| Load Testing | Simulate 10–20 concurrent camera streams |
| UAT | Walkthrough with evaluation scenario |

### 17.2 Test Data
- Sample traffic videos (public domain / self-recorded) looped via ffmpeg as simulated RTSP feeds.
- Small representative watchlist CSV with 5–10 known test plate numbers.

### 17.3 Acceptance Criteria

| Criterion | Test to Prove It |
|-----------|-----------------|
| Successful CCTV integration | Multiple feeds visible in unified dashboard |
| AI-powered video analytics | ANPR output displayed with confidence + timestamp |
| Vehicle tracing | Full route displayed on map with timestamps |
| Watchlist alerting | Live match triggers real-time dashboard alert |
| Scalability readiness | Architecture diagrams + scaling plan |

---

## 18. Success Metrics / KPIs

| KPI | Target for PoC Demo |
|-----|-------------------|
| Cameras onboarded | ≥50 (mix of simulated + government-provided) |
| Concurrent live streams displayed | ≥8–16 without major lag |
| ANPR detection working end-to-end | Yes, demonstrated live |
| Detection-to-alert latency | <5 seconds |
| Vehicle route reconstruction accuracy | Correctly sequences all test detections chronologically |
| Watchlist match demonstration | At least 1 live match during demo |
| Documentation completeness | HLD + PPT + architecture diagrams complete |
| Demo video quality | Clear narration, real backend shown, no mockups |

---

## 19. Milestones & Build Timeline

| Phase | Days | Key Deliverable |
|-------|------|----------------|
| Phase 0 — Setup | Day 1 | Repo scaffolded, Docker Compose skeleton running |
| Phase 1 — Registry | Day 2 | Camera CRUD + GIS map working with dummy data |
| Phase 2 — Streaming | Day 3 | MediaMTX relaying simulated RTSP feed into dashboard |
| Phase 3 — AI Detection | Day 4–5 | YOLOv8 detecting vehicles/persons on sampled frames |
| Phase 4 — ANPR | Day 6–7 | Plate OCR pipeline storing normalized plates in DB |
| Phase 5 — Watchlist & Alerts | Day 8–9 | Watchlist CRUD + real-time alert on match via WebSocket |
| Phase 6 — Tracking/Route | Day 10–11 | Vehicle search returns multi-camera route on map |
| Phase 7 — Dashboard Polish | Day 12 | All modules integrated into a single cohesive UI |
| Phase 8 — Docs & Diagrams | Day 13 | HLD, PPT, architecture diagrams finalized |
| Phase 9 — Demo Recording | Day 14 | Own-feed demo video recorded |
| Phase 10 — Submission | Final Days | All links/docs uploaded, repo finalized |

---

## 20. Risks, Assumptions & Dependencies

### 20.1 Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Government camera feed access delayed | Cannot complete Model 4 demo | Build on simulated feeds first; govt feed = drop-in replacement |
| ANPR OCR accuracy poor on low-quality footage | Weak demo | Use own high-quality recordings for primary demo |
| GPU unavailable for AI inference | Slow inference | Use YOLOv8n on CPU; reduce sampling FPS |
| Time constraints (hackathon) | Incomplete features | Strict prioritization: core flow first |
| WebSocket alert delays under load | Sluggish alerts | Keep PoC scale small (≤20 concurrent AI streams) |

### 20.2 Assumptions
- Government feeds accessible via standard RTSP/ONVIF.
- Evaluation team provides vehicle registration number for testing.
- "Representative watchlist" is explicitly permitted per hackathon rules.
- Single demo machine with 8+ vCPU, 16–32GB RAM, optional GPU is sufficient.

### 20.3 Dependencies
- Availability of hackathon "Resources" page with camera details.
- Open-source model weights downloadable at setup time.
- Docker/Docker Compose availability on build machine.

---

## 21. Glossary

| Term | Definition |
|------|-----------|
| ANPR | Automatic Number Plate Recognition |
| FRS | Facial Recognition System |
| VMS | Video Management System |
| ONVIF | Open Network Video Interface Forum |
| RTSP | Real-Time Streaming Protocol |
| GIS | Geographic Information System |
| RBAC | Role-Based Access Control |
| PoC | Proof of Concept |
| CCTNS | Crime and Criminal Tracking Network & Systems |
| AFIS/NAFIS | (National) Automated Fingerprint Identification System |
| Re-ID | Re-Identification |
| WebRTC | Web Real-Time Communication |
| HLS | HTTP Live Streaming |

---

## 22. Appendix — Diagrams & Reference Material

### 22.1 Diagrams to Prepare
1. Overall System Architecture Diagram
2. Data Flow Diagram — detection event lifecycle
3. Deployment Diagram — PoC Docker Compose vs. production Kubernetes
4. ER Diagram — from Section 10 tables
5. Sequence Diagram — "Vehicle Search & Route Reconstruction"
6. Sequence Diagram — "Watchlist Match & Real-Time Alert"

### 22.2 Reference Open-Source Components

| Purpose | Library/Tool |
|---------|-------------|
| Object Detection | ultralytics/ultralytics (YOLOv8) |
| ANPR OCR | PaddlePaddle/EasyOCR, JaidedAI/EasyOCR |
| Multi-Object Tracking | ifzhang/ByteTrack |
| Face Recognition | deepinsight/insightface |
| RTSP→WebRTC/HLS | bluenviron/mediamtx |
| GIS Frontend | Leaflet.js / react-leaflet, OpenLayers |
| Vector Similarity | pgvector (Postgres extension), FAISS |

### 22.3 Mapping to Hackathon Submission Requirements

| Hackathon Requirement | PRD Section(s) |
|----------------------|----------------|
| Solution Presentation (PPT) | Sections 1, 3, 9, 12, 16, 18 |
| High-Level Design (HLD) | Sections 9, 10, 11, 12, 13, 14, 15, 16 |
| Own-Feed Demonstration | Sections 6.2, 7, 17.3 |
| Government-Feed Demonstration | Sections 6.2, 13.3, 17.3, 20.3 |
| Scalability & Future Roadmap | Section 16 |
| Security Architecture | Section 14 |

---

*This PRD is a living document — as build progresses (per the Milestones in Section 19), update data models, API contracts, and architecture diagrams to reflect actual implementation decisions before final hackathon submission.*

**End of Document — Version 1.0**
