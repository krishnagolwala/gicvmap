# VAHAN / SARTHI / eGujCop / AFIS Integration Architecture

> **GICVMAP — Gujarat Police Innovation Hackathon 2026**
> **Document Type:** Government Database Integration Architecture
> **Date:** 15 September 2026

---

## 1. Integration Overview

The hackathon problem statement requires:
> "The proposed CCTV Integration System should be integrated with databases such as VAHAN, SARTHI, eGujCop/CCTNS, AFIS and NAFIS to enable automated real-time alerts and proactive monitoring capabilities."

This document presents the integration architecture for connecting GICVMAP with Gujarat's law enforcement databases.

---

## 2. Database Inventory

### 2.1 VAHAN — Vehicle Registration Database

| Attribute | Details |
|-----------|---------|
| **Owner** | Ministry of Road Transport & Highways (MoRTH) |
| **Purpose** | National vehicle registration records |
| **Data** | Registration number, owner name, vehicle make/model, engine/chassis number, insurance, fitness, pollution |
| **Access** | API via MoRTH/Vahan4 portal, or state-level API gateway |
| **GICVMAP Use** | Enrich detected plates with vehicle owner details, verify registration status |

### 2.2 SARTHI — Criminal Database

| Attribute | Details |
|-----------|---------|
| **Owner** | Gujarat State Crime Records Bureau (SCRB) |
| **Purpose** | State-level criminal records |
| **Data** | Arrested persons, wanted criminals, history-sheeters, Modus Operandi (MO) |
| **Access** | Internal API / direct database access (SCRB-managed) |
| **GICVMAP Use** | Cross-reference detected persons (future FRS) with criminal records |

### 2.3 eGujCop / CCTNS — Crime & Criminal Tracking Network

| Attribute | Details |
|-----------|---------|
| **Owner** | Gujarat Police / MoHUA (national CCTNS) |
| **Purpose** | FIR registration, case management, criminal tracking |
| **Data** | FIRs, charge sheets, missing persons, stolen vehicles, unidentified dead bodies |
| **Access** | CCTNS API (NCRB标准), eGujCop internal APIs |
| **GICVMAP Use** | Auto-populate watchlist from stolen vehicle FIRs, missing person cases |

### 2.4 AFIS / NAFIS — Automated Fingerprint Identification

| Attribute | Details |
|-----------|---------|
| **Owner** | National Crime Records Bureau (NCRB) / State Fingerprint Bureau |
| **Purpose** | Biometric identification (fingerprints) |
| **Data** | Fingerprint templates, criminal history linked to prints |
| **Access** | NAFIS API (NCRB-managed), state fingerprint bureau API |
| **GICVMAP Use** | Future: face recognition → fingerprint cross-reference (Phase 2+) |

---

## 3. Integration Architecture

### 3.1 High-Level Integration Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    GICVMAP PLATFORM                      │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │Detection │  │Watchlist │  │  Alert   │  │  Route  │ │
│  │ Pipeline │  │  Engine  │  │  Engine  │  │ Tracker │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬────┘ │
│       └──────────────┼─────────────┼──────────────┘      │
│                      ↓             ↓                     │
│              ┌───────────────────────────┐               │
│              │   INTEGRATION GATEWAY     │               │
│              │   (API Adapter Layer)     │               │
│              └────────────┬──────────────┘               │
└───────────────────────────┼──────────────────────────────┘
                            ↓
        ┌───────────────────────────────────┐
        │      GOVERNMENT DATABASE APIS      │
        │                                    │
        │  ┌─────────┐  ┌─────────┐        │
        │  │ VAHAN   │  │ SARTHI  │        │
        │  │ (Vehicle│  │(Criminal│        │
        │  │  Reg)   │  │ Records)│        │
        │  └─────────┘  └─────────┘        │
        │                                    │
        │  ┌─────────┐  ┌─────────┐        │
        │  │eGujCop/ │  │AFIS/    │        │
        │  │CCTNS    │  │NAFIS    │        │
        │  │(FIR/    │  │(Finger- │        │
        │  │ Cases)  │  │ prints) │        │
        │  └─────────┘  └─────────┘        │
        └───────────────────────────────────┘
