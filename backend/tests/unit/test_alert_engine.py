from datetime import datetime, timezone


class AlertEngine:
    def determine_severity(self, watchlist_priority: str) -> str:
        return watchlist_priority if watchlist_priority in ("critical", "high", "medium", "low") else "medium"

    def create_alert_record(
        self, watchlist_id: int, detection_id: int, camera_id: str,
        match_type: str, match_confidence: float,
    ) -> dict:
        return {
            "watchlist_id": watchlist_id,
            "detection_id": detection_id,
            "camera_id": camera_id,
            "match_type": match_type,
            "match_confidence": match_confidence,
            "status": "new",
            "triggered_at": datetime.now(timezone.utc).isoformat(),
        }


class TestAlertEngine:
    def setup_method(self):
        self.engine = AlertEngine()

    def test_severity_from_watchlist_priority(self):
        assert self.engine.determine_severity("critical") == "critical"
        assert self.engine.determine_severity("high") == "high"
        assert self.engine.determine_severity("medium") == "medium"
        assert self.engine.determine_severity("low") == "low"

    def test_severity_default(self):
        assert self.engine.determine_severity("unknown") == "medium"

    def test_alert_record_structure(self):
        alert = self.engine.create_alert_record(
            watchlist_id=1, detection_id=100, camera_id="test-uuid",
            match_type="plate_exact", match_confidence=1.0,
        )
        assert alert["status"] == "new"
        assert alert["match_type"] == "plate_exact"
        assert "triggered_at" in alert
