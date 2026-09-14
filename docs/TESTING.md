# Test Strategy
## GICVMAP — Testing & Quality Assurance

---

## 1. Testing Overview

### 1.1 Testing Pyramid

```
                    ┌──────────┐
                    │   E2E    │  5-10 tests (critical paths)
                    │ (Playwright)│
                    ├──────────┤
                    │Integration│  20-30 tests (service flows)
                    │ (pytest) │
                    ├──────────┤
                    │  Unit    │  100+ tests (individual functions)
                    │ (pytest) │
                    └──────────┘
```

### 1.2 Test Levels

| Level | Tool | Scope | Coverage Target |
|-------|------|-------|-----------------|
| Unit | pytest | Individual functions, classes | 80% |
| Integration | pytest + httpx | Service-to-service flows | Key flows |
| E2E | Playwright | Full user journeys | Critical paths |
| API | httpx + pytest | All REST endpoints | 100% |
| Load | Locust (best-effort) | Concurrent stream handling | PoC scale |
| UAT | Manual | Evaluation scenario walkthrough | 100% |

---

## 2. Unit Tests

### 2.1 Plate Normalizer Tests

```python
# tests/unit/test_plate_normalizer.py
import pytest
from app.utils.plate_normalizer import normalize_plate

class TestPlateNormalizer:
    def test_valid_gujarat_plate(self):
        assert normalize_plate("GJ01AB1234") == "GJ01AB1234"
    
    def test_valid_maharashtra_plate(self):
        assert normalize_plate("MH12DE1234") == "MH12DE1234"
    
    def test_with_spaces(self):
        assert normalize_plate("GJ 01 AB 1234") == "GJ01AB1234"
    
    def test_with_special_chars(self):
        assert normalize_plate("GJ-01-AB-1234") == "GJ01AB1234"
    
    def test_lowercase_input(self):
        assert normalize_plate("gj01ab1234") == "GJ01AB1234"
    
    def test_ocr_errors_fixed(self):
        # O→0, I→1, S→5
        assert normalize_plate("GJO1AB1234") == "GJ01AB1234"
        assert normalize_plate("GJ0IAB1234") == "GJ01AB1234"
    
    def test_too_short(self):
        assert normalize_plate("GJ01") is None
    
    def test_empty_string(self):
        assert normalize_plate("") is None
    
    def test_single_digit_district(self):
        assert normalize_plate("GJ1AB1234") == "GJ1AB1234"
    
    def test_three_letter_series(self):
        assert normalize_plate("GJ01ABC1234") == "GJ01ABC1234"
```

### 2.2 Watchlist Matcher Tests

```python
# tests/unit/test_watchlist_matcher.py
import pytest
from app.services.watchlist_matcher import WatchlistMatcher

class TestWatchlistMatcher:
    @pytest.fixture
    def matcher(self):
        return WatchlistMatcher()
    
    def test_exact_plate_match(self, matcher):
        watchlist = [{"plate_normalized": "GJ01AB1234", "is_active": True}]
        detection = {"plate_number": "GJ01AB1234", "detection_type": "vehicle"}
        assert matcher.check_match(detection, watchlist) is True
    
    def test_no_match_different_plate(self, matcher):
        watchlist = [{"plate_normalized": "GJ01AB1234", "is_active": True}]
        detection = {"plate_number": "GJ02CD5678", "detection_type": "vehicle"}
        assert matcher.check_match(detection, watchlist) is False
    
    def test_inactive_watchlist_no_match(self, matcher):
        watchlist = [{"plate_normalized": "GJ01AB1234", "is_active": False}]
        detection = {"plate_number": "GJ01AB1234", "detection_type": "vehicle"}
        assert matcher.check_match(detection, watchlist) is False
    
    def test_person_detection_no_plate(self, matcher):
        watchlist = [{"plate_normalized": "GJ01AB1234", "is_active": True}]
        detection = {"detection_type": "person", "plate_number": None}
        assert matcher.check_match(detection, watchlist) is False
    
    def test_empty_watchlist(self, matcher):
        detection = {"plate_number": "GJ01AB1234", "detection_type": "vehicle"}
        assert matcher.check_match(detection, []) is False
```

