# 26-Department Integration Strategy

> **GICVMAP — Gujarat Police Innovation Hackathon 2026**
> **Document Type:** Department Onboarding & Interoperability Framework
> **Date:** 15 September 2026

---

## 1. Overview

Gujarat operates **26 government departments** with independent CCTV ecosystems. This document presents the integration strategy for onboarding all departments onto GICVMAP without disrupting their existing infrastructure.

### Key Principle
> **"Connect, don't replace"** — Each department retains full control of their VMS, storage, and operations. GICVMAP acts as a unified analytics and viewing layer on top.

---

## 2. Department Inventory

### 2.1 Department Categories

| Category | Departments | Camera Count (Est.) | Priority |
|----------|------------|---------------------|----------|
| **Law Enforcement** | Home/Police, Home/Paramilitary | 25,000 | P0 — Critical |
| **Urban Governance** | Municipal Corporations (6 cities), Urban Development | 15,000 | P0 — Critical |
| **Transport** | RTO, State Transport | 12,000 | P1 — High |
| **Food & Supply** | Food & Civil Supplies | 5,000 | P1 — High |
| **Social Welfare** | Social Justice, Tribal Development, Women & Child | 4,000 | P2 — Medium |
| **Education** | Education Department, Universities | 6,000 | P2 — Medium |
| **Health** | Health & Family Welfare, Medical Services | 4,000 | P2 — Medium |
| **Infrastructure** | Roads & Buildings, Water Supply, Irrigation | 5,000 | P3 — Low |
| **Revenue** | Revenue Department, Land Records | 2,000 | P3 — Low |
| **Others** | Forest, Tourism, Sports, Industry, IT | 2,000 | P3 — Low |
| **Total** | **26 departments** | **~80,000** | |

### 2.2 Department-Wise Camera Types

| Department | Camera Types | Protocols | VMS Platforms |
|-----------|-------------|-----------|---------------|
| Police | IP (H.264/H.265), ANPR cameras | RTSP, ONVIF | Hikvision, Dahua, CP Plus |
| Municipal Corp | IP, PTZ, Traffic cameras | RTSP, vendor SDK | Milestone, Genetec |
| RTO | IP, Speed cameras, ALPR | RTSP, HTTP API | Custom |
| Food & Civil Supplies | IP, Fisheye | RTSP, ONVIF | Hikvision |
| Education | IP, Indoor cameras | RTSP | Dahua, Hikvision |
| Health | IP, Indoor cameras | RTSP | CP Plus |
| Roads & Buildings | IP, Traffic cameras | RTSP, ONVIF | Multiple vendors |

---

## 3. Integration Architecture

### 3.1 Adapter Pattern

GICVMAP uses an **adapter-based integration pattern** to connect heterogeneous systems:

```
Department VMS (any brand)
        ↓
┌─────────────────────────────────────┐
│         ADAPTER LAYER               │
│  ┌─────────┐ ┌─────────┐ ┌───────┐ │
│  │ RTSP    │ │ ONVIF   │ │ SDK   │ │
│  │ Adapter │ │ Adapter │ │Adapter│ │
│  └────┬────┘ └────┬────┘ └───┬───┘ │
│       └──────┬────┘──────────┘      │
│              ↓                       │
│      Protocol Normalizer             │
│      (统一 RTSP/HTTP)                │
└──────────────┬──────────────────────┘
               ↓
┌──────────────────────────────────────┐
│        UNIFIED STREAM GATEWAY        │
│     (MediaMTX + Load Balancer)       │
│                                      │
│  Source Pool → Transcode → Distribute│
└──────────────┬──────────────────────┘
               ↓
┌──────────────────────────────────────┐
│       ANALYTICS & STORAGE            │
│  AI Inference · PostgreSQL · Redis   │
└──────────────────────────────────────┘
```

### 3.2 Integration Tiers

