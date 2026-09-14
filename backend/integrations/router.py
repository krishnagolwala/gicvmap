"""
Section 7 — Integrations & APIs
Mock connectors for government systems: VAHAN, SARTHI, eGujCop, AFIS, NAFIS.
Also provides adapter registry and integration health/status.
"""
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
import random
import hashlib

from shared.auth import get_current_user, UserContext

router = APIRouter()


# ─── Models ──────────────────────────────────────────────────────────────────

class IntegrationStatus(BaseModel):
    name: str
    system: str
    status: str  # connected | degraded | disconnected | mock
    last_sync: Optional[str] = None
    records_synced: int = 0
    api_version: str = "1.0"
    adapter_type: str  # rest | soap | sdk | mock
    description: str


class VahanLookupResponse(BaseModel):
    plate_number: str
    owner_name: str
    owner_father_name: Optional[str] = None
    vehicle_class: str
    fuel_type: str
    manufacturer: str
    model: str
    registration_date: str
    fitness_upto: str
    insurance_upto: str
    pucc_upto: Optional[str] = None
    status: str  # active | stolen | suspended
    state: str = "Gujarat"
    rto_code: str = "GJ01"


class SarthiAlertResponse(BaseModel):
    person_id: str
    name: str
    alert_type: str
    severity: str
    description: str
    source_case: Optional[str] = None
    district: str
    active: bool = True


class EgujcopFirResponse(BaseModel):
    fir_number: str
    district: str
    police_station: str
    ipc_sections: str
    complainant: str
    accused: Optional[str] = None
    vehicle_involved: Optional[str] = None
    date_of_occurrence: str
    status: str  # registered | under_investigation | chargesheeted | closed


class AfisMatchResponse(BaseModel):
    query_id: str
    matches_found: int
    matches: list[dict] = []
    confidence_threshold: float
    processing_time_ms: int


class NafisResponse(BaseModel):
    request_id: str
    status: str  # pending | matched | no_match | error
    matches: list[dict] = []
    source: str = "NAFIS"
    processing_time_ms: int


# ─── Mock Data ───────────────────────────────────────────────────────────────

VAHAN_MOCK_DATA = {
    "GJ01AB1234": {
        "owner_name": "Rajeshkumar Patel",
        "owner_father_name": "Maheshkumar Patel",
        "vehicle_class": "Motor Car (LMV)",
        "fuel_type": "Petrol",
        "manufacturer": "Maruti Suzuki",
        "model": "Swift Dzire",
        "registration_date": "2021-03-15",
        "fitness_upto": "2027-03-14",
        "insurance_upto": "2027-01-20",
        "pucc_upto": "2026-12-15",
        "status": "stolen",
        "rto_code": "GJ01",
    },
    "GJ05CD5678": {
        "owner_name": "Priya Sharma",
        "owner_father_name": "Vikram Sharma",
        "vehicle_class": "Motor Car (LMV)",
        "fuel_type": "Diesel",
        "manufacturer": "Hyundai",
        "model": "Creta",
        "registration_date": "2022-07-10",
        "fitness_upto": "2028-07-09",
        "insurance_upto": "2027-06-30",
        "pucc_upto": "2026-11-20",
        "status": "active",
        "rto_code": "GJ05",
    },
    "GJ27EF9012": {
        "owner_name": "Amit Joshi",
        "owner_father_name": "Prakash Joshi",
        "vehicle_class": "Motor Car (LMV)",
        "fuel_type": "Petrol",
        "manufacturer": "Tata",
        "model": "Nexon",
        "registration_date": "2023-01-22",
        "fitness_upto": "2029-01-21",
        "insurance_upto": "2026-09-15",
        "pucc_upto": "2026-10-30",
        "status": "active",
        "rto_code": "GJ27",
    },
    "GJ03GH3456": {
        "owner_name": "Suresh Mehta",
        "owner_father_name": "Ramniklal Mehta",
        "vehicle_class": "Motor Car (LMV)",
        "fuel_type": "Petrol",
        "manufacturer": "Honda",
        "model": "Amaze",
        "registration_date": "2020-11-05",
        "fitness_upto": "2026-11-04",
        "insurance_upto": "2026-12-01",
        "pucc_upto": "2026-11-15",
        "status": "active",
        "rto_code": "GJ03",
    },
}

