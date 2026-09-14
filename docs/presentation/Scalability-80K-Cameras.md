# Scalability Strategy — 80,000 Cameras Statewide

> **GICVMAP — Gujarat Police Innovation Hackathon 2026**
> **Document Type:** Scalability, Infrastructure & Statewide Rollout Plan
> **Date:** 15 September 2026

---

## 1. Executive Summary

GICVMAP is designed to scale from the current PoC (30 cameras) to **80,000 cameras** across all 26 Gujarat government departments. This document presents the hardware, software, network, storage, and operational strategy for statewide deployment.

### Scaling Targets

| Dimension | PoC (Current) | Pilot (500) | Regional (10,000) | Statewide (80,000) |
|-----------|--------------|-------------|-------------------|-------------------|
| Cameras | 30 | 500 | 10,000 | 80,000 |
| Users | 5 | 50 | 500 | 5,000+ |
| Ingestion | 1 MediaMTX | 3 MediaMTX | 10 edge nodes | 1,600 edge + 6 regions |
| AI Compute | 1 CPU | 5 GPU | 50 GPU | 1,600 GPU equiv |
| Database | 1 PostgreSQL | 1 PG + 1 replica | Citus 10-node | Citus 20-node |
| Storage | 50 GB | 5 TB | 500 TB | 52 PB |
| Message Bus | Redis 1-node | Redis 3-node | Kafka 6-broker | Kafka 20-broker |

---

## 2. Three-Tier Architecture

### 2.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    TIER 3: STATE NOC (Gandhinagar)              │
│                                                                 │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐              │
│  │ Central App │ │ Citus DB    │ │ Kafka       │              │
│  │ (K8s, 10    │ │ (20-node    │ │ (20-broker  │              │
│  │  nodes)     │ │  cluster)   │ │  cluster)   │              │
│  └─────────────┘ └─────────────┘ └─────────────┘              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐              │
│  │ Elasticsearch│ │ Central     │ │ DR Site     │              │
│  │ (6-node)    │ │ Storage     │ │ (2nd DC)    │              │
│  └─────────────┘ └─────────────┘ └─────────────┘              │
│                        ↑                                        │
│              MPLS/SD-WAN Backbone (10 Gbps)                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        ↓                    ↓                    ↓
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│  TIER 2:      │  │  TIER 2:      │  │  TIER 2:      │
│  REGIONAL     │  │  REGIONAL     │  │  REGIONAL     │
│  CLUSTER      │  │  CLUSTER      │  │  CLUSTER      │
│  (North)      │  │  (Central)    │  │  (South)      │
│               │  │               │  │               │
│ 5-20 GPU nodes│  │ 5-20 GPU nodes│  │ 5-20 GPU nodes│
│ PG primary+2  │  │ PG primary+2  │  │ PG primary+2  │
│ Kafka 3-broker│  │ Kafka 3-broker│  │ Kafka 3-broker│
│ MinIO 4-node  │  │ MinIO 4-node  │  │ MinIO 4-node  │
│ 15K cameras   │  │ 15K cameras   │  │ 15K cameras   │
└───────┬───────┘  └───────┬───────┘  └───────┬───────┘
        │                  │                  │
   ┌────┼────┐        ┌────┼────┐        ┌────┼────┐
   ↓    ↓    ↓        ↓    ↓    ↓        ↓    ↓    ↓
