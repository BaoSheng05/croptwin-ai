# CropTwin AI

**Repository:** `croptwin-ai`

CropTwin AI is a full-stack AI digital twin platform for vertical farming, featuring real-time IoT simulation, crop health scoring, predictive alerts, and climate optimization.

## Project Overview

CropTwin AI helps growers monitor and manage a multi-layer vertical farm through a live digital twin. The system receives simulated or physical IoT sensor readings, evaluates crop conditions against crop recipes, updates layer health scores, generates alerts and recommendations, and streams updates to a React dashboard in real time.

This project refers to **UTMxHackathon’26 Case Study 1: Precision Urban Agriculture for Vertical Farming (IoT System / Web Dashboard / Mobile Application)**.

The repository is organized as a full-stack monorepo:

| Folder | Purpose |
| --- | --- |
| `backend/` | FastAPI backend, REST API, WebSocket service, decision engine, persistence, and domain routers. |
| `frontend/` | React, Vite, TypeScript, and Tailwind dashboard for monitoring and controlling the farm digital twin. |
| `simulator/` | Mock IoT stream for generating live sensor readings and demo scenarios. |
| `hardware/` | ESP32 client sketch for posting physical sensor readings into the same ingestion API. |
| `docs/` | API contract, architecture notes, demo flow, IoT setup, and project documentation. |

## Problem Statement

Vertical farms depend on tightly controlled growing conditions. When humidity, soil moisture, pH, temperature, light intensity, or water levels drift outside safe ranges, growers may respond too late, causing:

- **Crop health degradation:** Stress conditions reduce yield quality and harvest reliability.
- **Resource waste:** Late reactions can waste water, energy, nutrients, and labor.
- **Operational blind spots:** Raw sensor values are difficult to interpret without context.
- **Slow incident response:** Manual monitoring makes it hard to detect trends before they become critical.

CropTwin AI addresses these problems by turning sensor data into health scores, risk alerts, recommended actions, and live visual feedback.

## Solution

CropTwin AI provides a real-time digital twin workflow:

```text
Mock IoT Stream / ESP32 Sensors
  -> FastAPI Sensor Ingestion
  -> Decision Engine
  -> SQLite Persistence and Runtime Farm State
  -> WebSocket Live Updates
  -> React Dashboard
  -> User or Safe AI Device Control
```

The platform models a vertical farm with 15 layers across multiple crop zones. Each layer has crop-specific thresholds and device states. Sensor readings are processed into:

- **Health scores:** A unified 0-100 score for crop condition.
- **Layer status:** Healthy, Attention, Warning, or Critical.
- **Predictive alerts:** Early warnings for humidity, moisture, pH, and other risks.
- **Recommendations:** Suggested actions such as activating fans, pumps, misting, or adjusting operating conditions.
- **Climate and energy insights:** Dashboard tools for operational optimization.

Optional AI integrations through DeepSeek or Gemini enable the Chat-to-Farm assistant to explain current farm conditions using live platform data as context.

## Key Features

- **Real-time digital twin dashboard:** View farm-wide metrics, layer health, crop status, device states, and live telemetry.
- **Mock IoT simulator:** Stream synthetic readings for all 15 layers using repeatable demo scenarios.
- **ESP32-ready ingestion:** Physical sensors can post data to the same backend endpoint used by the simulator.
- **Crop health scoring:** Convert temperature, humidity, moisture, pH, light, and water-level readings into a simple health score.
- **Predictive alerts:** Detect risky deviations and trends before crop conditions become critical.
- **AI recommendations:** Generate explainable corrective actions for detected issues.
- **Device control simulation:** Trigger fan, pump, lighting, and other control actions through the dashboard.
- **Closed-loop demo recovery:** Show incident detection, control action, and recovery using scenario-based telemetry.
- **Yield forecasting:** Estimate yield, revenue, confidence, harvest readiness, and production confidence.
- **Energy optimizer:** Surface energy-related operating insights and optimization opportunities.
- **Climate Shield:** Visualize climate and environmental risk signals for protected farming decisions.
- **Market Intel:** Compare Malaysia-focused vertical farm city opportunities with scoring and supporting signals.
- **Crop recipe management:** Maintain crop-specific ideal ranges for farm operations.
- **Chat-to-Farm assistant:** Ask natural language questions about farm conditions when an AI API key is configured.
- **Voice control and onboarding UI:** Navigate and trigger safe commands through interactive dashboard tools.