```

### 3.2 Integration Gateway Design

The Integration Gateway is a **microservice** that abstracts all government database APIs behind a unified interface:

```python
# Integration Gateway — Pseudocode

class IntegrationGateway:
    def __init__(self):
        self.adapters = {
            "vahan": VahanAdapter(),
            "sarathi": SarathiAdapter(),
            "egujcop": EGujCopAdapter(),
            "cctns": CCTNSAdapter(),
            "afis": AFISAdapter(),
        }

    async def enrich_vehicle(self, plate_number: str) -> dict:
        """Enrich a detected plate with VAHAN data."""
        vahan = self.adapters["vahan"]
        return await vahan.lookup(plate_number)
        # Returns: owner_name, vehicle_make, model, year,
        #          insurance_status, fitness_valid, pollution_valid

    async def check_stolen(self, plate_number: str) -> dict:
        """Check if plate is reported stolen in CCTNS."""
        cctns = self.adapters["cctns"]
        return await cctns.check_stolen_vehicle(plate_number)
        # Returns: is_stolen, fir_number, police_station, date_reported

    async def check_watchlist(self, person_data: dict) -> dict:
        """Cross-reference person with SARTHI criminal DB."""
        sarathi = self.adapters["sarathi"]
        return await sarathi.search_person(person_data)
        # Returns: is_wanted, case_details, reward_amount

    async def lookup_fingerprint(self, face_embedding: list) -> dict:
        """Future: face → fingerprint cross-reference via NAFIS."""
        afis = self.adapters["afis"]
        return await afis.face_to_print(face_embedding)
```

---

## 4. Integration Flows

### 4.1 Flow 1: Real-Time Vehicle Enrichment

```
Camera detects plate GJ01AB1234
        ↓
YOLO + EasyOCR reads plate
        ↓
Integration Gateway called
        ↓
    ┌───┴───┐
    ↓       ↓
 VAHAN   CCTNS
 lookup  stolen check
    ↓       ↓
 Owner   Is stolen? ──→ YES: CRITICAL alert
 details  FIR#        ──→ NO: continue
    ↓
 Detection enriched:
 {
   "plate": "GJ01AB1234",
   "owner": "Rajesh Patel",
   "vehicle": "Maruti Swift Dzire 2022",
   "insurance": "valid",
   "fitness": "valid",
   "is_stolen": true,
   "fir_number": "2026/4521",
   "police_station": "Shahibaug PS"
 }
        ↓
 Alert generated with full context
```

### 4.2 Flow 2: Watchlist Auto-Sync from CCTNS

```
CCTNS updated (new stolen vehicle FIR filed)
        ↓
Integration Gateway polls CCTNS API (every 15 min)
        ↓
New stolen vehicles detected
        ↓
Auto-add to GICVMAP watchlist:
 {
   "plate_number": "GJ12XY5678",
   "type": "stolen_vehicle",
   "priority": "high",
   "fir_number": "2026/4890",
   "source": "CCTNS",
   "auto_added": true
 }
        ↓
Next detection of this plate triggers alert
```

### 4.3 Flow 3: Missing Person Alert

```
Missing person FIR filed in CCTNS
        ↓
Integration Gateway syncs missing person data
        ↓
Watchlist updated:
 {
   "type": "missing_person",
   "person_name": "Priya Sharma",
   "age": 28,
   "last_seen_location": "SG Highway",
   "last_seen_date": "2026-09-10",
   "fir_number": "2026/4756"
 }
        ↓
Future: Face recognition detects matching person
        ↓
HIGH alert generated with photo + last known location
```

### 4.4 Flow 4: Vehicle History Lookup

```
Officer searches plate GJ01AB1234 in GICVMAP dashboard
        ↓