┌─────┐┌─────┐┌─────┐┌─────┐┌─────┐┌─────┐┌─────┐┌─────┐
│Edge ││Edge ││Edge ││Edge ││Edge ││Edge ││Edge ││Edge │
│ GW  ││ GW  ││ GW  ││ GW  ││ GW  ││ GW  ││ GW  ││ GW  │
│50-  ││50-  ││50-  ││50-  ││50-  ││50-  ││50-  ││50-  │
│500  ││500  ││500  ││500  ││500  ││500  ││500  ││500  │
│cams ││cams ││cams ││cams ││cams ││cams ││cams ││cams │
└─────┘└─────┘└─────┘└─────┘└─────┘└─────┘└─────┘└─────┘
│  TIER 1: EDGE GATEWAYS (District/Distribution Level)          │
│  - Local AI inference (YOLO + OCR)                            │
│  - Local RTSP relay (MediaMTX)                                │
│  - Local storage (7-day hot cache)                            │
│  - Only metadata + alerts sent upstream                        │
│  - Auto-reconnect, exponential backoff                        │
└───────────────────────────────────────────────────────────────┘
```

### 2.2 Tier Responsibilities

| Tier | Location | Role | Cameras | Compute |
|------|----------|------|---------|---------|
| **Tier 1: Edge** | District sites | Ingest, relay, local AI | 50-500 per node | CPU + optional GPU |
| **Tier 2: Regional** | Range HQ (6 regions) | Aggregation, analytics, storage | 10,000-15,000 | GPU cluster |
| **Tier 3: Central** | Gandhinagar NOC | Cross-region search, command view | 80,000 (aggregated) | Kubernetes |

---

## 3. Hardware Requirements

### 3.1 Edge Gateway (Per District)

| Component | Specification | Qty per Gateway | Cost |
|-----------|--------------|-----------------|------|
| Server | Intel Xeon, 32GB RAM, 1TB NVMe | 1 | ₹1,50,000 |
| GPU (optional) | NVIDIA T4 or Jetson Orin | 1 | ₹1,50,000 |
| Network | Dual GbE, 4G LTE backup | 1 | ₹15,000 |
| UPS | 2-hour battery backup | 1 | ₹25,000 |
| **Total per edge gateway** | | | **₹3,40,000** |

**Total edge gateways needed:** 1,600 (50 cameras each)
**Total edge cost:** ₹54.4 Crore

### 3.2 Regional Cluster (Per Region)

| Component | Specification | Qty | Cost |
|-----------|--------------|-----|------|
| GPU Server | 4× NVIDIA A100 80GB, 512GB RAM, 10TB NVMe | 5 | ₹2,00,00,000 |
| Database Server | 2× Xeon Platinum, 256GB RAM, 20TB SSD | 3 | ₹45,00,000 |
| Kafka Broker | 2× Xeon, 128GB RAM, 4TB NVMe | 3 | ₹30,00,000 |
| Storage (MinIO) | 12× 20TB HDD, 4× NVMe cache | 1 | ₹25,00,000 |
| Network Switch | 25GbE spine-leaf | 2 | ₹10,00,000 |
| Rack + Power | Server rack, UPS, cooling | 1 | ₹8,00,000 |
| **Total per region** | | | **₹1,18,00,000** |

**Total regional clusters:** 6
**Total regional cost:** ₹70.8 Crore

### 3.3 State NOC (Gandhinagar)

| Component | Specification | Qty | Cost |
|-----------|--------------|-----|------|
| Kubernetes Nodes | 2× Xeon, 256GB RAM, 2TB NVMe | 10 | ₹50,00,000 |
| Citus DB Nodes | 4× Xeon Platinum, 512GB RAM, 50TB SSD | 20 | ₹4,00,00,000 |
| Kafka Cluster | 4× Xeon, 256GB RAM, 10TB NVMe | 20 | ₹2,00,00,000 |
| Elasticsearch | 2× Xeon, 256GB RAM, 10TB NVMe | 6 | ₹60,00,000 |
| Central Storage | 5PB object storage | 1 | ₹2,50,00,000 |
| Network | 10GbE core, BGP peering | 1 | ₹50,00,000 |
| DR Site | Mirror of primary (2nd DC) | 1 | ₹8,00,00,000 |
| NOC Facility | Raised floor, cooling, power | 1 | ₹1,00,00,000 |
| **Total State NOC** | | | **₹18,10,00,000** |

### 3.4 Total Infrastructure Cost

| Tier | Cost | Percentage |
|------|------|-----------|
| Edge (1,600 gateways) | ₹54.4 Cr | 32% |
| Regional (6 clusters) | ₹70.8 Cr | 42% |
| State NOC | ₹18.1 Cr | 11% |
| Software & Development | ₹12.0 Cr | 7% |
| Network (MPLS/SD-WAN) | ₹10.0 Cr | 6% |
| Contingency (2%) | ₹3.3 Cr | 2% |
| **Total** | **₹168.6 Cr** | **100%** |

---

## 4. Network & Bandwidth Planning

### 4.1 Bandwidth Requirements

| Component | Per Camera | Total (80K) | Notes |
|-----------|-----------|-------------|-------|
| Raw RTSP (1080p) | 4 Mbps | 320 Gbps | Before edge processing |
| After edge AI (metadata only) | 50 Kbps | 4 Gbps | 99% reduction |
| Alert stream | 1 Kbps | 80 Mbps | Redis/Kafka |
| Dashboard (HLS) | 2 Mbps | 200 Mbps | 100 concurrent viewers |
| **Total core bandwidth** | | **~4.3 Gbps** | After edge optimization |

### 4.2 Edge Processing Reduces Core Load

```
Without Edge:  80,000 × 4 Mbps = 320 Gbps (impossible)
With Edge:     80,000 × 50 Kbps = 4 Gbps (feasible on MPLS)

