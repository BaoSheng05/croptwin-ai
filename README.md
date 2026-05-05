# CropTwin AI

A full-stack AI digital twin platform for vertical farming, featuring real-time IoT simulation, crop health scoring, predictive alerts, AI recommendations, device control, sustainability tracking, and a Chat-to-Farm assistant.

## Monorepo Structure

- `backend/` - FastAPI service, REST API, WebSocket stream, decision engine, and SQLite schema.
- `frontend/` - React + Vite + Tailwind dashboard for the farm digital twin.
- `simulator/` - Mock IoT stream that posts sensor readings into the backend.
- `docs/` - Architecture notes, API contract, and demo flow.

## Quick Start

### 1. Start Backend

Open a PowerShell terminal from the project root:

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Backend URLs:

- API health check: `http://localhost:8000/health`
- API docs: `http://localhost:8000/docs`
- WebSocket: `ws://localhost:8000/api/ws/farm`

### 2. Start Frontend

Open a second PowerShell terminal from the project root:

```powershell
cd frontend
npm install
npm run dev
```

Frontend URL:

- Dashboard: `http://localhost:5173`

### 3. Start Mock IoT Simulator

Open a third PowerShell terminal from the project root. Keep the backend running first.

```powershell
cd simulator
pip install -r requirements.txt
python mock_iot_stream.py --scenario high_humidity
```

Available demo scenarios:

```powershell
python mock_iot_stream.py --scenario normal
python mock_iot_stream.py --scenario high_humidity
python mock_iot_stream.py --scenario low_moisture
python mock_iot_stream.py --scenario ph_drift
python mock_iot_stream.py --scenario fan_activated
```

## Full Local Run Example

Terminal 1:

```powershell
cd backend
.venv\Scripts\activate
uvicorn app.main:app --reload --port 8000
```

Terminal 2:

```powershell
cd frontend
npm run dev
```

Terminal 3:

```powershell
cd simulator
python mock_iot_stream.py --scenario high_humidity
```

Then open:

```text
http://localhost:5173
```

## Troubleshooting

If `python -m venv .venv` fails on Windows, run PowerShell as a normal user and try again. If activation is blocked, use:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.venv\Scripts\activate
```

If port `8000` or `5173` is already used, change the port:

```powershell
uvicorn app.main:app --reload --port 8001
npm run dev -- --port 5174
```

If you change the backend port, update `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:8001
VITE_WS_BASE_URL=ws://localhost:8001
```