## System Architecture

### Backend

The backend is a FastAPI application located in `backend/app`. Its entry point is `backend/app/main.py`, which registers domain routers under `/api`, configures CORS, initializes the database, loads persisted farm state, seeds initial readings, and exposes a `/health` endpoint.

Main backend responsibilities:

- **Sensor ingestion:** `POST /api/sensors/readings`
- **Farm overview:** `GET /api/farm`
- **Layer state:** `GET /api/layers`
- **Alerts and recommendations:** `GET /api/alerts`, `GET /api/recommendations`
- **Device commands:** `POST /api/devices/commands`
- **Demo scenarios:** Scenario endpoints for controlled incident simulation
- **AI routes:** Chat-to-Farm and safe command workflows
- **Analytics routes:** Energy, climate, market, yield, and related operational insights
- **WebSocket stream:** `ws://localhost:8000/api/ws/farm`

### Frontend

The frontend is a React application located in `frontend/src`. It uses Vite, TypeScript, Tailwind CSS, Recharts, React Router, and Lucide icons.

Main dashboard pages include:

- **Dashboard:** Farm overview, live stream state, health score, and demo flow.
- **Simulator & Detector:** What-if scenarios and incident testing.
- **Alerts:** Active and historical risk alerts.
- **Control Panel:** Device control and safe command execution.
- **Yield Forecast:** Yield, revenue, confidence, and harvest readiness.
- **Layer Detail:** Per-layer crop, reading, status, and chart details.
- **Operations Timeline:** Operational event storytelling and history.
- **Energy Optimizer:** Energy performance and optimization insights.
- **Climate Shield:** Environmental and climate-risk view.
- **Market Intel:** Malaysia city scoring for vertical farm expansion decisions.
- **Crop Recipe:** Crop threshold and recipe management.

### IoT and Data Flow

The simulator in `simulator/mock_iot_stream.py` acts as the IoT layer for local testing and demos. It generates readings for:

- **Temperature**
- **Humidity**
- **Soil moisture**
- **pH**
- **Light intensity**
- **Water level**

Supported layer IDs include `a_01` to `a_05`, `b_01` to `b_05`, and `c_01` to `c_05`.

The ESP32 sketch in `hardware/esp32_client/esp32_client.ino` demonstrates how physical sensors can send real readings to the backend over HTTP.

## Tech Stack

| Layer | Technologies |
| --- | --- |
| Frontend | React 19, Vite 6, TypeScript, Tailwind CSS, React Router, Recharts, Lucide React |
| Backend | Python, FastAPI, Uvicorn, SQLAlchemy, Pydantic Settings |
| Database | SQLite by default through `DATABASE_URL` configuration |
| Real-time Updates | WebSocket stream from FastAPI to React dashboard |
| IoT Simulation | Python mock telemetry stream with scenario modes |
| Hardware Readiness | ESP32 Arduino sketch using WiFi, HTTPClient, and ArduinoJson |
| Optional AI | DeepSeek API or Gemini API for Chat-to-Farm and AI-assisted workflows |

## Setup Instructions

### Prerequisites

- **Python:** 3.10 or newer recommended
- **Node.js:** 18 or newer recommended
- **npm:** Included with Node.js
- **Git:** For cloning and version control

### 1. Clone the Repository

```bash
git clone https://github.com/BaoSheng05/croptwin-ai.git
cd croptwin-ai
```

### 2. Start the Backend

#### Windows PowerShell

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

If PowerShell blocks virtual environment activation, run:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.venv\Scripts\activate
```

#### macOS

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

#### Linux

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Backend URLs:

- **Health check:** `http://localhost:8000/health`
- **API docs:** `http://localhost:8000/docs`
- **WebSocket:** `ws://localhost:8000/api/ws/farm`

### 3. Start the Frontend

Open a second terminal.

#### Windows PowerShell

