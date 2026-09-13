# CropGuardian

CropGuardian is an agronomic early-warning dashboard for monitoring crop microclimate risk, generating AI-supported advisories, and testing what-if field scenarios. It combines live or local JKUAT Conduit weather telemetry, deterministic agronomic rules, Claude-generated recommendations, and an Adaption-based forecasting workflow.

## Features

- Live current-condition dashboard for humidity, WBGT heat stress, rainfall, solar irradiance, wind speed, and pressure.
- Early warning alerts for fungal disease pressure, heat stress, soil washout, spray-window suitability, moisture stress, and wind risk.
- AI Agronomy Advisor that generates crop- and growth-stage-specific recommendations.
- AI Assistant and scenario tester for asking agronomy questions and simulating weather changes.
- Next-hour microclimate forecast panel using an Adaption AutoScientist model when available, with a trend fallback.
- Advisory history and action log for reviewing recommendations and tracking intervention outcomes.
- Dynamic crop catalog served from the backend, including crop-specific growth stages.
- Simple field risk map that colors demo plots by current rule-engine risk.

## Tech Stack

- Frontend: React, Vite, JavaScript, Tailwind-style utility classes.
- Backend: FastAPI, Pydantic, Uvicorn, Python.
- Data source: JKUAT Conduit weather telemetry, with local CSV fallback.
- AI advisory: Anthropic Claude via the `anthropic` Python SDK.
- Forecasting: Adaption AutoScientist-trained model workflow, loaded locally through `forecast_service.py` when configured.

## How AI Is Used

### Claude AI

Claude is used in `cropguardian-backend/ai_service.py` to generate agronomic text and structured recommendations. The backend sends Claude:

- current telemetry values,
- deterministic rule-engine risk levels,
- active alerts,
- selected crop,
- selected growth stage.

Claude returns a JSON advisory with:

- summary,
- risk overview,
- recommended actions,
- urgency levels.

If `ANTHROPIC_API_KEY` is missing or the Claude request fails, CropGuardian falls back to deterministic rule-based recommendations so the app remains usable.

### Adaption

Adaption is used for predictive forecasting in `cropguardian-backend/models/conduit-forecaster/forecast_service.py`. The intended flow is:

1. Use recent JKUAT Conduit telemetry history.
2. Pass the last three hourly readings into the trained Adaption AutoScientist model.
3. Forecast next-hour weather conditions.
4. Run the predicted telemetry through the same deterministic rule engine.
5. Display the predicted risk in the frontend forecast panel.

If the Adaption model or runtime dependencies are unavailable, the backend uses a short-term trend forecast fallback.

## Project Structure

```txt
cropguardian-backend/
  ai_service.py
  crops.py
  main.py
  rules.py
  schemas.py
  data/
  models/conduit-forecaster/

cropguardian-frontend/
  src/
    App.jsx
    api.js
    cropCatalog.js
    components/
```

## Setup

### 1. Backend

```bash
cd cropguardian-backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Create a `.env` file if you want live telemetry and Claude/Adaption support:

```bash
ANTHROPIC_API_KEY=your_anthropic_key
JKUAT_CONDUIT_URL=https://conduit.jhubafrica.com/data.php
CONDUIT_API_KEY=your_conduit_key
CONDUIT_EMAIL=your_conduit_email
ADAPTION_API_KEY=your_adaption_key
AUTOSCIENTIST_RUN_ID=your_run_id
```

Start the backend:

```bash
uvicorn main:app --reload --port 8001
```

### 2. Frontend

```bash
cd cropguardian-frontend
npm install
npm run dev
```

The frontend defaults to:

```txt
http://localhost:5173
```

The frontend API base URL defaults to:

```txt
http://localhost:8001
```

To override it:

```bash
VITE_API_URL=http://localhost:8001 npm run dev
```

## Useful Commands

Build frontend:

```bash
cd cropguardian-frontend
npm run build
```

Compile backend files:

```bash
cd cropguardian-backend
python3 -m py_compile main.py schemas.py rules.py crops.py ai_service.py
```

## Main API Endpoints

- `GET /api/v1/telemetry/current`
- `GET /api/v1/telemetry/history`
- `GET /api/v1/telemetry/history/export`
- `GET /api/v1/crops`
- `GET /api/v1/agronomy/assess`
- `GET /api/v1/agronomy/forecast`
- `POST /api/v1/agronomy/advisory`
- `GET /api/v1/advisories`
- `POST /api/v1/ai-assistant/chat`
- `POST /api/v1/ai-assistant/scenario`

## Notes

- The deterministic rule engine is in `cropguardian-backend/rules.py`.
- The crop catalog is in `cropguardian-backend/crops.py`.
- The frontend crop dropdowns load from `GET /api/v1/crops` and keep a small fallback list.
- Do not commit `.env`, API keys, `node_modules`, backend virtual environments, or generated build output.
