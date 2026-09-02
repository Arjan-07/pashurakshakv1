"""
PashuRakshak - SIH 2026 MVP
Run everything with:  python app.py
Then open:             http://127.0.0.1:8000
"""

import uuid
import webbrowser
import threading
from datetime import datetime, timedelta
from math import sqrt
from pathlib import Path
from typing import Optional

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR / "frontend"

app = FastAPI(title="PashuRakshak API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# In-memory demo data store (same behaviour as the original prototype)
# ---------------------------------------------------------------------------
reports = []
clusters = []
investigations = []
alerts = []
samples = []


class ReportIn(BaseModel):
    species: str
    animal_id: str = ""
    age: Optional[int] = None
    sex: str = "Unknown"
    breed: str = ""
    affected_animals: int = Field(1, ge=1)
    symptoms: list[str] = []
    severity: str = "Moderate"
    symptom_start: str = ""
    deaths: int = Field(0, ge=0)
    vaccination: str = "Unknown"
    treatment: str = ""
    description: str = ""
    lat: float
    lng: float
    village: str = "Demo Village"


class InvestigationIn(BaseModel):
    cluster_id: str
    assigned_worker: str
    notes: str = ""
    sample_required: bool = False


def risk_score(recent):
    if not recent:
        return 0
    affected = sum(r["affected_animals"] for r in recent)
    deaths = sum(r["deaths"] for r in recent)
    villages = len(set(r["village"] for r in recent))
    symptom_sets = [set(r["symptoms"]) for r in recent if r["symptoms"]]
    similarity = 0
    if len(symptom_sets) >= 2:
        common = set.intersection(*symptom_sets)
        similarity = min(15, len(common) * 5)
    score = min(
        100,
        len(recent) * 4
        + min(affected, 30)
        + min(villages * 5, 20)
        + min(deaths * 8, 20)
        + similarity,
    )
    return score


def classify(score):
    if score <= 25:
        return "Normal"
    if score <= 50:
        return "Watch"
    if score <= 75:
        return "High Risk"
    return "Potential Cluster"


def detect():
    global clusters, alerts
    now = datetime.utcnow()
    recent = [
        r for r in reports
        if now - datetime.fromisoformat(r["created_at"]) <= timedelta(hours=48)
    ]
    if len(recent) < 3:
        return None
    lat = sum(r["lat"] for r in recent) / len(recent)
    lng = sum(r["lng"] for r in recent) / len(recent)
    nearby = [r for r in recent if sqrt((r["lat"] - lat) ** 2 + (r["lng"] - lng) ** 2) < 0.09]
    score = risk_score(nearby)
    if score < 51:
        return None
    c = {
        "id": "CL-" + str(uuid.uuid4())[:8].upper(),
        "reports": len(nearby),
        "affected": sum(r["affected_animals"] for r in nearby),
        "villages": len(set(r["village"] for r in nearby)),
        "risk": score,
        "status": classify(score),
        "lat": lat,
        "lng": lng,
        "trend": "Increasing",
        "assigned_vet": "Unassigned",
        "investigation_status": "Reported",
        "created_at": now.isoformat(),
    }
    clusters[:] = [x for x in clusters if x["created_at"] > (now - timedelta(hours=2)).isoformat()]
    clusters.append(c)
    if not any(a["cluster_id"] == c["id"] for a in alerts):
        alerts.append(
            {
                "id": "AL-" + str(uuid.uuid4())[:8].upper(),
                "cluster_id": c["id"],
                "priority": "HIGH",
                "message": f'{c["reports"]} related livestock health reports detected across {c["villages"]} nearby villages within 48 hours.',
                "created_at": now.isoformat(),
            }
        )
    return c


# ---------------------------------------------------------------------------
# API routes (defined BEFORE the static mount so they always take priority)
# ---------------------------------------------------------------------------
@app.get("/api/health")
def health():
    return {"status": "ok", "service": "PashuRakshak"}


@app.get("/api/dashboard")
def dashboard():
    score = clusters[-1]["risk"] if clusters else 18
    return {
        "animals": sum(r["affected_animals"] for r in reports) + 124,
        "reports_today": len(reports),
        "active_investigations": len([i for i in investigations if i["status"] != "Resolved"]),
        "high_risk": len([c for c in clusters if c["risk"] >= 51]),
        "clusters": len(clusters),
        "vaccination": 78,
        "pending_lab": len([s for s in samples if s["status"] != "Result Available"]),
        "risk": score,
    }


@app.get("/api/reports")
def get_reports():
    return reports[-100:]


@app.post("/api/reports")
def create_report(report: ReportIn):
    item = report.model_dump()
    item["id"] = "R-" + str(uuid.uuid4())[:8].upper()
    item["created_at"] = datetime.utcnow().isoformat()
    reports.append(item)
    detect()
    return {"report": item, "cluster": clusters[-1] if clusters else None}


@app.get("/api/clusters")
def get_clusters():
    return clusters


@app.get("/api/alerts")
def get_alerts():
    return alerts


@app.post("/api/investigations")
def create_investigation(x: InvestigationIn):
    item = x.model_dump()
    item.update(
        {
            "id": "INV-" + str(uuid.uuid4())[:8].upper(),
            "status": "Investigation Assigned",
            "created_at": datetime.utcnow().isoformat(),
        }
    )
    investigations.append(item)
    for c in clusters:
        if c["id"] == x.cluster_id:
            c["investigation_status"] = item["status"]
    if x.sample_required:
        samples.append(
            {
                "id": "S-" + str(uuid.uuid4())[:8].upper(),
                "investigation_id": item["id"],
                "sample_type": "Blood/Swab",
                "status": "Pending",
                "result": "",
            }
        )
    return item


@app.post("/api/simulate")
def simulate():
    base_lat, base_lng = 30.34, 76.39
    villages = ["Village A", "Village B", "Village C", "Village D"]
    symptoms = ["Fever", "Reduced appetite", "Lethargy"]
    for idx, count in enumerate([5, 4, 7]):
        for j in range(count):
            create_report(
                ReportIn(
                    species="Cattle",
                    animal_id=f"SIM-{idx}{j}",
                    age=3 + j % 5,
                    sex="Female",
                    breed="Sahiwal",
                    affected_animals=1,
                    symptoms=symptoms,
                    severity="Severe" if j % 4 == 0 else "Moderate",
                    symptom_start="2026-09-01",
                    deaths=1 if j == 0 and idx == 2 else 0,
                    vaccination="Unknown",
                    description="Synthetic SIH demonstration report.",
                    lat=base_lat + idx * 0.025 + (j % 3) * 0.003,
                    lng=base_lng + idx * 0.025 + (j % 2) * 0.003,
                    village=villages[idx],
                )
            )
    return {"message": "Simulation complete", "reports_added": 16, "cluster": clusters[-1] if clusters else None}


# ---------------------------------------------------------------------------
# Serve the frontend (plain HTML/CSS/JS - no Node/npm build step needed)
# Mounted LAST so it never shadows the /api routes above.
# ---------------------------------------------------------------------------
app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")


def _open_browser():
    webbrowser.open("http://127.0.0.1:8000")


if __name__ == "__main__":
    threading.Timer(1.2, _open_browser).start()
    uvicorn.run(app, host="127.0.0.1", port=8000)
