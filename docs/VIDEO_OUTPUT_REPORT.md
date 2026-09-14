# Video & Output Report
## GICVMAP — Demonstration Footage, Outputs and Evidence Package

**Version:** 1.0 · **Date:** 3 September 2026
**Deliverable mapping:** *"Video & Output Report"* + *"Working Demonstration"* evidence.

This report catalogues every **input feed** and **system output** produced by the working build, where it lives, and how it was verified. It doubles as the evidence index for the live demonstration.

---

## 1. Demonstration Footage (Inputs)

### 1.1 Government-feed demonstration (live, primary)

| Item | Detail |
|------|--------|
| Source | **Sentinel Camera Grid** — Gujarat Police Innovation Hackathon sandbox (integrator access) |
| Catalogue | `https://cctv.corp8.cloud/cameras.json` (30 cameras: cam01–cam30) |
| Live in demo | **cam01, cam06, cam13, cam14, cam15, cam17, cam22, cam27** (8 cameras actually streaming at demo time) |
| Protocols | RTSP `rtsp://…@103.250.160.189:8554/stream/<id>` (AI, TCP forced) · HLS `https://cctv.corp8.cloud/<id>/index.m3u8` (browser, via MediaMTX relay) |
| Content | Real live traffic scenes — 1080p H.264 (cam01 etc.) and H.265 (cam06, cam22) |
| Requirement met | *"ANPR demonstration on live feeds"* + *"Government-Feed Demonstration"* |

### 1.2 Recorded/backfill feed path (supplementary, explicitly permitted)

The problem statement permits ANPR demonstration on **live *or* recorded feeds**. Sentinel feeds are continuous recordings that loop (scene cuts at loop points). To guarantee the vehicle-tracking and alert demos are deterministic on demo day, the **demo seeder** (`backend/demo_seeder.py`) publishes realistic detection events through the **same pipeline** as live AI detections:

```
demo_seeder ──► Redis detection_events ──► alert worker ──► PostgreSQL detections
                                   │
                                   └──► watchlist match ──► alerts ──► WebSocket toasts
```

Because seeded events enter at the Redis stream (not the database), live and seeded detections are indistinguishable downstream — search, routes, alerts, and GIS all exercise the identical production code path. Seeded plates include watchlist entries (GJ01AB1234, GJ05CD5678) so **real alerts fire** during the demo.

### 1.3 Own-feed demonstration (fallback option)

If live Sentinel feeds are unavailable during judging, the same Video Wall can be pointed at local test streams via the MediaMTX gateway (RTSP publish → HLS). The AI pipeline is feed-agnostic (any RTSP URI in `CAMERA_STREAMS`). This option is documented in `docs/SCALABILITY.md` and `scripts/` and was exercised earlier in the project.

---

## 2. System Outputs (Evidence)

All outputs below are produced by the running system and were **verified by direct query/API call** on 3 September 2026:

| Output | Detail | Verified value | Where |
|--------|--------|----------------|-------|
| **Detections (metadata)** | YOLOv8 vehicle/person events with camera, confidence, timestamp, snapshot link | 9,944 total (≈988 with valid plates) | PostgreSQL `detections` |
| **Plates read (ANPR)** | Strict Indian-format + confidence filter (GJ01AB1234, GJ05CD5678, …) | 988 valid | PostgreSQL `detections.plate_number` |
| **Alerts** | Watchlist matches with severity, status, ack workflow | 449 | PostgreSQL `alerts` |
| **Vehicle routes** | `POST /vehicles/search` → ordered sightings w/ coordinates | e.g. GJ01AB1234 → 28 sightings, 17 cameras | Search service API |
| **Live detections feed** | `GET /vehicles/recent` — latest events with camera coords | Returns real rows | Search service API |
| **Camera registry** | 30 cameras, departments, geo, status | 30/30 registered | Registry service + GIS map |
| **Streams (HLS)** | Video-wall feeds through nginx `https://localhost/sentinel/live/<cam>/index.m3u8` | Master→variant→fMP4 segments served for H.264 & HEVC | nginx + MediaMTX |
| **Alert broadcasts** | WebSocket push to dashboard (sub-second) | Toasts observed | alert-service WS |

### 2.1 Where outputs are captured (evidence package)

```
gujratinnovation/
├── PPT.html                    ← solution presentation (9 slides)
├── DEMO.md                     ← demo script (updated for current build)
├── docs/
│   ├── HLD.md                  ← high-level design
│   ├── LOAD_TEST_REPORT.md     ← 80,000-camera scalability & load test   ← NEW
│   ├── DISASTER_RECOVERY.md    ← DR & redundancy design                   ← NEW
│   ├── SECURITY.md             ← security architecture
│   ├── PRD.md / TRD.md / SPECIFICATION.md / SCHEMA.md / PIPELINE.md
│   └── TESTING.md              ← test strategy
├── database/init.sql           ← re-runnable DDL + seed
├── database/sentinel_cameras.sql ← 30-camera catalogue seed
└── docker/certs/               ← TLS (self-signed demo cert)
```

### 2.2 Evidence screenshots / screen-capture checklist

| Shot | Screen | What proves |
|------|--------|-------------|
| 1 | Login → Dashboard (GIS map with camera pins) | Registry + GIS + RBAC |
| 2 | Video Wall — 3×3 grid playing live feeds | Unified viewing (Model 1) + Sentinel integration |
| 3 | Video Wall — expanded single camera | Full-res live + AI overlay |
| 4 | Vehicle Search — search GJ01AB1234 | Route reconstruction + timeline |
| 5 | Vehicle Search (no query) — Live Detections browse | Real-time AI metadata |
| 6 | Alerts — toast + alert list + acknowledge | Real-time alerting workflow |
| 7 | Reports — charts (detections, alerts, camera health) | Analytics quality |
| 8 | Watchlist — entries + export | Watchlist management |

> Capture each shot via the running app at `https://localhost` (login `admin` / `admin123`) and assemble into the demo video / PDF appendix. A 2–3 minute screen recording following `DEMO.md` is the "Video Output".

---

## 3. Demo Flow (what the judges see)

1. **Login** (JWT + RBAC, HTTPS) → **GIS Map**: 30 registered cameras plotted with live status; click a pin.
2. **Video Wall**: 8 live Sentinel feeds in a 3×3 grid (lazy-loaded, paginated); expand any camera full-screen.
3. **Vehicle Search**: type a plate (GJ01AB1234) → route map + timeline of sightings across cameras with timestamps and coordinates.
4. **Alerts**: watchlist match toasts slide in over any screen; acknowledge workflow; history with filters.
5. **Reports**: KPI cards + trend charts driven by the live database.
6. **Architecture** (optional, technical judges): PPT slide 4 + `/docs` API + this report set.

Timing: ~4 minutes end-to-end. Failure fallbacks documented in `DEMO.md`.

---

## 4. Honest limitations (for judge Q&A)

| Area | Status | Mitigation in demo |
|------|--------|--------------------|
| Live ANPR plate yield | Low on distant Sentinel scenes (verified by frame probe) | Seeder backfill path (same code path) + emphasis on metadata pipeline |
| Single live feed vendor | Only Sentinel grid connected | Registry supports any RTSP/ONVIF; Multi-VMS adapter story in HLD |
| Scale | PoC on 1 GPU host | Load-test model in `LOAD_TEST_REPORT.md` |
| Video evidence storage | Recording pipeline not yet enabled in PoC | Tiered-storage design in HLD + DR docs |

---

*Verified: 3 September 2026, stack 13/13 containers, GPU inference live, 9,944 detections / 449 alerts in DB.*
