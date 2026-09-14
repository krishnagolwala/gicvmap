# Disaster Recovery & Redundancy Design
## GICVMAP — Resilience, Backup and Recovery Architecture

**Version:** 1.0 (PoC / Hackathon build) · **Date:** 3 September 2026
**Scope:** Companion deliverable to the HLD — describes how the Gujarat Integrated CCTV Video Management & Analytics Platform survives component, host, and site failures.

---

## 1. Failure Model (what can break)

The platform is decomposed so that no single component holds the entire system. The blast radius of each failure class:

| # | Failure | Components affected | Impact if unprotected | Recovery mechanism (this design) |
|---|---------|--------------------|-----------------------|----------------------------------|
| F1 | Container crash (bug, OOM) | One microservice | Feature outage | `restart: unless-stopped` → auto-restart in <10 s |
| F2 | Host OOM / memory pressure | Several heavy services | Partial or full outage | Per-service memory caps + host headroom + auto-restart |
| F3 | Host / Docker engine loss | Entire single-node stack | Full outage | Documented rebuild-from-backup runbook (Section 6) |
| F4 | PostgreSQL data loss / corruption | Detections, alerts, watchlist, registry, users | **Irrecoverable analytic history** | Automated nightly `pg_dump` + WAL/point-in-time recovery path (Section 4) |
| F5 | Redis loss | Event stream backlog, cache | Missed alert correlation during gap | Replayed from DB on restart; alert worker tolerates loss (Section 5) |
| F6 | MinIO loss | Snapshots / object evidence | Evidence loss | Snapshot objects are re-derivable metadata; lifecycle policy + replication (Section 4.3) |
| F7 | Sentinel upstream feed loss | Live video + AI ingestion | No live footage | MediaMTX + AI auto-reconnect with exponential backoff (2 s → 30 s cap) |
| F8 | Certificate expiry | HTTPS login | Browser security errors | Calendar-monitored cert rotation runbook |
| F9 | Region / DC loss (production) | Everything | State-wide outage | Multi-region design (Section 7) — active-passive |

---

## 2. Redundancy in the Current Deployment (as-built)

### 2.1 Process-level redundancy (single Docker host)

All 13 containers carry an **auto-restart policy** (`restart: unless-stopped`), added to the compose file so the stack self-heals after any crash, Docker-engine restart, or WSL2 VM memory reclaim event:

```yaml
# docker-compose.yml (excerpt — every service)
services:
  postgres:
    restart: unless-stopped
  ai-service:
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 2304M        # bounded so one spike cannot take the VM down
```

Bounded memory caps (total ≈ 7.5 GB of *limits*, ≈ 2.4 GB of *actual steady-state usage* inside a 4.8 GiB VM) mean an OOM event kills only the largest offender — which then restarts itself — instead of cascading across the stack.

### 2.2 Durable state (volumes)

| State | Where | Persistence |
|-------|-------|-------------|
| PostgreSQL (all relational data) | `postgres_data` volume | Durable across container recreation |
| Redis AOF (stream backlog) | `redis_data` volume | `appendonly yes` — survives restart |
| MinIO objects (snapshots) | `minio_data` volume | Durable across container recreation |
| Config / TLS certs | `docker/`, `stream-gateway/`, `.env` on host | In git (excluding secrets) |

### 2.3 Health & dependency ordering

- `postgres` and `redis` expose `healthcheck`s; downstream services use `depends_on: condition: service_healthy` so no service starts against a dead dependency.
- The alert worker and AI service re-read Redis/Postgres connections on demand; transient connection failures during startup are retried rather than fatal.
- Nginx depends on service containers and re-resolves names at start; the stack can be started in any order and recovers via restart policy.

### 2.4 Feed redundancy (Sentinel RTSP)

Each camera URL is consumed **twice** through independent paths:
1. **MediaMTX** (relay/HLS for the Video Wall) — pulls the upstream RTSP per configured path.
2. **AI service** (YOLO/OCR) — opens its own client connection.

Both clients follow the Sentinel integrator rules: TCP transport forced, exponential backoff reconnect (≈2 s → 30 s cap), join-time decoder warnings treated as non-fatal. **A feed failure therefore never takes down the platform** — only that camera shows offline until upstream recovers.

---

## 3. Backup Strategy

### 3.1 What is backed up

| Asset | Cadence | Method |
|-------|---------|--------|
| PostgreSQL — full dump | Nightly 02:00 IST | `pg_dump -Fc` (custom format) → MinIO + host |
| PostgreSQL — WAL archive | Continuous (production) | `archive_command` to MinIO (S3) or NAS |
| Redis stream backlog | Not backed up (by design) | Streams are a transient buffer; replayable from DB |
| MinIO snapshots | Lifecycle-managed | Versioning on; 30-day expiry, no hard delete first 7 days |
| `.env`, TLS certs, compose | Every change | Git (secrets externalised/encrypted for production) |
| Camera registry seed | On change | `database/*.sql` in git — re-runnable |

### 3.2 Nightly pg_dump (implementable on this host)

```bash
# host cron / Task Scheduler — run nightly at 02:00
docker exec gicvmap-postgres pg_dump -U gicvmap_admin -Fc gicvmap \
  > /backups/gicvmap_$(date +\%F).dump

# retention: keep 14 daily + 4 weekly
```

Restore drill:
```bash
docker exec -i gicvmap-postgres pg_restore -U gicvmap_admin -d gicvmap \
  < /backups/gicvmap_2026-09-03.dump
```

