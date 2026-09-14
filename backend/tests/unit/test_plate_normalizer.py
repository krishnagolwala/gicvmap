import re


def normalize_plate(raw: str) -> str | None:
    """Normalize Indian license plate: uppercase, strip non-alnum."""
    if not raw:
        return None
    text = re.sub(r"[^A-Za-z0-9]", "", raw).upper()
    return text if len(text) >= 6 else None


class TestPlateNormalizer:
    def test_valid_gujarat_plate(self):
        assert normalize_plate("GJ01AB1234") == "GJ01AB1234"

    def test_with_spaces(self):
        assert normalize_plate("GJ 01 AB 1234") == "GJ01AB1234"

    def test_with_special_chars(self):
        assert normalize_plate("GJ-01-AB-1234") == "GJ01AB1234"

    def test_lowercase_input(self):
        assert normalize_plate("gj01ab1234") == "GJ01AB1234"

    def test_too_short(self):
        assert normalize_plate("GJ01") is None

    def test_empty_string(self):
        assert normalize_plate("") is None

    def test_single_digit_district(self):
        assert normalize_plate("GJ1AB1234") == "GJ1AB1234"

    def test_three_letter_series(self):
        assert normalize_plate("GJ01ABC1234") == "GJ01ABC1234"