Edge processing:
- YOLO inference runs locally → only metadata sent upstream
- HLS streams served locally → only consumed by local viewers
- Alerts sent upstream in real-time → small payload
- Detections batched and sent every 5 seconds → reduced API calls
```

### 4.3 Network Architecture

| Segment | Technology | Bandwidth | Cost/Year |
|---------|-----------|-----------|-----------|
| Edge → Regional | MPLS / leased line | 100 Mbps per edge | ₹60,000/edge |
| Regional → Central | MPLS / SD-WAN | 10 Gbps | ₹12,00,000/region |
| Central → NOC | Fiber backbone | 40 Gbps | ₹24,00,000 |
| DR Link | Dark fiber / MPLS | 10 Gbps | ₹12,00,000 |
| **Total network (annual)** | | | **₹115 Cr** |

---

## 5. Storage & Retention Strategy

### 5.1 Three-Tier Storage

| Tier | Type | Duration | Cost/GB/Month | Total (80K cams) |
|------|------|----------|---------------|------------------|
| **Hot** | NVMe SSD | 2 days | ₹8 | 13.3 PB × ₹8 = ₹10.6 Cr/mo |
| **Warm** | HDD (SAS) | 5 days | ₹1.5 | 33.3 PB × ₹1.5 = ₹5.0 Cr/mo |
| **Cold** | Object (S3) | 8 days | ₹0.3 | 53.3 PB × ₹0.3 = ₹1.6 Cr/mo |
| **Archive** | Tape/Glacier | 30 days | ₹0.05 | 200 PB × ₹0.05 = ₹1.0 Cr/mo |

### 5.2 Storage Calculation

```
Per camera (1080p, H.264, 4 Mbps average):
  Per day:   4 Mbps × 3600 × 24 / 8 = 43.2 GB/day
  15 days:   648 GB per camera
  80K cameras: 51.84 PB total

With edge processing (metadata + keyframes only):
  Per day:   2 GB/day (metadata + snapshots + keyframes)
  15 days:   30 GB per camera
  80K cameras: 2.4 PB total (96% reduction)
```

### 5.3 Lifecycle Management

```
Day 0-2:   HOT (NVMe) — instant playback, AI reprocessing
Day 3-7:   WARM (HDD) — playback within seconds
Day 8-15:  COLD (S3) — playback within minutes
Day 16-90: ARCHIVE (Glacier) — retrieval on demand
Day 90+:   DELETED (unless flagged as evidence)
```

---

## 6. AI Processing Capacity

### 6.1 GPU Sizing

| GPU Model | Cameras per GPU | Inference Time | Cost |
|-----------|----------------|----------------|------|
| NVIDIA T4 (edge) | 8-10 | 100ms/frame | ₹2,00,000 |
| NVIDIA A100 (regional) | 50-80 | 30ms/frame | ₹15,00,000 |
| NVIDIA H100 (future) | 150-200 | 10ms/frame | ₹50,00,000 |

### 6.2 AI Compute Requirements

| Tier | Cameras | GPUs Needed | GPU Type |
|------|---------|-------------|----------|
| Edge (1,600 nodes) | 50 each | 1,600 (optional) | T4 or Jetson |
| Regional (6 clusters) | 15,000 each | 100 per cluster | A100 |
| **Total** | **80,000** | **700 A100 equiv** | |

### 6.3 Inference Throughput

```
Single A100:
- YOLOv8 nano: ~30 FPS (batch=1)
- EasyOCR: ~20 FPS (batch=1)
- Combined pipeline: ~15 FPS (with preprocessing)

Per camera at 2 FPS sampling:
- 15 FPS ÷ 2 FPS per camera = 7.5 cameras per GPU (conservative)
- With batching (batch=8): 15 FPS ÷ 0.25 FPS per camera = 60 cameras per GPU