SARTHI_ALERTS_MOCK = [
    {"person_id": "SARTHI-001", "name": "Ramesh Gupta", "alert_type": "wanted", "severity": "high",
     "description": "Wanted for chain snatching incidents in Ahmedabad", "source_case": "FIR-2026/1234",
     "district": "Ahmedabad"},
    {"person_id": "SARTHI-002", "name": "Kiran Patel", "alert_type": "missing", "severity": "medium",
     "description": "Missing person - last seen at SG Highway", "source_case": "FIR-2026/5678",
     "district": "Ahmedabad"},
    {"person_id": "SARTHI-003", "name": "Deepak Singh", "alert_type": "parole_violation", "severity": "high",
     "description": "Parole violation - known associate of organized crime", "source_case": "CR-2025/9012",
     "district": "Surat"},
]

EGUGCOP_FIRS_MOCK = [
    {"fir_number": "FIR-2026/4521", "district": "Ahmedabad", "police_station": "Navrangpura",
     "ipc_sections": "379, 411", "complainant": "Rajeshkumar Patel", "vehicle_involved": "GJ01AB1234",
     "date_of_occurrence": "2026-08-20", "status": "under_investigation"},
    {"fir_number": "FIR-2026/3892", "district": "Ahmedabad", "police_station": "Satellite",
     "ipc_sections": "392, 397", "complainant": "Pravin Gandhi", "vehicle_involved": "GJ05CD5678",
     "date_of_occurrence": "2026-09-01", "status": "registered"},
    {"fir_number": "FIR-2025/7890", "district": "Surat", "police_station": "Athwa",
     "ipc_sections": "302, 201", "complainant": "State of Gujarat", "vehicle_involved": None,
     "date_of_occurrence": "2025-12-15", "status": "chargesheeted"},
]


# ─── Integration Status ─────────────────────────────────────────────────────

@router.get("/integrations/status")
async def get_integration_status(user: UserContext = Depends(get_current_user)):
    """Returns the status of all configured system integrations."""
    now = datetime.utcnow()
    return [
        IntegrationStatus(
            name="VAHAN (Vehicle Database)",
            system="VAHAN",
            status="mock",
            last_sync=(now - timedelta(minutes=5)).isoformat(),
            records_synced=1247,
            api_version="2.1",
            adapter_type="rest",
            description="Mock adapter — connects to VAHAN vehicle registration database for owner lookup, stolen vehicle checks, and fitness verification.",
        ),
        IntegrationStatus(
            name="SARTHI (Person Alerts)",
            system="SARTHI",
            status="mock",
            last_sync=(now - timedelta(minutes=12)).isoformat(),
            records_synced=89,
            api_version="1.4",
            adapter_type="rest",
            description="Mock adapter — SARTHI system for wanted persons, missing persons, and parole violation alerts.",
        ),
        IntegrationStatus(
            name="eGujCop (FIR System)",
            system="eGujCop",
            status="mock",
            last_sync=(now - timedelta(minutes=20)).isoformat(),
            records_synced=342,
            api_version="3.0",
            adapter_type="soap",
            description="Mock adapter — Gujarat Police eGujCop FIR system for case lookup and vehicle involvement tracking.",
        ),
        IntegrationStatus(
            name="AFIS (Fingerprint System)",
            system="AFIS",
            status="mock",
            last_sync=(now - timedelta(hours=1)).isoformat(),
            records_synced=0,
            api_version="1.2",
            adapter_type="sdk",
            description="Mock adapter — Automated Fingerprint Identification System for biometric matching (face/fingerprint).",
        ),
        IntegrationStatus(
            name="NAFIS (National AFIS)",
            system="NAFIS",
            status="mock",
            last_sync=(now - timedelta(hours=2)).isoformat(),
            records_synced=0,
            api_version="1.0",
            adapter_type="rest",
            description="Mock adapter — National Automated Fingerprint Identification System (NCRB) for inter-state biometric queries.",
        ),
        IntegrationStatus(
            name="Sentinel Camera Grid",
            system="SENTINEL",
            status="connected",
            last_sync=(now - timedelta(seconds=30)).isoformat(),
            records_synced=30,
            api_version="1.0",
            adapter_type="rest",
            description="Live integration — Sentinel RTSP/HLS camera grid providing 30 real feeds from Gujarat statewide CCTV infrastructure.",
        ),
    ]