### 2.3 Alert Engine Tests

```python
# tests/unit/test_alert_engine.py
import pytest
from app.services.alert_engine import AlertEngine

class TestAlertEngine:
    @pytest.fixture
    def engine(self):
        return AlertEngine()
    
    def test_severity_from_watchlist_priority(self, engine):
        assert engine.determine_severity("critical") == "critical"
        assert engine.determine_severity("high") == "high"
        assert engine.determine_severity("medium") == "medium"
        assert engine.determine_severity("low") == "low"
    
    def test_alert_record_structure(self, engine):
        alert = engine.create_alert_record(
            watchlist_id=1,
            detection_id=100,
            camera_id="test-uuid",
            match_type="plate_exact",
            match_confidence=1.0
        )
        assert alert["status"] == "new"
        assert alert["match_type"] == "plate_exact"
        assert "triggered_at" in alert
```

---

## 3. Integration Tests

### 3.1 Camera CRUD Integration

```python
# tests/integration/test_camera_crud.py
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
class TestCameraCRUD:
    async def test_create_camera(self, client: AsyncClient, auth_headers):
        response = await client.post("/api/v1/cameras", json={
            "name": "Test Camera",
            "department_id": 1,
            "camera_type": "ip",
            "lat": 23.0410,
            "lng": 72.5645,
            "rtsp_url": "rtsp://localhost:8554/test"
        }, headers=auth_headers)
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Test Camera"
        assert "id" in data
    
    async def test_list_cameras(self, client: AsyncClient, auth_headers):
        response = await client.get("/api/v1/cameras", headers=auth_headers)
        assert response.status_code == 200
        assert "data" in response.json()
        assert "pagination" in response.json()
    
    async def test_get_camera_by_id(self, client: AsyncClient, auth_headers, sample_camera):
        response = await client.get(
            f"/api/v1/cameras/{sample_camera['id']}",
            headers=auth_headers
        )
        assert response.status_code == 200
        assert response.json()["id"] == sample_camera["id"]
    
    async def test_update_camera(self, client: AsyncClient, auth_headers, sample_camera):
        response = await client.put(
            f"/api/v1/cameras/{sample_camera['id']}",
            json={"name": "Updated Camera Name"},
            headers=auth_headers
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Updated Camera Name"
    
    async def test_delete_camera(self, client: AsyncClient, auth_headers, sample_camera):
        response = await client.delete(
            f"/api/v1/cameras/{sample_camera['id']}",
            headers=auth_headers
        )
        assert response.status_code == 204
    
    async def test_unauthorized_create(self, client: AsyncClient):
        response = await client.post("/api/v1/cameras", json={
            "name": "Test Camera"
        })
        assert response.status_code == 401
```

### 3.2 Detection Pipeline Integration

```python
# tests/integration/test_detection_pipeline.py
import pytest
import asyncio

@pytest.mark.asyncio
class TestDetectionPipeline:
    async def test_frame_to_detection(self, pipeline, sample_frame):
        """Test full pipeline: frame → detection event"""
        result = await pipeline.process_frame(
            frame=sample_frame,
            camera_id="test-camera-id",
            timestamp="2026-09-10T14:32:05Z"
        )
        assert "detections" in result
        assert result["processing_time_ms"] > 0
    
    async def test_detection_stored_in_db(self, pipeline, db_session, sample_frame):
        """Test detection is persisted to database"""
        await pipeline.process_frame(sample_frame, "test-camera-id", "2026-09-10T14:32:05Z")
        
        # Wait for async storage
        await asyncio.sleep(1)
        
        result = await db_session.execute(
            "SELECT COUNT(*) FROM detections WHERE camera_id = 'test-camera-id'"
        )
        assert result.scalar() > 0
```