80,000 cameras ÷ 60 per GPU = 1,333 A100 GPUs
With edge offloading: 80,000 × 0.1 (only 10% need regional) = 8,000 ÷ 60 = 134 A100 GPUs
```

---

## 7. Database Scaling

### 7.1 PostgreSQL with Citus (Distributed)

| Configuration | PoC | Pilot | Regional | Statewide |
|--------------|-----|-------|----------|-----------|
| Nodes | 1 | 2 | 10 | 20 |
| RAM per node | 16 GB | 64 GB | 256 GB | 512 GB |
| Storage per node | 100 GB | 2 TB | 10 TB | 50 TB |
| Total storage | 100 GB | 4 TB | 100 TB | 1 PB |
| Shard count | 1 | 8 | 200 | 1,000 |

### 7.2 Query Performance

| Query Type | PoC | Statewide (Citus) |
|-----------|-----|-------------------|
| Camera lookup by ID | <1ms | <5ms |
| Plate search | <50ms | <200ms |
| Route reconstruction | <500ms | <2s |
| Aggregated statistics | <1s | <5s |
| Full-text search | <100ms | <500ms (Elasticsearch) |

### 7.3 Elasticsearch for Search-Heavy Queries

| Data | Size (80K cams) | Index Strategy |
|------|-----------------|----------------|
| Detection events | 500M+ rows/day | Time-series index (daily) |
| Plate numbers | 50M+ unique | Dedicated plate index |
| Alert records | 10M+ rows | Alert index with severity |
| Audit logs | 100M+ rows/year | Compliance index |

---

## 8. Message Bus Scaling

### 8.1 Redis → Kafka Migration

| Metric | Redis (PoC) | Kafka (Statewide) |
|--------|------------|-------------------|
| Throughput | 100K msg/s | 10M msg/s |
| Retention | Memory only | Disk (configurable) |
| Replay | No | Yes (offset-based) |
| Partitioning | No | Yes (topic partitioning) |
| Consumer groups | Limited | Unlimited |
| Cost | Low | Medium |

### 8.2 Kafka Cluster Sizing

| Configuration | Pilot | Regional | Statewide |
|--------------|-------|----------|-----------|
| Brokers | 3 | 6 | 20 |
| Partitions per topic | 12 | 100 | 1,000 |
| Retention | 24 hours | 7 days | 30 days |
| Replication factor | 2 | 3 | 3 |
| Throughput | 10K msg/s | 1M msg/s | 10M msg/s |

---

## 9. Disaster Recovery Strategy

### 9.1 DR Architecture

```
PRIMARY (Gandhinagar NOC)          DR SITE (2nd Data Center)
┌──────────────────────┐           ┌──────────────────────┐
│ Application (K8s)    │ ←→ sync → │ Application (K8s)    │
│ Database (Citus)     │ ←→ sync → │ Database (Citus)     │
│ Kafka (async)        │ ←→ mirror →│ Kafka (mirror)       │
│ Storage (S3)         │ ←→ replicate →│ Storage (S3)       │
│ Elasticsearch        │ ←→ snapshot →│ Elasticsearch       │
└──────────────────────┘           └──────────────────────┘
        ↑                                    ↑
        └──── Automatic failover (RTO <15min) ────┘