# ─── VAHAN Connector ────────────────────────────────────────────────────────

@router.get("/integrations/vahan/lookup")
async def vahan_lookup(
    plate_number: str = Query(..., description="Vehicle registration number"),
    user: UserContext = Depends(get_current_user),
):
    """Mock VAHAN lookup — returns vehicle registration details from the mock database."""
    normalized = plate_number.upper().replace(" ", "").replace("-", "")
    data = VAHAN_MOCK_DATA.get(normalized)
    if not data:
        # Generate deterministic mock for any plate
        h = int(hashlib.md5(normalized.encode()).hexdigest()[:8], 16)
        manufacturers = ["Maruti Suzuki", "Hyundai", "Tata", "Mahindra", "Honda", "Toyota"]
        models = ["Swift", "Creta", "Nexon", "XUV700", "City", "Innova"]
        fuel = ["Petrol", "Diesel", "CNG", "Electric"]
        rto = f"GJ{(h % 28) + 1:02d}"
        data = {
            "owner_name": f"Mock Owner {h % 1000}",
            "vehicle_class": "Motor Car (LMV)",
            "fuel_type": fuel[h % len(fuel)],
            "manufacturer": manufacturers[h % len(manufacturers)],
            "model": models[h % len(models)],
            "registration_date": f"202{(h % 4) + 1}-0{(h % 9) + 1}-{(h % 28) + 1:02d}",
            "fitness_upto": "2028-01-01",
            "insurance_upto": "2027-06-30",
            "status": "active",
            "rto_code": rto,
        }

    return VahanLookupResponse(plate_number=normalized, **data)


# ─── SARTHI Connector ──────────────────────────────────────────────────────

@router.get("/integrations/sarthi/alerts")
async def sarthi_alerts(
    district: Optional[str] = None,
    alert_type: Optional[str] = None,
    user: UserContext = Depends(get_current_user),
):
    """Mock SARTHI alerts — returns person alerts from the mock database."""
    results = SARTHI_ALERTS_MOCK
    if district:
        results = [a for a in results if a["district"].lower() == district.lower()]
    if alert_type:
        results = [a for a in results if a["alert_type"] == alert_type]
    return results


@router.get("/integrations/sarthi/person/{person_id}")
async def sarthi_person(
    person_id: str,
    user: UserContext = Depends(get_current_user),
):
    """Mock SARTHI person lookup."""
    for p in SARTHI_ALERTS_MOCK:
        if p["person_id"] == person_id:
            return {**p, "aliases": [], "addresses": ["Ahmedabad, Gujarat"],
                    "photo_url": None, "physical_description": "Medium build, 5'8\""}
    return {"error": "Person not found in SARTHI database"}


# ─── eGujCop Connector ─────────────────────────────────────────────────────

@router.get("/integrations/egujcop/firs")
async def egujcop_firs(
    district: Optional[str] = None,
    vehicle: Optional[str] = None,
    user: UserContext = Depends(get_current_user),
):
    """Mock eGujCop FIR search."""
    results = EGUGCOP_FIRS_MOCK
    if district:
        results = [f for f in results if f["district"].lower() == district.lower()]
    if vehicle:
        v = vehicle.upper().replace(" ", "")
        results = [f for f in results if f.get("vehicle_involved") == v]
    return results


@router.get("/integrations/egujcop/fir/{fir_number}")
async def egujcop_fir_detail(
    fir_number: str,
    user: UserContext = Depends(get_current_user),
):
    """Mock eGujCop FIR detail lookup."""
    for f in EGUGCOP_FIRS_MOCK:
        if f["fir_number"] == fir_number:
            return {**f, "investigating_officer": "PI R. K. Verma",
                    "evidence_items": ["CCTV footage", "Witness statement"],
                    "next_hearing": "2026-10-15"}
    return {"error": "FIR not found in eGujCop database"}


# ─── AFIS Connector ─────────────────────────────────────────────────────────

@router.post("/integrations/afis/match")
async def afis_match(
    query_type: str = Query("face", description="face or fingerprint"),
    threshold: float = Query(0.6, ge=0.1, le=1.0),
    user: UserContext = Depends(get_current_user),
):
    """Mock AFIS biometric match — returns simulated match results."""
    return AfisMatchResponse(
        query_id=f"AFIS-{random.randint(10000, 99999)}",
        matches_found=0,
        matches=[],
        confidence_threshold=threshold,
        processing_time_ms=random.randint(150, 800),
    )