Integration Gateway calls:
1. VAHAN → owner details, registration status
2. CCTNS → stolen status, FIR history
3. GICVMAP DB → detection history, route, alerts
        ↓
Combined response:
 {
   "plate": "GJ01AB1234",
   "vahan": {
     "owner": "Rajesh Patel",
     "address": "Ahmedabad, Gujarat",
     "vehicle": "Maruti Swift Dzire",
     "year": 2022,
     "insurance_valid": true,
     "fitness_valid": true
   },
   "cctns": {
     "is_stolen": true,
     "fir": "2026/4521",
     "date": "2026-08-15"
   },
   "gicvmap": {
     "total_sightings": 8,
     "last_seen": "2026-09-15 09:52:18",
     "route": [...],
     "alerts": 8
   }
 }
```

---

## 5. API Specifications

### 5.1 VAHAN Integration API

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/integrations/vahan/lookup/{plate}` | GET | Vehicle registration lookup |
| `/api/v1/integrations/vahan/bulk-lookup` | POST | Batch vehicle lookup |
| `/api/v1/integrations/vahan/verify/{plate}` | GET | Verify registration status |

**Sample Response:**
```json
{
  "plate_number": "GJ01AB1234",
  "registered_owner": "Rajesh Kumar Patel",
  "father_name": "Kumar Patel",
  "address": "456 Nehru Nagar, Ahmedabad, Gujarat 380001",
  "vehicle_class": "Motor Car (LMV)",
  "manufacturer": "MARUTI SUZUKI INDIA LTD",
  "model": "SWIFT DZIRE",
  "year_of_manufacture": 2022,
  "engine_number": "K10BN123456",
  "chassis_number": "MA3FJEB1S00123456",
  "insurance_valid_upto": "2027-03-15",
  "fitness_valid_upto": "2028-08-20",
  "tax_valid_upto": "2027-06-30",
  "status": "active"
}
```

### 5.2 CCTNS / eGujCop Integration API

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/integrations/cctns/stolen-check/{plate}` | GET | Check if vehicle is stolen |
| `/api/v1/integrations/cctns/fir/{fir_number}` | GET | Get FIR details |
| `/api/v1/integrations/cctns/missing-persons` | GET | List missing person cases |
| `/api/v1/integrations/cctns/sync-watchlist` | POST | Auto-sync watchlist from CCTNS |

**Sample Response (Stolen Check):**
```json
{
  "plate_number": "GJ01AB1234",
  "is_stolen": true,
  "fir_number": "2026/4521",
  "police_station": "Shahibaug PS, Ahmedabad City",
  "date_reported": "2026-08-15",
  "complainant": "Rajesh Kumar Patel",
  "sections": ["IPC 379", "IPC 414"],
  "investigating_officer": "Inspector J.K. Yadav",
  "io_phone": "+91-98765-43210",
  "vehicle_description": "White Maruti Swift Dzire, GJ01AB1234"
}
```

### 5.3 SARTHI Integration API

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/integrations/sarathi/person-search` | POST | Search criminal records |
| `/api/v1/integrations/sarathi/wanted-list` | GET | List wanted persons |
| `/api/v1/integrations/sarathi/history-sheeter/{id}` | GET | Criminal profile |

### 5.4 AFIS / NAFIS Integration API (Future Phase)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/integrations/afis/face-match` | POST | Face-to-fingerprint lookup |
| `/api/v1/integrations/afis/verify/{person_id}` | GET | Verify identity |

---

## 6. Data Flow Architecture

### 6.1 Real-Time Sync (Push)

```
CCTNS / VAHAN
    ↓ (webhook / change data capture)
Integration Gateway
    ↓
GICVMAP Watchlist DB
    ↓
Alert Engine (immediate)
```

### 6.2 Periodic Sync (Pull)

```
Integration Gateway (cron: every 15 min)
    ↓
Query CCTNS API for new stolen vehicles
    ↓
Query SARTHI API for updated wanted list
    ↓
Update GICVMAP watchlist
    ↓
Log sync status to audit_log table
```

