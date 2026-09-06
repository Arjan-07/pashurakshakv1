import uuid, webbrowser, threading
from datetime import datetime, timedelta
from math import sqrt
from pathlib import Path
from typing import Optional

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

import db

BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR / "frontend"

app = FastAPI(title="PashuRakshak", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
def _startup():
    db.init_db()


class LoginIn(BaseModel):
    email: str
    password: str


class AnimalIn(BaseModel):
    farmer_id: str
    name: str
    tag: str
    species: str
    breed: str = ""
    age: int = 0
    sex: str = "Female"
    vaccination: str = "Unknown"


class ReportIn(BaseModel):
    farmer_id: str
    animal_id: str
    species: str
    animal_tag: str
    symptoms: list[str] = []
    severity: str = "Moderate"
    affected_animals: int = Field(1, ge=1)
    deaths: int = Field(0, ge=0)
    vaccination: str = "Unknown"
    description: str = ""
    village: str = "Demo Village"
    lat: float = 30.34
    lng: float = 76.39


class AssignIn(BaseModel):
    cluster_id: str
    worker_id: str
    notes: str = ""


class SampleIn(BaseModel):
    investigation_id: str
    sample_type: str = "Blood / Swab"


class ResultIn(BaseModel):
    result: str


SYMPTOM_MAP = {
    "fever": ["fever", "बुखार", "ताप"],
    "reduced appetite": ["reduced appetite", "कम खाना", "भूख"],
    "lethargy": ["lethargy", "सुस्त", "कमजोर"],
    "cough": ["cough", "खांसी"],
    "diarrhea": ["diarrhea", "दस्त", "जुलाब"],
}


def new_id(prefix):
    return prefix + "-" + str(uuid.uuid4())[:7].upper()


def score_report(r):
    score = 8 + r["affected_animals"] * 3 + r["deaths"] * 12
    score += {"Mild": 4, "Moderate": 12, "Severe": 24}.get(r["severity"], 10)
    if r["vaccination"] in ("Unknown", "Overdue", "No"):
        score += 7
    score += min(18, len(r["symptoms"]) * 4)
    return min(100, score)


def risk_label(score):
    if score <= 25: return "Normal"
    if score <= 50: return "Watch"
    if score <= 75: return "High Risk"
    return "Potential Cluster"


# ---- serialization: ORM row -> plain dict, same shape the frontend already expects ----

def animal_out(a: db.Animal) -> dict:
    return {"id": a.id, "farmer_id": a.farmer_id, "name": a.name, "tag": a.tag, "species": a.species,
            "breed": a.breed, "age": a.age, "sex": a.sex, "vaccination": a.vaccination, "created_at": a.created_at}


def report_out(r: db.Report) -> dict:
    return {"id": r.id, "farmer_id": r.farmer_id, "animal_id": r.animal_id, "species": r.species,
            "animal_tag": r.animal_tag, "symptoms": r.symptoms, "severity": r.severity,
            "affected_animals": r.affected_animals, "deaths": r.deaths, "vaccination": r.vaccination,
            "description": r.description, "village": r.village, "lat": r.lat, "lng": r.lng,
            "risk": r.risk, "risk_label": r.risk_label, "status": r.status, "created_at": r.created_at}


def cluster_out(c: db.Cluster) -> dict:
    return {"id": c.id, "reports": c.reports_count, "affected": c.affected, "villages": c.villages_count,
            "risk": c.risk, "status": c.status, "lat": c.lat, "lng": c.lng, "trend": c.trend,
            "assigned_worker": c.assigned_worker, "investigation_status": c.investigation_status,
            "created_at": c.created_at}


def alert_out(a: db.Alert) -> dict:
    return {"id": a.id, "cluster_id": a.cluster_id, "priority": a.priority, "message": a.message,
            "created_at": a.created_at}


def investigation_out(i: db.Investigation) -> dict:
    return {"id": i.id, "cluster_id": i.cluster_id, "assigned_worker": i.assigned_worker_id,
            "worker_name": i.worker_name, "notes": i.notes, "status": i.status,
            "sample_required": i.sample_required, "created_at": i.created_at}


def sample_out(s: db.Sample) -> dict:
    return {"id": s.id, "investigation_id": s.investigation_id, "sample_type": s.sample_type,
            "status": s.status, "result": s.result}


def detect_cluster(session: Session):
    cutoff = (datetime.utcnow() - timedelta(hours=48)).isoformat()
    recent = session.query(db.Report).filter(db.Report.created_at >= cutoff).all()
    if len(recent) < 3:
        return None
    lat = sum(r.lat for r in recent) / len(recent)
    lng = sum(r.lng for r in recent) / len(recent)
    near = [r for r in recent if sqrt((r.lat - lat) ** 2 + (r.lng - lng) ** 2) < 0.10]
    if len(near) < 3:
        return None
    common = set(near[0].symptoms)
    for r in near[1:]:
        common &= set(r.symptoms)
    score = min(100, len(near) * 6 + sum(r.affected_animals for r in near) * 2 + len(common) * 8 + sum(r.deaths for r in near) * 10)
    if score < 51:
        return None
    c = db.Cluster(id=new_id("CL"), reports_count=len(near), affected=sum(r.affected_animals for r in near),
                    villages_count=len({r.village for r in near}), risk=score, status="Potential Cluster",
                    lat=lat, lng=lng, trend="Increasing", assigned_worker=None,
                    investigation_status="Awaiting veterinary action", created_at=db.utcnow_iso())
    session.add(c)
    session.add(db.Alert(id=new_id("AL"), cluster_id=c.id, priority="HIGH",
                          message=f'{c.reports_count} related health reports detected across {c.villages_count} nearby villages.',
                          created_at=db.utcnow_iso()))
    session.flush()
    return cluster_out(c)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "PashuRakshak"}


