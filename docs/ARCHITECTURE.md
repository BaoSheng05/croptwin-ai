# CropTwin AI Architecture

## Product Direction

CropTwin AI is a digital twin platform for precision urban vertical farming. It turns sensor readings into health scores, risk alerts, recommended actions, control commands, and plain-language farm explanations.

## Flow

```text
Mock IoT / ESP32 Sensors
  -> FastAPI REST ingestion
  -> Decision engine
  -> SQLite persistence
  -> WebSocket live updates
  -> React dashboard
  -> User / auto device control
```

## MVP Layers

- IoT simulation: `simulator/mock_iot_stream.py` generates temperature, humidity, soil moisture, pH, light, and water-level readings.
- Backend API: `backend/app` exposes sensor ingestion, farm overview, alerts, recommendations, device commands, chat, and WebSocket updates.
- Database: `backend/db/schema.sql` defines the MVP SQLite tables. The first skeleton keeps runtime state in memory so the demo can move quickly.
- AI decision layer: rule-based scoring, predictive trend checks, recommendation scoring, and Chat-to-Farm templates.
- Frontend: `frontend/src` shows overview metrics, farm layer cards, charts, alerts, recommendations, controls, and assistant responses.

## Extension Points

- Replace in-memory store with SQLite repositories using `backend/db/schema.sql`.
- Add MQTT as an alternate ingestion path.
- Add ESP32 firmware that posts to `POST /api/sensors/readings`.
- Replace rule-based Chat-to-Farm templates with an LLM using system data as context.
- Add image diagnosis as a bonus route and UI panel.
