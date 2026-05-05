# Demo Flow

Target length: 5 minutes.

## 1. Problem

Vertical farms can waste water and energy when growers react late to humidity, moisture, pH, and lighting issues.

## 2. Digital Twin

Open the dashboard and show each farm layer with crop, health score, status, latest readings, and device state.

## 3. Live Incident

Run:

```bash
python simulator/mock_iot_stream.py --scenario high_humidity
```

Show Layer 2 humidity rising, the health score dropping, and the alert panel updating.

## 4. Prediction and Recommendation

Point to the risk alert and AI recommendation. Explain that the current MVP uses explainable scoring logic and can later evolve into a reinforcement-learning optimizer.

## 5. Closed Control Loop

Click the fan control for Layer 2. Then run:

```bash
python simulator/mock_iot_stream.py --scenario fan_activated
```

Show humidity decreasing and the layer recovering.

## 6. Chat-to-Farm

Ask:

```text
What happened to Layer 2 today?
```

Show that the assistant answers from system data, not generic chatbot text.

## 7. Impact

Close with water savings, energy optimization, crop health improvement, and hardware readiness for ESP32 sensors.
