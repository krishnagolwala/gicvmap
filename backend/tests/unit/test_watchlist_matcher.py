class WatchlistMatcher:
    def check_match(self, detection: dict, watchlist: list[dict]) -> bool:
        if detection.get("detection_type") != "vehicle":
            return False
        plate = detection.get("plate_number")
        if not plate:
            return False
        normalized = plate.upper().replace(" ", "").replace("-", "")
        for entry in watchlist:
            if entry.get("is_active") and entry.get("plate_normalized") == normalized:
                return True
        return False


class TestWatchlistMatcher:
    def setup_method(self):
        self.matcher = WatchlistMatcher()

    def test_exact_plate_match(self):
        watchlist = [{"plate_normalized": "GJ01AB1234", "is_active": True}]
        detection = {"plate_number": "GJ01AB1234", "detection_type": "vehicle"}
        assert self.matcher.check_match(detection, watchlist) is True

    def test_no_match_different_plate(self):
        watchlist = [{"plate_normalized": "GJ01AB1234", "is_active": True}]
        detection = {"plate_number": "GJ02CD5678", "detection_type": "vehicle"}
        assert self.matcher.check_match(detection, watchlist) is False

    def test_inactive_watchlist_no_match(self):
        watchlist = [{"plate_normalized": "GJ01AB1234", "is_active": False}]
        detection = {"plate_number": "GJ01AB1234", "detection_type": "vehicle"}
        assert self.matcher.check_match(detection, watchlist) is False

    def test_person_detection_no_match(self):
        watchlist = [{"plate_normalized": "GJ01AB1234", "is_active": True}]
        detection = {"detection_type": "person", "plate_number": None}
        assert self.matcher.check_match(detection, watchlist) is False

    def test_empty_watchlist(self):
        detection = {"plate_number": "GJ01AB1234", "detection_type": "vehicle"}
        assert self.matcher.check_match(detection, []) is False
