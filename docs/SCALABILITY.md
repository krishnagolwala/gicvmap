# Scalability & Deployment Plan
## GICVMAP — From PoC to Statewide Scale

---

## 1. Scaling Dimensions

### 1.1 Scale Progression

| Dimension | PoC (50 cameras) | Pilot (500 cameras) | Regional (10,000 cameras) | Statewide (80,000 cameras) |
|-----------|-----------------|---------------------|--------------------------|---------------------------|
| Ingestion | 1 MediaMTX | 3 MediaMTX | 10 MediaMTX (per region) | 80+ edge nodes + central |
| AI Compute | 1 CPU/GPU worker | 5 GPU workers | 50 GPU workers (regional) | 400+ GPU workers |
| Message Bus | Redis Streams (1 node) | Redis Cluster (3 nodes) | Kafka (3 brokers) | Kafka (20+ brokers) |
| Database | Single PostgreSQL | PG + Read Replica | Sharded PG (Citus) | Citus + Elasticsearch |
| Storage | MinIO (1 node) | MinIO (4 nodes) | Ceph cluster | Distributed Ceph/S3 |
| Network | Localhost | Regional DC | MPLS backbone | Statewide MPLS + CDN |
| Frontend | Single React app | CDN-fronted | Multi-tenant | CDN + edge caching |
| Users | 5-10 | 50 | 500 | 5,000+ |

### 1.2 Horizontal Scaling Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                    SCALING ARCHITECTURE                           │
│                                                                   │
│  LAYER 1: EDGE (Per District)                                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Edge Node (per district/camera cluster)                   │   │
│  │ - Local AI inference (reduce bandwidth)                   │   │
│  │ - Local storage (7 days hot)                              │   │
│  │ - Only metadata + alerts sent to central                  │   │
│  │ - Camera count per node: 100-500                          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  LAYER 2: REGIONAL (Per Range/Division)                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Regional Cluster                                          │   │
│  │ - Kafka cluster (3+ brokers)                              │   │
│  │ - PostgreSQL (primary + 2 replicas)                       │   │
│  │ - AI inference cluster (5-20 GPU nodes)                   │   │
│  │ - MinIO distributed (4+ nodes)                            │   │
│  │ - Cameras per region: 5,000-15,000                        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  LAYER 3: CENTRAL (Gandhinagar)                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Central Platform                                          │   │
│  │ - Aggregated dashboard (all regions)                      │   │
│  │ - Cross-region search and alerts                          │   │
│  │ - PostgreSQL (Citus distributed, metadata only)           │   │
│  │ - Elasticsearch (search-heavy queries)                    │   │
│  │ - Central command center display                          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Infrastructure Sizing

### 2.1 PoC Infrastructure

| Component | Specification | Justification |
|-----------|--------------|---------------|
| Host Machine | 8+ vCPU, 32GB RAM, 500GB SSD | Docker Compose stack |
| Optional GPU | NVIDIA GTX 1650+ | Faster YOLO inference |
| Network | 100 Mbps+ | RTSP stream ingestion |
| OS | Ubuntu 22.04 / Windows 11 | Docker Desktop support |

### 2.2 Per-Camera Resource Requirements

| Resource | Without GPU | With GPU |
|----------|------------|----------|
| CPU cores | 0.1-0.2 per camera | 0.05 per camera |
| RAM | 100-200 MB per camera | 50-100 MB per camera |
| Storage (snapshots) | 50-100 MB/day per camera | 50-100 MB/day per camera |
| Network (inbound) | 2-8 Mbps per camera (RTSP) | 2-8 Mbps per camera |
| Network (outbound) | 10-50 KB/s per camera (metadata) | 10-50 KB/s per camera |

### 2.3 Statewide Sizing (80,000 Cameras)

| Resource | Calculation | Total |
|----------|------------|-------|
| Edge AI nodes | 80,000 cameras ÷ 200 cameras/node | 400 nodes |
| Regional Kafka brokers | 3 per region × 5 regions | 15 brokers |
| Regional PostgreSQL | Primary + 2 replicas × 5 regions | 15 instances |
| Regional GPU servers | 10 per region × 5 regions | 50 GPU servers |
| Storage (7 days hot) | 80,000 × 100MB/day × 7 | ~5.6 TB |
| Storage (90 days cold) | 80,000 × 10MB/day × 90 | ~72 TB |
| Central dashboard users | 5,000 concurrent | CDN-backed |

---

## 3. Database Scaling

### 3.1 Partitioning Strategy

