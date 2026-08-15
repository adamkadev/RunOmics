from garmin.athlete import extract_primary_device


def _device(device_id, **overrides):
    device = {
        "deviceId": device_id,
        "displayName": "Forerunner 265",
        "productDisplayName": "Forerunner 265",
        "currentFirmwareVersion": "28.05",
        "registeredDate": 1736899200000,
        "serialNumber": "DEMOSERIAL1",
        "primary": True,
    }
    device.update(overrides)
    return device


def _payload(*devices, primary_id=None):
    return {
        "PrimaryTrainingDevice": {"deviceId": primary_id},
        "RegisteredDevices": list(devices),
    }


def test_extracts_the_primary_training_device():
    info = extract_primary_device(_payload(_device(990000002), primary_id=990000002))

    assert info == {
        "deviceName": "Forerunner 265",
        "deviceFirmware": "28.05",
        "deviceSince": "2025-01-15",
    }


def test_never_keeps_the_serial_number():
    info = extract_primary_device(_payload(_device(1), primary_id=1))

    assert "serialNumber" not in info
    assert "DEMOSERIAL1" not in str(info)


def test_picks_the_primary_device_among_several():
    payload = _payload(
        _device(1, displayName="Edge 530", primary=False),
        _device(2, displayName="Forerunner 265"),
        primary_id=2,
    )

    assert extract_primary_device(payload)["deviceName"] == "Forerunner 265"


def test_falls_back_to_the_flagged_primary_when_the_id_is_unknown():
    payload = _payload(
        _device(1, displayName="Edge 530", primary=False),
        _device(2, displayName="Forerunner 265"),
        primary_id=None,
    )

    assert extract_primary_device(payload)["deviceName"] == "Forerunner 265"


def test_returns_nothing_without_registered_devices():
    assert extract_primary_device({"RegisteredDevices": []}) == {}
    assert extract_primary_device({}) == {}


def test_tolerates_partial_device_records():
    payload = _payload({"deviceId": 7, "productDisplayName": "Venu 3"}, primary_id=7)

    assert extract_primary_device(payload) == {"deviceName": "Venu 3"}