@app.post("/api/login")
def login(x: LoginIn):
    with db.SessionLocal() as session:
        u = db.get_user_by_email(session, x.email)
        if not u or not u.check_password(x.password):
            raise HTTPException(401, "Invalid email or password")
        return {"token": "demo-" + u.id, "user": {"id": u.id, "name": u.name, "role": u.role}}


@app.get("/api/me/{user_id}")
def me(user_id: str):
    with db.SessionLocal() as session:
        u = session.get(db.User, user_id)
        if not u:
            raise HTTPException(404, "User not found")
        return {"id": u.id, "name": u.name, "role": u.role}


@app.post("/api/nl-extract")
def nl_extract(payload: dict):
    text = (payload.get("text") or "").lower()
    return {"symptoms": [k for k, v in SYMPTOM_MAP.items() if any(t in text for t in v)],
            "note": "Risk support only; not a confirmed diagnosis."}


@app.get("/api/animals")
def get_animals(farmer_id: Optional[str] = None):
    with db.SessionLocal() as session:
        q = session.query(db.Animal)
        if farmer_id:
            q = q.filter(db.Animal.farmer_id == farmer_id)
        return [animal_out(a) for a in q.all()]


@app.post("/api/animals")
def add_animal(x: AnimalIn):
    with db.SessionLocal() as session:
        item = db.Animal(id=new_id("AN"), created_at=db.utcnow_iso(), **x.model_dump())
        session.add(item)
        session.flush()
        session.add(db.Vaccination(animal_id=item.id, vaccination=item.vaccination, status="Recorded"))
        session.commit()
        return animal_out(item)


@app.get("/api/reports")
def get_reports(role: Optional[str] = None, user_id: Optional[str] = None):
    with db.SessionLocal() as session:
        if role == "farmer" and user_id:
            rows = session.query(db.Report).filter(db.Report.farmer_id == user_id).all()
        else:
            rows = session.query(db.Report).order_by(db.Report.created_at.desc()).limit(200).all()
        return [report_out(r) for r in rows]


@app.post("/api/reports")
def add_report(x: ReportIn):
    with db.SessionLocal() as session:
        fields = x.model_dump()
        risk = score_report(fields)
        item = db.Report(id=new_id("R"), created_at=db.utcnow_iso(), risk=risk,
                          risk_label=risk_label(risk), status="New", **fields)
        session.add(item)
        session.flush()

        cluster = detect_cluster(session)
        if item.risk >= 51 or cluster:
            session.add(db.Alert(
                id=new_id("AL"), cluster_id=cluster["id"] if cluster else None, priority="HIGH",
                message=f'{item.animal_tag} reported with {", ".join(item.symptoms) or "health concerns"} — veterinary review recommended.',
                created_at=db.utcnow_iso()))
        session.commit()
        return {"report": report_out(item), "cluster": cluster}


@app.get("/api/clusters")
def get_clusters():
    with db.SessionLocal() as session:
        rows = session.query(db.Cluster).order_by(db.Cluster.created_at.desc()).limit(100).all()
        return [cluster_out(c) for c in rows]


@app.get("/api/alerts")
def get_alerts():
    with db.SessionLocal() as session:
        rows = session.query(db.Alert).order_by(db.Alert.created_at.desc()).limit(100).all()
        return [alert_out(a) for a in rows]


@app.post("/api/investigations")
def assign_worker(x: AssignIn):
    with db.SessionLocal() as session:
        c = session.get(db.Cluster, x.cluster_id)
        if not c:
            raise HTTPException(404, "Cluster not found")
        w = session.query(db.User).filter(db.User.id == x.worker_id, db.User.role == "field_worker").first()
        if not w:
            raise HTTPException(404, "Field worker not found")
        item = db.Investigation(id=new_id("INV"), cluster_id=x.cluster_id, assigned_worker_id=w.id,
                                 worker_name=w.name, notes=x.notes, status="Assigned", sample_required=True,
                                 created_at=db.utcnow_iso())
        session.add(item)
        c.assigned_worker = w.name
        c.investigation_status = "Field assessment assigned"
        session.add(db.Alert(id=new_id("AL"), cluster_id=x.cluster_id, priority="INFO",
                              message=f'Field assessment assigned to {w.name}.', created_at=db.utcnow_iso()))
        session.commit()
        return investigation_out(item)


