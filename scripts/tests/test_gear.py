import json

from garmin.gear import ShoeGear, _map_gear, _normalize_brand, _split_combined_name, write_shoes_json


def _shoe(gear_id="abc123", brand="Nimbus", model="Cloudrun 4", max_km=1000, retired=False):
    return ShoeGear(gear_id=gear_id, brand=brand, model=model, max_km=max_km, retired=retired, first_use_date=None)


class TestNormalizeBrand:
    def test_titlecases_all_lowercase_brand(self):
        assert _normalize_brand("velox") == "Velox"

    def test_titlecases_multi_word_lowercase_brand(self):
        assert _normalize_brand("north trail") == "North Trail"

    def test_leaves_already_capitalized_brand_untouched(self):
        assert _normalize_brand("Nimbus") == "Nimbus"

    def test_leaves_all_caps_brand_untouched(self):
        assert _normalize_brand("VELOX") == "VELOX"


class TestSplitCombinedName:
    def test_splits_on_first_space(self):
        assert _split_combined_name("Nimbus Cloudrun 4") == ("Nimbus", "Cloudrun 4")

    def test_single_word_returns_itself_for_both(self):
        assert _split_combined_name("Nimbus") == ("Nimbus", "Nimbus")


class TestMapGear:
    def test_converts_meters_to_rounded_km(self):
        item = {
            "uuid": "demo0001-0000-4000-8000-000000000001",
            "brand": "velox",
            "model": "Tempo Racer 2",
            "maxUsageDistanceMeters": 1000000.0,
        }
        shoe = _map_gear(item, retired=False)

        assert shoe.max_km == 1000
        assert shoe.brand == "Velox"
        assert shoe.model == "Tempo Racer 2"
        assert shoe.retired is False

    def test_strips_dashes_from_uuid(self):
        item = {"uuid": "demo0002-0000-4000-8000-000000000002", "brand": "Nimbus", "model": "Cloudrun 4"}
        shoe = _map_gear(item, retired=True)

        assert shoe.gear_id == "demo0002000040008000000000000002"
        assert shoe.retired is True

    def test_falls_back_to_default_max_km_when_missing(self):
        item = {"uuid": "abc-123", "brand": "Nimbus", "model": "Cloudrun 3"}
        shoe = _map_gear(item, retired=True)

        assert shoe.max_km == 1000

    def test_splits_combined_name_out_of_brand_when_model_is_empty(self):
        """Custom (non-catalog) gear can come back with `model` empty and the
        full name stuffed into `brand` - seen in production on an older shoe."""
        item = {"uuid": "abc-123", "brand": "Nimbus Cloudrun 3", "model": ""}
        shoe = _map_gear(item, retired=True)

        assert shoe.brand == "Nimbus"
        assert shoe.model == "Cloudrun 3"

    def test_prefers_custom_make_model_over_brand_when_model_is_empty(self):
        item = {"uuid": "abc-123", "brand": "", "model": "", "customMakeModel": "Nimbus Cloudrun 3"}
        shoe = _map_gear(item, retired=True)

        assert shoe.brand == "Nimbus"
        assert shoe.model == "Cloudrun 3"


class TestWriteShoesJson:
    def test_writes_shoes_as_a_list_keyed_by_gear_id_fields(self, tmp_path):
        path = tmp_path / "shoes.json"

        changed = write_shoes_json([_shoe(gear_id="abc123")], path=path)

        assert changed is True
        payload = json.loads(path.read_text())
        assert payload == {
            "shoes": [
                {
                    "gearId": "abc123",
                    "brand": "Nimbus",
                    "model": "Cloudrun 4",
                    "maxKm": 1000,
                    "retired": False,
                    "firstUseDate": None,
                }
            ]
        }

    def test_returns_false_when_content_unchanged(self, tmp_path):
        path = tmp_path / "shoes.json"
        shoes = [_shoe(gear_id="stable")]
        write_shoes_json(shoes, path=path)

        changed = write_shoes_json(shoes, path=path)

        assert changed is False