### 3.3 Alert WebSocket Integration

```python
# tests/integration/test_alert_websocket.py
import pytest
import socketio

@pytest.mark.asyncio
class TestAlertWebSocket:
    async def test_alert_push(self, ws_client, alert_service):
        """Test alert is pushed via WebSocket"""
        received_alerts = []
        
        @ws_client.on('alert.new')
        def on_alert(data):
            received_alerts.append(data)
        
        await ws_client.connect()
        
        # Trigger alert
        await alert_service.create_and_push_alert(
            watchlist_id=1,
            detection_id=100,
            camera_id="test-uuid"
        )
        
        await asyncio.sleep(1)
        assert len(received_alerts) > 0
```

---

## 4. API Tests

### 4.1 Test Coverage Matrix

| Endpoint | Test Cases |
|----------|-----------|
| POST /auth/login | Valid login, invalid password, missing fields |
| POST /auth/refresh | Valid refresh, expired token, invalid token |
| GET /auth/me | Authenticated, unauthenticated |
| GET /cameras | List all, filter by dept, filter by status, pagination |
| POST /cameras | Valid create, missing fields, duplicate RTSP URL |
| GET /cameras/{id} | Valid ID, non-existent ID |
| PUT /cameras/{id} | Update name, update status |
| DELETE /cameras/{id} | Delete existing, non-existent |
| POST /cameras/bulk-upload | Valid CSV, invalid CSV, missing columns |
| GET /vehicle/{plate}/history | Valid plate, no detections, multiple cameras |
| GET /vehicle/{plate}/route | Valid plate, single detection, multi-camera |
| POST /watchlist | Valid entry, duplicate plate |
| GET /watchlist | List all, filter by type, filter by active |
| PUT /watchlist/{id} | Update reason, deactivate |
| GET /alerts | List all, filter by status, filter by severity |
| PUT /alerts/{id}/acknowledge | Acknowledge, already acknowledged |
| PUT /alerts/{id}/dismiss | Dismiss with notes |
| GET /system/stats | Verify all counters |

---

## 5. Test Data

### 5.1 Simulated Camera Feeds

```bash
# Create simulated RTSP feeds using FFmpeg
# Download sample traffic videos from public domain

# Camera 1: Highway traffic
ffmpeg -re -stream_loop -1 -i sample_highway.mp4 -c copy -f rtsp rtsp://localhost:8554/cam1

# Camera 2: Urban intersection
ffmpeg -re -stream_loop -1 -i sample_intersection.mp4 -c copy -f rtsp rtsp://localhost:8554/cam2

# Camera 3: Parking lot
ffmpeg -re -stream_loop -1 -i sample_parking.mp4 -c copy -f rtsp rtsp://localhost:8554/cam3

# Camera 4: Street view with visible plates
ffmpeg -re -stream_loop -1 -i sample_plates.mp4 -c copy -f rtsp rtsp://localhost:8554/cam4
```

### 5.2 Test Watchlist Data

```csv
type,plate_number,reason,category,priority,source_system,fir_number
vehicle,GJ01AB1234,Stolen Vehicle - belongs to complainant,stolen_vehicle,high,VAHAN-mock,FIR/2026/1123
vehicle,GJ02CD5678,Blacklisted - pending investigation,blacklisted,medium,CCTNS-mock,FIR/2026/456
vehicle,GJ03EF9012,Hit and run suspect,suspect,high,manual,FIR/2026/789
vehicle,MH12AB1234,Interstate stolen vehicle,critical,VAHAN-mock,FIR/2026/101
person,,Armed robbery suspect,wanted_person,critical,CCTNS-mock,FIR/2026/202
person,,Missing person - last seen at junction,missing_person,high,CCTNS-mock,FIR/2026/303
```

### 5.3 Test Camera Data (CSV for Bulk Import)

