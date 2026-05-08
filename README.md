# CropTwin AI

A full-stack AI digital twin platform for vertical farming, featuring real-time IoT simulation, crop health scoring, predictive alerts, AI recommendations, device control, sustainability tracking, and a Chat-to-Farm assistant.

## Monorepo Structure

- `backend/` - FastAPI service, REST API, WebSocket stream, decision engine, and SQLite schema.
- `frontend/` - React + Vite + Tailwind dashboard for the farm digital twin.
- `simulator/` - Mock IoT stream that posts sensor readings into the backend.
- `hardware/` - ESP32 client sketch for physical sensor ingestion.
- `docs/` - Architecture notes, API contract, and demo flow.

## AI Chat Setup

The Chat-to-Farm assistant is AI-only. It uses live farm data as context and sends the conversation to DeepSeek or Gemini; it does not generate farm answers from keyword templates or hard-coded local chat fallback.

To enable the assistant:
1. Copy `backend/.env.example` to `backend/.env`.
2. Add one API key:
   - `DEEPSEEK_API_KEY=your_key_here`
   - or `GEMINI_API_KEY=your_key_here`
3. Restart the backend.

If no key is configured, the chat endpoint returns a setup message instead of pretending to answer intelligently. Core farm calculations, health scoring, alerts, and safety checks still run locally.

## Quick Start

### 1. Start Backend

**Windows (PowerShell):**
```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Linux / macOS:**
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
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

Keep the backend running first.

**Windows (PowerShell):**
```powershell
cd simulator
# (Optional) python -m venv .venv; .venv\Scripts\activate
pip install -r requirements.txt
python mock_iot_stream.py --scenario high_humidity
```

**Linux / macOS:**
```bash
cd simulator
# (Optional) python3 -m venv .venv; source .venv/bin/activate
pip install -r requirements.txt
python3 mock_iot_stream.py --scenario high_humidity
```

Available demo scenarios:

```powershell
python mock_iot_stream.py --scenario normal
python mock_iot_stream.py --scenario high_humidity
python mock_iot_stream.py --scenario low_moisture
python mock_iot_stream.py --scenario ph_drift
python mock_iot_stream.py --scenario fan_activated
```

IoT smoke test:

```powershell
python mock_iot_stream.py --scenario normal --once
```

IoT/ESP32 setup notes are in `docs/IOT_SETUP.md`.

## Full Local Run Example

### Windows (PowerShell)
1. **Terminal 1 (Backend):** `cd backend; .venv\Scripts\activate; uvicorn app.main:app --reload --port 8000`
2. **Terminal 2 (Frontend):** `cd frontend; npm run dev`
3. **Terminal 3 (Simulator):** `cd simulator; python mock_iot_stream.py --scenario normal`

### Linux / macOS
1. **Terminal 1 (Backend):** `cd backend; source .venv/bin/activate; uvicorn app.main:app --reload --port 8000`
2. **Terminal 2 (Frontend):** `cd frontend; npm run dev`
3. **Terminal 3 (Simulator):** `cd simulator; source .venv/bin/activate; python3 mock_iot_stream.py --scenario normal`

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