@app.get("/api/investigations")
def get_investigations(role: Optional[str] = None, user_id: Optional[str] = None):
    with db.SessionLocal() as session:
        if role == "field_worker" and user_id:
            rows = session.query(db.Investigation).filter(db.Investigation.assigned_worker_id == user_id).all()
        else:
            rows = session.query(db.Investigation).order_by(db.Investigation.created_at.desc()).limit(100).all()
        return [investigation_out(i) for i in rows]


@app.post("/api/samples")
def add_sample(x: SampleIn):
    with db.SessionLocal() as session:
        inv = session.get(db.Investigation, x.investigation_id)
        if not inv:
            raise HTTPException(404, "Investigation not found")
        s = db.Sample(id=new_id("S"), investigation_id=x.investigation_id, sample_type=x.sample_type,
                       status="Received", result="")
        session.add(s)
        inv.status = "Laboratory Testing"
        session.commit()
        return sample_out(s)


@app.get("/api/samples")
def get_samples():
    with db.SessionLocal() as session:
        return [sample_out(s) for s in session.query(db.Sample).limit(100).all()]


@app.post("/api/samples/{sample_id}/result")
def add_result(sample_id: str, x: ResultIn):
    with db.SessionLocal() as session:
        s = session.get(db.Sample, sample_id)
        if not s:
            raise HTTPException(404, "Sample not found")
        s.result = x.result
        s.status = "Result Available"
        inv = session.get(db.Investigation, s.investigation_id)
        if inv:
            inv.status = "Result Received"
        session.commit()
        return sample_out(s)


@app.post("/api/investigations/{investigation_id}/resolve")
def resolve(investigation_id: str):
    with db.SessionLocal() as session:
        inv = session.get(db.Investigation, investigation_id)
        if not inv:
            raise HTTPException(404, "Investigation not found")
        inv.status = "Resolved"
        session.commit()
        return investigation_out(inv)


@app.get("/api/dashboard")
def dashboard():
    with db.SessionLocal() as session:
        animals_count = session.query(db.Animal).count()
        reports = session.query(db.Report).all()
        investigations = session.query(db.Investigation).all()
        samples = session.query(db.Sample).all()
        clusters = session.query(db.Cluster).order_by(db.Cluster.created_at.desc()).all()
        return {"animals": animals_count + 124, "reports_today": len(reports),
                "active_investigations": len([i for i in investigations if i.status != "Resolved"]),
                "high_risk": len([r for r in reports if r.risk >= 51]),
                "clusters": len(clusters), "vaccination": 78,
                "pending_lab": len([s for s in samples if s.status != "Result Available"]),
                "risk": clusters[0].risk if clusters else max((r.risk for r in reports), default=18)}


@app.post("/api/simulate")
def simulate():
    base_lat, base_lng = 30.34, 76.39
    with db.SessionLocal() as session:
        farmer = session.query(db.User).filter(db.User.role == "farmer").first()
        for idx, count in enumerate([5, 4, 7]):
            for j in range(count):
                tag = f"SIM-{idx+1}-{j+1}-{uuid.uuid4().hex[:4]}"
                a = db.Animal(id=new_id("AN"), farmer_id=farmer.id, created_at=db.utcnow_iso(),
                               name=f"Sim Animal {idx+1}-{j+1}", tag=tag, species="Cattle", breed="Sahiwal",
                               age=48 + j, sex="Female", vaccination="Partial")
                session.add(a)
                session.flush()

                fields = dict(farmer_id=farmer.id, animal_id=a.id, species="Cattle", animal_tag=tag,
                              symptoms=["fever", "lethargy", "reduced appetite"],
                              severity="Severe" if j == 0 else "Moderate", affected_animals=1,
                              deaths=1 if idx == 2 and j == 0 else 0, vaccination="Unknown",
                              description="Synthetic SIH demonstration report.",
                              village=["Village A", "Village B", "Village C"][idx],
                              lat=base_lat + idx * .02 + (j % 3) * .002, lng=base_lng + idx * .02 + (j % 2) * .002)
                risk = score_report(fields)
                r = db.Report(id=new_id("R"), created_at=db.utcnow_iso(), risk=risk,
                               risk_label=risk_label(risk), status="New", **fields)
                session.add(r)
                session.flush()
                detect_cluster(session)

        session.commit()
        last_cluster = session.query(db.Cluster).order_by(db.Cluster.created_at.desc()).first()
        return {"message": "Simulation complete", "reports_added": 16,
                "cluster": cluster_out(last_cluster) if last_cluster else None}


app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")


def _open_browser():
    webbrowser.open("http://127.0.0.1:8000")


if __name__ == "__main__":
    threading.Timer(1.0, _open_browser).start()
    uvicorn.run(app, host="127.0.0.1", port=8000)