```csv
name,department_code,camera_type,vendor,ip_address,port,rtsp_url,lat,lng,storage_type,retention_days,resolution,fps
"Highway Junction Cam 1","HOME","ip","Hikvision","192.168.1.1","554","rtsp://localhost:8554/cam1",23.0410,72.5645,"nvr",14,"1920x1080",25
"SG Highway Cam 1","MUNI","ip","Dahua","192.168.1.2","554","rtsp://localhost:8554/cam2",23.0450,72.5700,"cloud",7,"1920x1080",25
"Vastrapur Lake Cam 2","HOME","ip","CP Plus","192.168.1.3","554","rtsp://localhost:8554/cam3",23.0500,72.5800,"local",7,"1280x720",15
"RTO Office Cam 1","RTO","analog","Samsung","192.168.1.4","554","rtsp://localhost:8554/cam4",23.0350,72.5500,"nvr",30,"720x576",25
"Science City Road Cam 1","MUNI","ip","Hikvision","192.168.1.5","554","rtsp://localhost:8554/cam5",23.0550,72.5900,"cloud",7,"1920x1080",25
```

---

## 6. Acceptance Criteria

### 6.1 Hackathon Evaluation Scenarios

| Scenario | Acceptance Criteria | Test Method |
|----------|-------------------|-------------|
| Camera Onboarding | 50 cameras added via bulk import within 5 minutes | Manual + API test |
| Live Feed Viewing | ≥8 concurrent streams in video wall without lag | Visual + latency measurement |
| Vehicle Tracking | Given "GJ01AB1234", full route displayed on map with timestamps | E2E test |
| Watchlist Alert | Real-time alert within 5 seconds of detection | E2E test with timing |
| GIS Visualization | All cameras shown on map with correct status colors | Visual inspection |
| Dashboard Navigation | All pages load within 3 seconds | Performance test |
| Role-Based Access | Dept user cannot see other dept's cameras | API test |

### 6.2 Performance Acceptance Criteria

| Metric | Target | Measurement |
|--------|--------|-------------|
| Dashboard load time | <3 seconds | Lighthouse |
| Map render (50 markers) | <1 second | Chrome DevTools |
| Vehicle search response | <2 seconds | API response time |
| Detection-to-alert latency | <5 seconds | End-to-end timing |
| AI inference per frame | <200ms (CPU) | Processing time |
| WebSocket message delivery | <500ms | Network latency |

---

## 7. Demo Test Plan

### 7.1 Pre-Demo Checklist

```markdown
- [ ] All services running (docker compose ps)
- [ ] Database seeded with test data
- [ ] 4+ simulated camera feeds running
- [ ] Watchlist loaded with test plates
- [ ] At least 1 test plate ("GJ01AB1234") will be "detected"
- [ ] Dashboard accessible at http://localhost
- [ ] WebSocket connection working (alerts page)
- [ ] Test accounts created (admin, operator, viewer)
- [ ] Export/backup of test data prepared
```

### 7.2 Demo Script (3 minutes)

| Time | Action | What to Show |
|------|--------|-------------|
| 0:00-0:30 | Camera Registry | GIS map with 50 camera pins, status colors |
| 0:30-1:00 | Live Video Wall | 4-camera grid with live WebRTC streams |
| 1:00-1:30 | AI Detection | Console showing YOLOv8 detecting vehicles in real-time |
| 1:30-2:00 | Vehicle Search | Search "GJ01AB1234" → timeline table + map route |
| 2:00-2:30 | Watchlist Alert | Trigger alert → popup + sound → acknowledge |
| 2:30-3:00 | Architecture Overview | Brief verbal walkthrough of system design |

---

## 8. Bug Reporting

### 8.1 Bug Severity Levels

| Level | Description | Response Time |
|-------|-------------|---------------|
| P0 Critical | System down, data loss | Immediate fix |
| P1 High | Core feature broken | Fix within 2 hours |
| P2 Medium | Feature partially broken | Fix within 4 hours |
| P3 Low | Cosmetic issue | Fix if time permits |

---

*End of Test Strategy Document*