```powershell
cd frontend
npm install
npm run dev
```

#### macOS

```bash
cd frontend
npm install
npm run dev
```

#### Linux

```bash
cd frontend
npm install
npm run dev
```

Frontend URL:

- **Dashboard:** `http://localhost:5173`

### 4. Start the Mock IoT Simulator

Open a third terminal after the backend is running:

#### Windows PowerShell

```powershell
cd simulator
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python mock_iot_stream.py --scenario normal --interval 2
```

One-shot ingestion smoke test:

```powershell
python mock_iot_stream.py --scenario normal --once
```

#### macOS

```bash
cd simulator
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python3 mock_iot_stream.py --scenario normal --interval 2
```

One-shot ingestion smoke test:

```bash
python3 mock_iot_stream.py --scenario normal --once
```

#### Linux

```bash
cd simulator
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python3 mock_iot_stream.py --scenario normal --interval 2
```

One-shot ingestion smoke test:

```bash
python3 mock_iot_stream.py --scenario normal --once
```

Available simulator scenarios:

- **`normal`:** All layers drift around their crop recipe.
- **`high_humidity`:** Herb-wing humidity rises to trigger humidity alerts.
- **`low_moisture`:** Moisture drops to test pump recommendations.
- **`ph_drift`:** pH rises to test crop diagnosis.
- **`fan_activated`:** Humidity decreases to demonstrate recovery after fan control.

### 5. Optional AI Chat Setup

The Chat-to-Farm assistant requires at least one AI API key. Without a key, core farm scoring, alerts, recommendations, simulation, and device controls still run locally.

Create `backend/.env` from `backend/.env.example`, then add one of:

```env
DEEPSEEK_API_KEY=your_key_here
GEMINI_API_KEY=your_key_here
```

Restart the backend after changing environment variables.

### 6. Optional Frontend Environment

If the backend is not running on port `8000`, create or update `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:8001
VITE_WS_BASE_URL=ws://localhost:8001
```

## Demo Flow

Recommended 5-minute demo sequence:

| Step | Demo Action |
| --- | --- |
| 1. Problem | Explain that vertical farms lose yield and waste resources when growers react late to humidity, moisture, pH, temperature, and lighting issues. |
| 2. Digital Twin | Open `http://localhost:5173` and show farm layers, crop type, health score, latest readings, and device states. |
| 3. Live Incident | Run `python mock_iot_stream.py --scenario high_humidity --interval 2` and show humidity rising, health score dropping, and alerts appearing. |
| 4. Prediction and Recommendation | Open Alerts or Dashboard recommendations and explain the suggested corrective action. |
| 5. Closed Control Loop | Use the Control Panel to activate the fan, then run `python mock_iot_stream.py --scenario fan_activated --interval 2` to show recovery. |
| 6. Chat-to-Farm | Ask “What happened to Layer 2 today?” and show that the assistant explains farm conditions from system data when an AI key is configured. |
| 7. Impact | Close with water savings, energy optimization, crop health improvement, and ESP32 readiness. |

## Team Members

| Name | Role |
| --- | --- |
| ADAM ASHWIN TAY | Project Lead / Full-stack Developer |
| TAN WEI CHAO | Backend / AI Engineer |
| LIM YONG ZHOU | Frontend / UI Engineer |
| CH‘NG BAO SHENG | IoT / Hardware Engineer |

## Future Improvements

- **Persistent cloud database:** Move from local SQLite to a production-ready managed database such as PostgreSQL.
- **MQTT ingestion:** Add MQTT support for larger IoT sensor fleets and gateway-based deployments.
- **Advanced AI optimization:** Extend recommendations into reinforcement learning or optimization models for climate recipes.
- **Image-based crop diagnosis:** Add plant image upload and disease detection workflows.
- **Richer analytics:** Expand historical trends, anomaly detection, yield analytics, and sustainability reporting.
- **Hardware deployment:** Connect real ESP32 sensor nodes and validate readings in a physical vertical farm setup.
- **Mobile-first dashboard polish:** Continue improving responsive layouts and field usability on tablets and phones.
- **Production security:** Add user authentication, role-based access control, and audit logs for device commands.