```

### 9.2 DR Metrics

| Metric | Target | Method |
|--------|--------|--------|
| RPO (Recovery Point) | <5 minutes | Async replication + WAL shipping |
| RTO (Recovery Time) | <15 minutes | Automated failover, health checks |
| Backup frequency | Every 6 hours | pg_basebackup + WAL archiving |
| Retention | 30 days | Automated cleanup |
| DR testing | Monthly | Automated failover drill |

### 9.3 High Availability

| Component | HA Strategy | Redundancy |
|-----------|------------|------------|
| Application | Kubernetes pods (3+ replicas) | N+2 |
| Database | Citus primary + 2 replicas per shard | 3-way |
| Kafka | Replication factor 3 | 3-way |
| Storage | Erasure coding (EC 8+4) | 1.5× |
| Edge gateways | Dual-uplink (MPLS + 4G LTE) | 2 paths |

---

## 10. Statewide Rollout Plan

### 10.1 Phased Timeline

| Phase | Timeline | Scope | Investment |
|-------|----------|-------|------------|
| **Phase 1: PoC** | Month 1-2 | 30 cameras, Ahmedabad | ₹2.5L |
| **Phase 2: Pilot** | Month 3-6 | 500 cameras, 1 district | ₹97L |
| **Phase 3: Regional** | Month 7-12 | 10,000 cameras, 2 regions | ₹40 Cr |
| **Phase 4: Expansion** | Month 13-24 | 40,000 cameras, 4 regions | ₹60 Cr |
| **Phase 5: Statewide** | Month 25-36 | 80,000 cameras, all regions | ₹68.6 Cr |

### 10.2 Regional Deployment Order

| Order | Region | Cameras | Departments | Timeline |
|-------|--------|---------|-------------|----------|
| 1 | Ahmedabad Range | 15,000 | Police, Municipal, RTO | Month 7-9 |
| 2 | Rajkot Range | 12,000 | Police, Municipal | Month 10-12 |
| 3 | Vadodara Range | 12,000 | Police, Municipal, RTO | Month 13-15 |
| 4 | Surat Range | 15,000 | Police, Municipal | Month 16-18 |
| 5 | North Gujarat | 13,000 | Police, Food & Supply | Month 19-21 |
| 6 | Saurashtra & Kutch | 13,000 | Police, Tourism | Month 22-24 |

### 10.3 Staffing Plan

| Role | PoC | Pilot | Regional | Statewide |
|------|-----|-------|----------|-----------|
| Developers | 4 | 6 | 12 | 20 |
| DevOps/SRE | 0 | 1 | 4 | 8 |
| AI/ML Engineers | 1 | 2 | 6 | 12 |
| Support Staff | 0 | 1 | 6 | 20 |
| Training | 0 | 1 | 3 | 10 |
| **Total** | **5** | **11** | **31** | **70** |

---

## 11. Monitoring & Operations

### 11.1 Health Monitoring Stack

| Component | Tool | Metrics |
|-----------|------|---------|
| Application | Prometheus + Grafana | Request rate, latency, errors |
| Database | pg_stat + Citus monitor | QPS, connections, replication lag |
| Kafka | Confluent Control Center | Throughput, lag, consumer groups |
| AI Inference | Custom dashboard | FPS, GPU utilization, queue depth |
| Network | SNMP + NetFlow | Bandwidth, latency, packet loss |
| Storage | MinIO metrics + OS monitoring | IOPS, capacity, health |

### 11.2 Alerting Thresholds

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| CPU usage | >70% | >90% | Scale horizontally |
| Memory usage | >80% | >95% | Add nodes |
| Disk usage | >75% | >90% | Expand storage |
| Database connections | >80% pool | >95% pool | Add replicas |
| Kafka consumer lag | >10K messages | >100K messages | Add consumers |
| AI inference queue | >50 frames | >200 frames | Add GPU nodes |

---

## 12. Security at Scale

| Control | Implementation |
|---------|---------------|
| Authentication | OAuth 2.0 + MFA for all users |
| Authorization | RBAC with department-level isolation |
| Encryption | TLS 1.3 in transit, AES-256 at rest |
| Audit | Every action logged to immutable audit trail |
| Network | VPN/MPLS for edge-to-regional, WAF at NOC |
| Compliance | Data retention policies, right-to-deletion |
| Penetration | Quarterly pen testing |
| Incident | 24/7 SOC with automated playbooks |

---

## 13. Conclusion

| Metric | Value |
|--------|-------|
| Target cameras | 80,000 |
| Total infrastructure cost | ₹168.6 Crore |
| Annual operating cost | ₹14.6 Crore |
| Edge-to-core bandwidth | 4.3 Gbps (after optimization) |
| Total storage | 2.4 PB (metadata) + 51.8 PB (video) |
| GPU capacity | 700 A100 equivalents |
| Database nodes | 20 (Citus distributed) |
| DR RPO | <5 minutes |
| DR RTO | <15 minutes |
| Rollout timeline | 36 months (5 phases) |
| Staff required | 70 (at full scale) |

**GICVMAP's three-tier architecture (Edge → Regional → Central) ensures that 80,000 cameras can be managed with manageable bandwidth, storage, and compute requirements. Edge processing reduces core load by 99%, making statewide deployment economically and technically feasible.**

---

**Prepared for:** Gujarat Police Innovation Hackathon 2026
**System:** GICVMAP — Gujarat Integrated CCTV Video Management & Analytics Platform
