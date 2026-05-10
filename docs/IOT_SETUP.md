# IoT Lead Setup

This document covers the IoT Lead deliverable for CropTwin AI: the mock telemetry stream, ESP32 readiness, and the data path into the live digital twin.

## Ownership

- Mock sensor stream for all 15 farm layers.
- Scenario simulation for normal operation, high humidity, low moisture, pH drift, and fan recovery.
- ESP32 HTTP client sketch for real sensor ingestion.
- Validation that sensor readings reach the backend, trigger health scoring, and update the React dashboard through WebSocket.

## Data Flow

```text
Mock IoT Stream or ESP32
  -> POST /api/sensors/readings
  -> FastAPI validates payload
  -> Health score, alert, recommendation generated
  -> SQLite persistence
  -> WebSocket layer_update event
  -> React layer cards and live telemetry chart
```

## Sensor Payload

Each sensor reading must include:

```json
{
  "layer_id": "a_01",
  "temperature": 22.5,
  "humidity": 61.2,
  "soil_moisture": 68.4,
  "ph": 6.1,
  "light_intensity": 575,
  "water_level": 80,
  "timestamp": "2026-05-05T12:00:00Z"
}
```

Valid layer ids are `a_01` to `a_05`, `b_01` to `b_05`, and `c_01` to `c_05`.

## Mock Stream

Start backend first:

```powershell
cd backend
.venv\Scripts\activate
uvicorn app.main:app --reload --port 8000
```

Run a one-shot smoke test:

```powershell
cd simulator
pip install -r requirements.txt
python mock_iot_stream.py --scenario normal --once
```

Run continuous live telemetry:

```powershell
python mock_iot_stream.py --scenario normal --interval 2
```

Demo scenarios:

```powershell
python mock_iot_stream.py --scenario high_humidity --interval 2
python mock_iot_stream.py --scenario low_moisture --interval 2
python mock_iot_stream.py --scenario ph_drift --interval 2
python mock_iot_stream.py --scenario fan_activated --interval 2
```

## Scenario Meaning

- `normal`: all layers drift slowly around their crop recipe.
- `high_humidity`: B-1 and B-2 humidity rises to trigger herb-wing alerts.
- `low_moisture`: A-1 and A-2 moisture falls to test pump recommendations.
- `ph_drift`: C-1 and C-2 pH rises to test fruit-wing diagnosis.
- `fan_activated`: B-1 and B-2 humidity decreases to demonstrate recovery after fan control.

## ESP32 Setup

Firmware sketch:

```text
hardware/esp32_client/esp32_client.ino
```

Required Arduino libraries:

- WiFi
- HTTPClient
- ArduinoJson

Update these values before flashing:

```cpp
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* serverUrl = "http://YOUR_COMPUTER_IP:8000/api/sensors/readings";
const char* layerId = "a_01";
```

Your computer and ESP32 must be on the same network. Use your computer LAN IP, not `localhost`, because `localhost` on ESP32 points to the ESP32 itself.

## Validation Checklist

- `python mock_iot_stream.py --once` prints one successful response per layer.
- Backend `/api/farm` shows updated `latest_reading` values.
- Frontend `Live` badge is green.
- Layer health score changes when scenario values drift.
- Alerts page shows high humidity or low moisture warnings during incident scenarios.
- Layer chart appends points for the selected layer while the stream is running.

## Demo Script

1. Start backend and frontend.
2. Run `python mock_iot_stream.py --scenario high_humidity --interval 2`.
3. Open the dashboard and show B-1/B-2 humidity rising.
4. Show Alerts and Suggested Actions.
5. Use Control page or safe AI command to turn on the fan.
6. Run `python mock_iot_stream.py --scenario fan_activated --interval 2`.
7. Show humidity recovery and health score stabilization.