| Tier | Department Type | Integration Method | Effort |
|------|----------------|-------------------|--------|
| **Tier 1** | Direct RTSP (Police, Municipal) | RTSP/TCP with credentials | 1 day per 100 cameras |
| **Tier 2** | ONVIF-compliant (RTO, Education) | ONVIF discovery + RTSP | 2 days per 100 cameras |
| **Tier 3** | Vendor SDK (Milestone, Genetec) | SDK adapter plugin | 5 days per 100 cameras |
| **Tier 4** | API-only (custom VMS) | REST/GraphQL adapter | 10 days per 100 cameras |
| **Tier 5** | Legacy analog (via NVR) | NVR RTSP output | 3 days per 100 cameras |

---

## 4. Department Onboarding Process

### 4.1 Step-by-Step Workflow

```
Step 1: DEPARTMENT SURVEY (1-2 weeks)
├── Camera inventory (count, type, location, age)
├── VMS platform identification
├── Network connectivity assessment
├── Existing retention policies
└── Stakeholder identification

Step 2: TECHNICAL ASSESSMENT (1 week)
├── Protocol compatibility check
├── Bandwidth requirements
├── Storage requirements
├── Access credential collection
└── Network path design

Step 3: ADAPTER DEVELOPMENT (1-3 weeks)
├── Build/connect adapter for department's VMS
├── Test connectivity with sample cameras
├── Validate stream quality
├── Configure health monitoring
└── Document integration notes

Step 4: PILOT ONBOARDING (1-2 weeks)
├── Onboard 10-20 cameras per department
├── Verify analytics output
├── Test alert generation
├── Department stakeholder demo
└── Gather feedback

Step 5: FULL ONBOARDING (2-4 weeks)
├── Bulk camera registration
├── Department-wise user accounts
├── RBAC configuration
├── Training for department operators
└── Go-live support

Step 6: ONGOING OPERATIONS
├── Health monitoring
├── Troubleshooting support
├── Periodic audits
└── Performance optimization
```

### 4.2 Timeline per Department

| Department | Cameras | Tier | Onboarding Time |
|-----------|---------|------|-----------------|
| Home/Police | 25,000 | Tier 1 | 8-12 weeks |
| Municipal Corporations | 15,000 | Tier 1-2 | 6-10 weeks |
| RTO | 12,000 | Tier 2 | 6-8 weeks |
| Food & Civil Supplies | 5,000 | Tier 2 | 3-4 weeks |
| Education | 6,000 | Tier 2 | 3-4 weeks |
| Health | 4,000 | Tier 2 | 2-3 weeks |
| Social Welfare | 4,000 | Tier 2-3 | 3-4 weeks |
| Roads & Buildings | 5,000 | Tier 1-2 | 3-4 weeks |
| Infrastructure (Others) | 4,000 | Tier 2-3 | 4-6 weeks |

---

## 5. Data Sharing & Isolation Model

### 5.1 Department-Level Data Isolation

Each department sees **only their own cameras and alerts** by default:

```sql
-- Department-scoped camera query
SELECT * FROM cameras
WHERE department_id = :user_department_id
AND status = 'online';

-- Department-scoped alert query
SELECT * FROM alerts
WHERE camera_id IN (
    SELECT id FROM cameras
    WHERE department_id = :user_department_id
)
ORDER BY triggered_at DESC;
```

### 5.2 Cross-Department Sharing (Opt-in)

Departments can **voluntarily share** specific cameras/alerts with other departments:

| Sharing Level | Access | Use Case |
|--------------|--------|----------|
| **Department Only** | Own cameras, own alerts | Default for all departments |
| **Zone Sharing** | Cameras in same geographic zone | Border district coordination |
| **Cross-Department** | Selected cameras shared with specific departments | Inter-department investigations |
| **Statewide** | All cameras visible to state-level users | SCRB, Home Department |

### 5.3 Access Control Matrix

| Role | Own Dept | Shared Cameras | Cross-Dept Alerts | Statewide |
|------|----------|---------------|-------------------|-----------|
| Dept Operator | Full | Shared only | No | No |
| Dept Admin | Full | Shared only | No | No |
| Zone Coordinator | Full | Zone cameras | Zone alerts | No |
| State Analyst | Read-only | All shared | All | No |
| SCRB Admin | Full | All | All | Full |

---

## 6. Network Architecture

### 6.1 Statewide Network Design