### 6.3 On-Demand Lookup (Query)

```
Dashboard user searches plate
    ↓
Integration Gateway
    ↓
Parallel queries: VAHAN + CCTNS + GICVMAP DB
    ↓
Merge results
    ↓
Return enriched response
```

---

## 7. Security & Compliance

### 7.1 Data Handling

| Data Type | Source | Storage | Retention | Access |
|-----------|--------|---------|-----------|--------|
| Vehicle registration | VAHAN | Encrypted cache (Redis) | 24 hours | Any authenticated user |
| Stolen vehicle status | CCTNS | PostgreSQL (encrypted) | Until case closed | Operators + above |
| Criminal records | SARTHI | PostgreSQL (encrypted) | As per policy | Dept Admin + above |
| FIR details | CCTNS | PostgreSQL (encrypted) | Until case closed | Operators + above |
| Biometric data | NAFIS | Not stored (query-only) | N/A | SCRB only |

### 7.2 Security Controls

| Control | Implementation |
|---------|---------------|
| Authentication | OAuth 2.0 / API keys for government APIs |
| Encryption | TLS 1.3 in transit, AES-256 at rest |
| Audit logging | Every API call logged with timestamp, user, action |
| Data minimization | Only store necessary fields, cache with TTL |
| Access control | RBAC enforced — not all users see all data |
| Rate limiting | Respect government API rate limits |

---

## 8. Implementation Phases

### Phase 1: PoC (Current — Month 1-2)
- **Status:** Local watchlist (5 seeded entries)
- **Scope:** Manual plate entry → alert generation
- **External integration:** None (self-contained demo)

### Phase 2: VAHAN Integration (Month 3-4)
- Connect to VAHAN API (or state transport API)
- Enrich detected plates with vehicle owner details
- Display owner info in alert context

### Phase 3: CCTNS Integration (Month 5-8)
- Auto-sync stolen vehicle FIRs
- Auto-populate watchlist from active cases
- Missing person alerts

### Phase 4: SARTHI Integration (Month 9-12)
- Criminal record cross-reference
- History-sheeter alerts
- Wanted person identification

### Phase 5: AFIS/NAFIS Integration (Month 13-18)
- Face recognition → fingerprint cross-reference
- Full identity verification
- Multi-modal biometric matching

---

## 9. Technical Prerequisites

### 9.1 From Government Departments

| Database | Required Access | Contact |
|----------|----------------|---------|
| VAHAN | API access (sandbox for PoC, production for scale) | MoRTH / State Transport Dept |
| CCTNS | API access (NCRB standard) | Gujarat Police / SCRB |
| SARTHI | Database API (SCRB-managed) | State Crime Records Bureau |
| AFIS/NAFIS | NCRB API access | NCRB / State Fingerprint Bureau |

### 9.2 From GICVMAP Side

| Component | Status | Notes |
|-----------|--------|-------|
| Integration Gateway | To build | New microservice |
| API adapter framework | To design | Plugin-based architecture |
| Encrypted credential store | To implement | Vault / encrypted DB |
| Audit logging | ✅ Done | `audit_log` table ready |

---

## 10. Conclusion

GICVMAP's integration architecture uses an **adapter-based Integration Gateway** to connect with VAHAN, SARTHI, eGujCop/CCTNS, and AFIS/NAFIS. Key design principles:

1. **Abstraction** — one gateway interface hides all database-specific complexity
2. **Phased** — start with VAHAN (easiest), progress to AFIS (most complex)
3. **Real-time** — push-based sync for time-critical data (stolen vehicles)
4. **Secure** — encrypted storage, RBAC, full audit trail
5. **Future-proof** — plugin architecture allows new databases without redesign

**Current status:** Self-contained PoC with local watchlist (5 entries). Integration Gateway is the next development priority after hackathon.

---

**Prepared for:** Gujarat Police Innovation Hackathon 2026
**System:** GICVMAP — Gujarat Integrated CCTV Video Management & Analytics Platform