```sql
-- Partition detections table by month
CREATE TABLE detections (
    id BIGSERIAL,
    camera_id UUID,
    detected_at TIMESTAMP NOT NULL,
    ...
) PARTITION BY RANGE (detected_at);

-- Create monthly partitions
CREATE TABLE detections_y2026m09 PARTITION OF detections
    FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');

CREATE TABLE detections_y2026m10 PARTITION OF detections
    FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');

-- Auto-create partitions (pg_partman)
-- SELECT partman.create_parent('public.detections', 'detected_at', 'native', 'monthly');
```

### 3.2 Read Replicas

```
                    ┌──────────────┐
                    │   Primary    │
                    │  PostgreSQL  │
                    │  (Writes)    │
                    └──────┬───────┘
                           │ Streaming
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ Replica 1│ │ Replica 2│ │ Replica 3│
        │ (Reads)  │ │ (Reads)  │ │ (Reads)  │
        └──────────┘ └──────────┘ └──────────┘
              │            │            │
              ▼            ▼            ▼
        Search Svc   Dashboard   Analytics
```

### 3.3 Elasticsearch Integration (Statewide)

```json
// Elasticsearch index mapping for detections
{
  "mappings": {
    "properties": {
      "detection_id": { "type": "long" },
      "camera_id": { "type": "keyword" },
      "plate_number": { "type": "keyword" },
      "detected_at": { "type": "date" },
      "detection_type": { "type": "keyword" },
      "confidence": { "type": "float" },
      "location": { "type": "geo_point" }
    }
  }
}
```

---

## 4. Network Planning

### 4.1 Bandwidth Requirements

| Scenario | Per Camera | 50 Cameras | 80,000 Cameras |
|----------|-----------|------------|----------------|
| RTSP ingest (H.264 1080p) | 2-8 Mbps | 100-400 Mbps | N/A (edge processing) |
| Metadata + alerts | 10-50 KB/s | 0.5-2.5 Mbps | 800-4,000 Mbps |
| Snapshot storage | 50-100 MB/day | 2.5-5 GB/day | 4-8 TB/day |
| Dashboard video (WebRTC) | 2-4 Mbps | 100-200 Mbps | N/A (regional) |

### 4.2 Edge Computing Bandwidth Savings

```
Without Edge:
  80,000 cameras × 4 Mbps = 320 Gbps to central (IMPOSSIBLE)

With Edge:
  80,000 cameras × 4 Mbps = 320 Gbps to edge nodes (LOCAL)
  Edge nodes × 50 KB/s = 4 Mbps metadata to central (FEASIBLE)
  
  Bandwidth reduction: 99.99%
```

---

## 5. Disaster Recovery

### 5.1 DR Strategy (Production)

| Aspect | Strategy |
|--------|----------|
| Database | Streaming replication to standby datacenter |
| Object Storage | Cross-region replication (MinIO/S3) |
| Message Queue | Kafka mirror maker for cross-DC replication |
| RPO (Recovery Point Objective) | 15 minutes |
| RTO (Recovery Time Objective) | 4 hours |
| Backup Schedule | Daily full, hourly incremental |
| Backup Retention | 30 days |

### 5.2 Backup Commands

```bash
# PostgreSQL backup
pg_dump -h localhost -U gicvmap_admin gicvmap | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz

# MinIO backup
mc mirror --overwrite minio/detections /backup/minio/detections/

# Redis backup
redis-cli BGSAVE
```

---

## 6. Cost-Benefit Analysis

### 6.1 PoC Cost (Hackathon)

| Item | Cost |
|------|------|
| Cloud VM (8 vCPU, 32GB, 1 month) | ~₹5,000-10,000 |
| Domain + SSL (optional) | ~₹1,000 |
| Developer time (14 days) | Hackathon volunteer |
| Software | ₹0 (all open-source) |
| **Total PoC** | **~₹5,000-11,000** |

### 6.2 Statewide Cost Estimate (Annual)

| Component | Annual Cost (₹) |
|-----------|-----------------|
| Edge AI hardware (400 nodes) | ₹4,00,00,000 |
| Regional servers (5 regions) | ₹1,50,00,000 |
| Central infrastructure | ₹50,00,000 |
| Network (MPLS backbone) | ₹1,00,00,000 |
| Storage (PB-scale) | ₹75,00,000 |
| Operations & maintenance | ₹1,00,00,000 |
| **Total Annual** | **~₹8,75,00,000** |

### 6.3 Operational Benefits

| Benefit | Impact |
|---------|--------|
| Proactive crime detection | Reduced response time from hours to seconds |
| Cross-departmental visibility | Unified command center vs 26 separate systems |
| Automated vehicle tracking | Manual investigation time reduced by 80% |
| Watchlist alerting | Real-time detection of wanted vehicles/persons |
| Evidence documentation | Automated report generation for court |

---

*End of Scalability & Deployment Plan*
