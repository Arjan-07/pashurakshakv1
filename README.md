# PashuRakshak — SIH 2026 MVP (single-command local build)

A runnable prototype of the Livestock Disease Early Warning & Surveillance System.
This version has been converted to run entirely with Python — no Node.js/npm
install or build step needed.

## Run it

```bash
pip install -r requirements.txt
python app.py
```

That's it. This starts the API + serves the website together at:

**http://127.0.0.1:8000**

It also tries to auto-open that URL in your default browser after ~1 second.

## What changed from the original prototype

- The React + Vite frontend was rewritten as plain HTML/CSS/JS
  (`frontend/index.html`, `frontend/styles.css`, `frontend/app.js`) — same
  look, same behavior, but no build tooling required. It loads Leaflet (map)
  and Lucide (icons) from a CDN via plain `<script>` tags.
- `app.py` at the project root combines the old `backend/main.py` FastAPI
  logic with a static file mount that serves the `frontend/` folder, and
  calls `uvicorn.run(...)` itself so a single `python app.py` boots
  everything — API and website together on one port (8000).
- All original API behavior (risk scoring, cluster detection, simulation,
  investigations) is unchanged.

## What works

- Unified farmer → risk → cluster → veterinary alert workflow
- Farmer health-report form with structured symptom buttons
- Explainable 0–100 risk indicator
- Spatial/temporal demo cluster detection
- Interactive GIS map using OpenStreetMap + Leaflet
- Potential-cluster alerts
- Offline/online indicator and local last-report persistence
- English / हिन्दी / मराठी selector scaffold
- Dashboard analytics
- One-click **Run Outbreak Simulation**
- FastAPI backend with CORS
- PostgreSQL/PostGIS target schema (`database/schema.sql`, for a future step)

## Demo script

1. Open the dashboard (opens automatically, or go to http://127.0.0.1:8000).
2. Click **Run Outbreak Simulation**.
3. Watch synthetic reports appear on the map.
4. The risk engine increases and a **Potential Cluster** is created.
5. The alert banner shows the veterinary warning.
6. Click **New Health Report** to demonstrate farmer intake.
7. Toggle your device/browser offline to demonstrate the connectivity state.

## Important prototype note

The backend deliberately uses in-memory data so the demo runs without a
database — restarting `python app.py` resets it. `database/schema.sql` is the
PostgreSQL/PostGIS migration target for the next integration step.

Risk is a surveillance indicator, not a diagnosis. The UI intentionally uses
"Potential Cluster", "High Risk", "Watch", and "Normal" terminology.

## Project structure

```
pashurakshak-local/
├── app.py              # run this: FastAPI backend + serves the frontend
├── requirements.txt
├── frontend/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── database/
│   └── schema.sql       # future PostgreSQL/PostGIS target
└── docs/
    ├── architecture.md
    └── demo-data.md
```