# ─── NAFIS Connector ───────────────────────────────────────────────────────

@router.post("/integrations/nafis/query")
async def nafis_query(
    query_type: str = Query("face", description="face or fingerprint"),
    user: UserContext = Depends(get_current_user),
):
    """Mock NAFIS national biometric query."""
    return NafisResponse(
        request_id=f"NAFIS-{random.randint(100000, 999999)}",
        status="no_match",
        matches=[],
        processing_time_ms=random.randint(500, 2000),
    )


# ─── Adapter Registry ───────────────────────────────────────────────────────

@router.get("/integrations/adapters")
async def list_adapters(user: UserContext = Depends(get_current_user)):
    """List all available VMS/vendor adapter plugins."""
    return [
        {"id": "sentinel-rtsp", "name": "Sentinel RTSP Adapter", "vendor": "Sentinel",
         "protocol": "RTSP", "status": "active", "description": "Connects to Sentinel Camera Grid RTSP feeds"},
        {"id": "sentinel-hls", "name": "Sentinel HLS Adapter", "vendor": "Sentinel",
         "protocol": "HLS", "status": "active", "description": "Connects to Sentinel Camera Grid HLS CDN"},
        {"id": "onvif-generic", "name": "ONVIF Generic Adapter", "vendor": "ONVIF",
         "protocol": "ONVIF", "status": "active", "description": "Generic ONVIF camera discovery and streaming"},
        {"id": "hikvision-sdk", "name": "Hikvision SDK Adapter", "vendor": "Hikvision",
         "protocol": "SDK", "status": "available", "description": "Hikvision proprietary SDK integration"},
        {"id": "dahua-sdk", "name": "Dahua SDK Adapter", "vendor": "Dahua",
         "protocol": "SDK", "status": "available", "description": "Dahua proprietary SDK integration"},
        {"id": "axis-vapix", "name": "Axis VAPIX Adapter", "vendor": "Axis",
         "protocol": "REST", "status": "available", "description": "Axis VAPIX API integration"},
    ]


# ─── Cross-System Event Correlation ─────────────────────────────────────────

@router.get("/integrations/correlate")
async def correlate_events(
    plate_number: str = Query(...),
    user: UserContext = Depends(get_current_user),
):
    """
    Cross-system event correlation — queries all connected systems for a plate number
    and returns a unified event timeline.
    """
    normalized = plate_number.upper().replace(" ", "").replace("-", "")
    events = []

    # VAHAN lookup
    vahan = VAHAN_MOCK_DATA.get(normalized)
    if vahan:
        events.append({
            "source": "VAHAN",
            "event_type": "vehicle_registration",
            "timestamp": vahan["registration_date"],
            "details": f"{vahan['manufacturer']} {vahan['model']} — Owner: {vahan['owner_name']}",
            "severity": "info",
        })
        if vahan["status"] == "stolen":
            events.append({
                "source": "VAHAN",
                "event_type": "stolen_flag",
                "timestamp": datetime.utcnow().isoformat(),
                "details": "Vehicle flagged as STOLEN in VAHAN database",
                "severity": "critical",
            })

    # eGujCop FIR match
    for fir in EGUGCOP_FIRS_MOCK:
        if fir.get("vehicle_involved") == normalized:
            events.append({
                "source": "eGujCop",
                "event_type": "fir_match",
                "timestamp": fir["date_of_occurrence"],
                "details": f"FIR {fir['fir_number']} — {fir['ipc_sections']} — {fir['status']}",
                "severity": "high" if fir["status"] in ("registered", "under_investigation") else "medium",
            })

    # SARTHI alerts
    for alert in SARTHI_ALERTS_MOCK:
        events.append({
            "source": "SARTHI",
            "event_type": f"person_{alert['alert_type']}",
            "timestamp": datetime.utcnow().isoformat(),
            "details": f"{alert['name']} — {alert['description']}",
            "severity": alert["severity"],
        })

    events.sort(key=lambda e: e["timestamp"])
    return {
        "plate_number": normalized,
        "total_events": len(events),
        "events": events,
        "systems_queried": ["VAHAN", "SARTHI", "eGujCop", "AFIS", "NAFIS"],
    }