> **Hackathon runbook note:** a single `backup.sh` + Task Scheduler entry covers F4 for the demo environment. See `scripts/` in the repo — wire it before submission so the "successful test case" can include a demonstrated restore.

---

## 4. Recovery Objectives & Procedures

### 4.1 RPO / RTO targets

| Tier | Scope | RPO (max data loss) | RTO (max downtime) |
|------|-------|---------------------|--------------------|
| T1 | Single container crash | 0 (no loss) | < 1 min (auto-restart) |
| T2 | Feed loss | 0 | seconds–2 min (backoff reconnect) |
| T3 | Postgres corruption / host loss | 24 h (nightly dump) / minutes (WAL) | 30–60 min (restore runbook) |
| T4 | Whole single-node host loss | 24 h | 2–4 h (rebuild stack from git + images + restore) |
| T5 (production) | Region loss | minutes (cross-region replication) | < 1 h (active-passive failover) |

### 4.2 Restore runbook — full stack loss (F3/F4 worst case)

```
1. Reinstall Docker Desktop (or bring up new host)
2. cd gujratinnovation && git pull
3. cp .env.example .env  → fill secrets
4. docker compose up -d            # images rebuild from Dockerfiles; DB/volumes recreated
5. Restore latest pg_dump          # pg_restore (Section 3.2)
6. docker compose restart nginx    # re-resolve upstream container IPs
7. Verify: login, /api/v1/registry/cameras, detection counts match pre-loss baseline
```

### 4.3 Object-store (snapshot/evidence) recovery

- MinIO is **versioned**; accidental overwrites are revertible via `mc`.
- Snapshot URLs stored in the `detections` table are the pointers of record — if an object is lost, the row remains and the evidence is flagged for re-capture rather than silently missing.
- Production: MinIO erasure-coding (EC:4) across 4+ nodes survives concurrent disk/node loss.

---

## 5. Event-Bus (Redis) Failure Semantics

The alert pipeline (`AI → Redis Stream detection_events → alert worker → watchlist match → alerts + WebSocket`) treats Redis as a **transient bus, not a store of record**:

- If Redis is down at detection time, the AI service retries the publish; the worker re-reads from the last acknowledged ID on reconnect (`XREADGROUP` with last-delivered ID), so **no event is silently dropped** once Redis returns.
- The WebSocket broadcast layer auto-reconnects client-side (`useAlertWebSocket`), so operators re-sync to the alert feed automatically.
- Alerts and detections are persisted in PostgreSQL — the durable truth — independent of Redis.

---

## 6. Security of Backups (aligned with Security Architecture)

- Backups contain PII-equivalent data (plates, camera metadata): encrypted at rest on the backup volume (`age`/`gpg` in production), access restricted to the `gicvmap_admin` service account.
- Restore requires a separate privileged path (host shell), never an application API.
- TLS certificates and the Sentinel upstream credentials live in `.env` / host-mounted secrets — **never** in the git-tracked backup set.

---

## 7. Production (Statewide) Redundancy Design

Extrapolation of the same principles to 80,000 cameras:

```
┌────────────── Regional Edge (per district / 4,000 cameras) ──────────────┐
│  MediaMTX ×2 (active/active)   GPU inference pool ×20 (N+1)              │
│  Edge PG replica · Edge MinIO (EC) · Local event bus (Kafka broker)      │
└──────────────────────────────────┬───────────────────────────────────────┘
                                   │ replicated event + metadata bus (Kafka, 3 AZs)
┌──────────────────────────────────▼───────────────────────────────────────┐
│                        CENTRAL (Active)                                   │
│  Citus coordinator + shards (3 replicas, sync commit)                     │
│  Ceph/S3 evidence store (EC 8+4, cross-region geo-replication)            │
│  Command-centre services ×2 AZs behind NLB                                │
└───────────────────────────────────────────────────────────────────────────┘
                              │ async replication (warm standby, WAL)
┌─────────────────────────────▼────────────────────────────────────────────┐
│                        CENTRAL (Standby / DR)                             │
│  Full stack warm — promoted via documented playbook (RTO < 1 h)           │
└───────────────────────────────────────────────────────────────────────────┘
```

**Redundancy rules carried into production:**
1. Every stateful tier ≥2 replicas; control-plane stateless (N+1).
2. Kafka brokers across ≥3 failure domains; `min.insync.replicas=2`.
3. PostgreSQL synchronous quorum in-region + async WAL to DR region.
4. GPU inference pools sized N+1 per region so a node loss degrades latency, not coverage.
5. Camera feeds dual-homed (primary + secondary path) where upstreams permit.

---

## 8. DR Test Log (to be completed before submission)

| Date | Test | Result |
|------|------|--------|
| 2026-09-03 | Container crash recovery (killed AI service) | ✅ Auto-restarted via policy; pipeline resumed |
| 2026-09-03 | Full-stack recovery after Docker VM memory event (all 13 exited) | ✅ `docker compose up -d` restored 13/13 |
| _pending_ | Nightly pg_dump + restore drill | Run before shortlisting |
| _pending_ | Nginx cold start after full recreate | Run before shortlisting |

---

*Relevant files: `docker-compose.yml` (restart policies + memory caps), `scripts/` (backup), `database/init.sql` + `sentinel_cameras.sql` (re-runnable seed), `.wslconfig` (host memory sizing).*
