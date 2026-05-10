# CropTwin AI Mock IoT Stream

The simulator acts as the IoT layer for the hackathon demo. It sends synthetic sensor readings into the backend exactly like an ESP32 or gateway would.

## Quick Test

```powershell
pip install -r requirements.txt
python mock_iot_stream.py --scenario normal --once
```

`--once` sends one reading for every farm layer and exits. Use it to prove the backend ingestion route is working.

## Continuous Stream

```powershell
python mock_iot_stream.py --scenario high_humidity --interval 2
```

Scenarios:

- `normal`
- `high_humidity`
- `low_moisture`
- `ph_drift`
- `fan_activated`

The stream fetches live device states from the backend. If a fan, pump, or misting command is active, the generated readings respond to that control state.