```
┌─────────────────────────────────────────────┐
│              STATE NOC (Gandhinagar)         │
│  Central Application + Database + AI         │
│  Storage: 5PB distributed                   │
└──────────────────┬──────────────────────────┘
                   │ MPLS/SD-WAN (10 Gbps)
    ┌──────────────┼──────────────┐
    ↓              ↓              ↓
┌────────┐   ┌────────┐   ┌────────┐
│Regional│   │Regional│   │Regional│
│Cluster │   │Cluster │   │Cluster │
│(North) │   │(Central)│  │(South) │
└───┬────┘   └───┬────┘   └───┬────┘
    │            │            │
    ↓            ↓            ↓
┌────────┐   ┌────────┐   ┌────────┐
│Edge    │   │Edge    │   │Edge    │
│Gateway │   │Gateway │   │Gateway │
│(1000   │   │(1000   │   │(1000   │
│ cameras)│  │ cameras)│  │ cameras)│
└────────┘   └────────┘   └────────┘
```

### 6.2 Bandwidth Requirements

| Tier | Cameras | Bandwidth per Camera | Total Bandwidth | Protocol |
|------|---------|---------------------|-----------------|----------|
| Edge Gateway | 50-100 | 4 Mbps | 200-400 Mbps | Local RTSP |
| Regional Cluster | 10,000 | — | 5 Gbps | Aggregated |
| State NOC | 80,000 | — | 10 Gbps | Core backbone |

---

## 7. Migration Strategy

### 7.1 Parallel Running (No Disruption)

```
Phase 1: GICVMAP runs alongside existing VMS
         ├── GICVMAP reads RTSP from existing cameras
         ├── Existing VMS continues uninterrupted
         └── Departments see GICVMAP as "additional capability"

Phase 2: Departments shift primary monitoring to GICVMAP
         ├── GICVMAP becomes primary dashboard
         ├── Existing VMS used for recording/backup
         └── Operators trained on GICVMAP

Phase 3: Optional consolidation
         ├── Departments may retire legacy VMS
         ├── Centralized recording on GICVMAP storage
         └── Full lifecycle migration
```

### 7.2 Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Department resistance | Pilot success → department showcase → peer adoption |
| Network overload | Edge processing reduces core bandwidth by 90% |
| Vendor lock-in | Open protocols (RTSP/ONVIF) + adapter pattern |
| Data privacy | Department-level isolation + RBAC + audit logging |
| Connectivity loss | Edge gateways buffer locally, sync when connected |

---

## 8. Training & Support

### 8.1 Training Program

| Audience | Duration | Content |
|----------|----------|---------|
| Operators | 2 hours | Dashboard, alerts, video wall, search |
| Department Admins | 4 hours | User management, camera config, reports |
| IT Staff | 8 hours | System admin, adapter config, troubleshooting |
| SCRB Analysts | 4 hours | Vehicle tracking, route analysis, exports |

### 8.2 Support Model

| Level | Response Time | Channel |
|-------|-------------|---------|
| L1 (Help Desk) | <4 hours | Phone/email |
| L2 (Technical) | <24 hours | Ticketing system |
| L3 (Engineering) | <48 hours | Direct escalation |

---

## 9. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Department onboarding rate | 2 per month | Monthly tracking |
| Camera uptime | >95% | Health monitoring |
| Alert accuracy | >90% | False positive tracking |
| User adoption | >80% operators | Login frequency |
| Training completion | 100% | Training records |

---

## 10. Conclusion

The 26-department integration strategy follows a **"connect, don't replace"** approach using adapter-based architecture. Key design principles:

1. **Zero disruption** — existing VMS systems continue operating
2. **Protocol-agnostic** — RTSP, ONVIF, SDK, and API adapters cover all major VMS platforms
3. **Department isolation** — each department controls their own data
4. **Opt-in sharing** — cross-department collaboration is voluntary
5. **Phased rollout** — pilot → district → regional → statewide

**Estimated total onboarding time: 18-24 months for all 80,000 cameras across 26 departments.**

---

**Prepared for:** Gujarat Police Innovation Hackathon 2026
**System:** GICVMAP — Gujarat Integrated CCTV Video Management & Analytics Platform
