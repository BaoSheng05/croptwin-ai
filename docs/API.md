# API Contract

Base URL: `http://localhost:8000`

## REST

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Service health check |
| `GET` | `/api/farm` | Farm overview, layers, metrics, sustainability |
| `GET` | `/api/layers` | Current layer state |
| `GET` | `/api/alerts` | Recent alerts |
| `GET` | `/api/recommendations` | Recent recommendations |
| `POST` | `/api/sensors/readings` | Ingest sensor reading and trigger decision engine |
| `POST` | `/api/devices/commands` | Simulate device control |
| `POST` | `/api/chat` | Chat-to-Farm assistant response |

## Sensor Reading Payload

```json
{
  "layer_id": "layer_02",
  "temperature": 29.4,
  "humidity": 82,
  "soil_moisture": 34,
  "ph": 6.9,
  "light_intensity": 720,
  "water_level": 71,
  "timestamp": "2026-05-05T02:00:00Z"
}
```

## Device Command Payload

```json
{
  "layer_id": "layer_02",
  "device": "fan",
  "value": true
}
```

## Chat Payload

```json
{
  "question": "What happened to Layer 2 today?",
  "layer_id": "layer_02"
}
```

## WebSocket

Connect to:

```text
ws://localhost:8000/api/ws/farm
```

Layer update event:

```json
{
  "event": "layer_update",
  "data": {
    "id": "layer_02",
    "crop": "Basil",
    "health_score": 64,
    "status": "Warning"
  },
  "alert": {
    "title": "High humidity detected"
  },
  "recommendation": {
    "action": "Turn on fan for 20 minutes"
  }
}
```
