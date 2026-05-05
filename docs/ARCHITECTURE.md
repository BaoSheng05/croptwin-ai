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

- IoT simulation: `simulator/mock_iot_stream.py` generates temperature, humidity, soil moisture, pH, light, and water-level readings across all 15 layers, with scenario modes and a one-shot validation mode.
- ESP32 readiness: `hardware/esp32_client/esp32_client.ino` posts physical sensor readings to the same ingestion API as the simulator.
- Backend API: `backend/app` exposes sensor ingestion, farm overview, alerts, recommendations, device commands, chat, and WebSocket updates.
- Database: `backend/db/schema.sql` defines the MVP SQLite tables. The first skeleton keeps runtime state in memory so the demo can move quickly.
- AI decision layer: rule-based scoring, predictive trend checks, recommendation scoring, AI-only Chat-to-Farm context grounding, and safe command guardrails.
- Frontend: `frontend/src` shows overview metrics, farm layer cards, charts, alerts, recommendations, controls, and assistant responses.

## Extension Points

- Replace in-memory store with SQLite repositories using `backend/db/schema.sql`.
- Add MQTT as an alternate ingestion path.
- Add MQTT as an alternate ingestion path for larger sensor fleets.
- Add richer historical analytics on top of persisted sensor readings.
- Add image diagnosis as a bonus route and UI panel.
