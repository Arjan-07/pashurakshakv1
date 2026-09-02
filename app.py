
"""
PashuRakshak — role-based SIH prototype
Run: python app.py
Open: http://127.0.0.1:8000
"""

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

BASE_DIR=Path(__file__).resolve().parent
FRONTEND_DIR=BASE_DIR/"frontend"

app=FastAPI(title="PashuRakshak",version="1.0.0")
app.add_middleware(CORSMiddleware,allow_origins=["*"],allow_credentials=True,allow_methods=["*"],allow_headers=["*"])

USERS={
 "farmer@demo.local":{"id":"U-FARMER","name":"Ravi Kumar","role":"farmer","password":"demo123"},
 "vet@demo.local":{"id":"U-VET","name":"Dr. Asha Verma","role":"veterinarian","password":"demo123"},
 "worker@demo.local":{"id":"U-WORKER","name":"Amit Singh","role":"field_worker","password":"demo123"},
}
animals=[]
reports=[]
clusters=[]
investigations=[]
alerts=[]
samples=[]
vaccinations=[]
treatments=[]

class LoginIn(BaseModel):
 email:str
 password:str

class AnimalIn(BaseModel):
 farmer_id:str
 name:str
 tag:str
 species:str
 breed:str=""
 age:int=0
 sex:str="Female"
 vaccination:str="Unknown"

class ReportIn(BaseModel):
 farmer_id:str
 animal_id:str
 species:str
 animal_tag:str
 symptoms:list[str]=[]
 severity:str="Moderate"
 affected_animals:int=Field(1,ge=1)
 deaths:int=Field(0,ge=0)
 vaccination:str="Unknown"
 description:str=""
 village:str="Demo Village"
 lat:float=30.34
 lng:float=76.39

class AssignIn(BaseModel):
 cluster_id:str
 worker_id:str
 notes:str=""

class SampleIn(BaseModel):
 investigation_id:str
 sample_type:str="Blood / Swab"

class ResultIn(BaseModel):
 result:str

SYMPTOM_MAP={
 "fever":["fever","बुखार","ताप"],
 "reduced appetite":["reduced appetite","कम खाना","भूख"],
 "lethargy":["lethargy","सुस्त","कमजोर"],
 "cough":["cough","खांसी"],
 "diarrhea":["diarrhea","दस्त","जुलाब"],
}

def score_report(r):
 score=8+r["affected_animals"]*3+r["deaths"]*12
 score += {"Mild":4,"Moderate":12,"Severe":24}.get(r["severity"],10)
 if r["vaccination"] in ("Unknown","Overdue","No"): score+=7
 score += min(18,len(r["symptoms"])*4)
 return min(100,score)

def risk_label(score):
 if score<=25:return"Normal"
 if score<=50:return"Watch"
 if score<=75:return"High Risk"
 return"Potential Cluster"

def detect_cluster():
 recent=[r for r in reports if datetime.fromisoformat(r["created_at"])>=datetime.utcnow()-timedelta(hours=48)]
 if len(recent)<3:return None
 lat=sum(r["lat"] for r in recent)/len(recent); lng=sum(r["lng"] for r in recent)/len(recent)
 near=[r for r in recent if sqrt((r["lat"]-lat)**2+(r["lng"]-lng)**2)<0.10]
 if len(near)<3:return None
 common=set(near[0]["symptoms"])
 for r in near[1:]: common &= set(r["symptoms"])
 score=min(100,len(near)*6+sum(r["affected_animals"] for r in near)*2+len(common)*8+sum(r["deaths"] for r in near)*10)
 if score<51:return None
 cid="CL-"+str(uuid.uuid4())[:7].upper()
 c={"id":cid,"reports":len(near),"affected":sum(r["affected_animals"] for r in near),"villages":len({r["village"] for r in near}),
    "risk":score,"status":"Potential Cluster","lat":lat,"lng":lng,"trend":"Increasing","assigned_worker":None,
    "investigation_status":"Awaiting veterinary action","created_at":datetime.utcnow().isoformat()}
 clusters.append(c)
 alerts.append({"id":"AL-"+str(uuid.uuid4())[:7].upper(),"cluster_id":cid,"priority":"HIGH",
                "message":f'{c["reports"]} related health reports detected across {c["villages"]} nearby villages.','created_at':datetime.utcnow().isoformat()})
 return c

@app.get("/api/health")
def health(): return {"status":"ok","service":"PashuRakshak"}

@app.post("/api/login")
def login(x:LoginIn):
 u=USERS.get(x.email.lower())
 if not u or u["password"]!=x.password: raise HTTPException(401,"Invalid email or password")
 return {"token":"demo-"+u["id"],"user":{"id":u["id"],"name":u["name"],"role":u["role"]}}

@app.get("/api/me/{user_id}")
def me(user_id:str):
 for u in USERS.values():
  if u["id"]==user_id:return {"id":u["id"],"name":u["name"],"role":u["role"]}
 raise HTTPException(404,"User not found")

@app.post("/api/nl-extract")
def nl_extract(payload:dict):
 text=(payload.get("text") or "").lower()
 return {"symptoms":[k for k,v in SYMPTOM_MAP.items() if any(t in text for t in v)],
         "note":"Risk support only; not a confirmed diagnosis."}

@app.get("/api/animals")
def get_animals(farmer_id:Optional[str]=None):
 return [a for a in animals if not farmer_id or a["farmer_id"]==farmer_id]

@app.post("/api/animals")
def add_animal(x:AnimalIn):
 item=x.model_dump(); item["id"]="AN-"+str(uuid.uuid4())[:7].upper(); item["created_at"]=datetime.utcnow().isoformat()
 animals.append(item); vaccinations.append({"animal_id":item["id"],"vaccination":item["vaccination"],"status":"Recorded"})
 return item

@app.get("/api/reports")
def get_reports(role:Optional[str]=None,user_id:Optional[str]=None):
 if role=="farmer" and user_id: return [r for r in reports if r["farmer_id"]==user_id]
 return reports[-200:]

@app.post("/api/reports")
def add_report(x:ReportIn):
 item=x.model_dump(); item.update({"id":"R-"+str(uuid.uuid4())[:7].upper(),"created_at":datetime.utcnow().isoformat()})
 item["risk"]=score_report(item); item["risk_label"]=risk_label(item["risk"]); item["status"]="New"
 reports.append(item)
 cluster=detect_cluster()
 if item["risk"]>=51 or cluster:
  alerts.append({"id":"AL-"+str(uuid.uuid4())[:7].upper(),"cluster_id":cluster["id"] if cluster else None,"priority":"HIGH",
                 "message":f'{item["animal_tag"]} reported with {", ".join(item["symptoms"]) or "health concerns"} — veterinary review recommended.',
                 "created_at":datetime.utcnow().isoformat()})
 return {"report":item,"cluster":cluster}

@app.get("/api/clusters")
def get_clusters(): return clusters[-100:]

@app.get("/api/alerts")
def get_alerts(): return alerts[-100:]

@app.post("/api/investigations")
def assign_worker(x:AssignIn):
 c=next((c for c in clusters if c["id"]==x.cluster_id),None)
 if not c: raise HTTPException(404,"Cluster not found")
 w=next((u for u in USERS.values() if u["id"]==x.worker_id and u["role"]=="field_worker"),None)
 if not w: raise HTTPException(404,"Field worker not found")
 item={"id":"INV-"+str(uuid.uuid4())[:7].upper(),"cluster_id":x.cluster_id,"assigned_worker":x.worker_id,
       "worker_name":w["name"],"notes":x.notes,"status":"Assigned","sample_required":True,"created_at":datetime.utcnow().isoformat()}
 investigations.append(item); c["assigned_worker"]=w["name"]; c["investigation_status"]="Field assessment assigned"
 alerts.append({"id":"AL-"+str(uuid.uuid4())[:7].upper(),"cluster_id":x.cluster_id,"priority":"INFO",
                "message":f'Field assessment assigned to {w["name"]}.','created_at':datetime.utcnow().isoformat()})
 return item

@app.get("/api/investigations")
def get_investigations(role:Optional[str]=None,user_id:Optional[str]=None):
 if role=="field_worker" and user_id:return [i for i in investigations if i["assigned_worker"]==user_id]
 return investigations[-100:]

@app.post("/api/samples")
def add_sample(x:SampleIn):
 inv=next((i for i in investigations if i["id"]==x.investigation_id),None)
 if not inv: raise HTTPException(404,"Investigation not found")
 s={"id":"S-"+str(uuid.uuid4())[:7].upper(),"investigation_id":x.investigation_id,"sample_type":x.sample_type,"status":"Received","result":""}
 samples.append(s); inv["status"]="Laboratory Testing"; return s

@app.get("/api/samples")
def get_samples():return samples[-100:]

@app.post("/api/samples/{sample_id}/result")
def add_result(sample_id:str,x:ResultIn):
 s=next((s for s in samples if s["id"]==sample_id),None)
 if not s: raise HTTPException(404,"Sample not found")
 s["result"]=x.result;s["status"]="Result Available"
 inv=next((i for i in investigations if i["id"]==s["investigation_id"]),None)
 if inv: inv["status"]="Result Received"
 return s

@app.post("/api/investigations/{investigation_id}/resolve")
def resolve(investigation_id:str):
 inv=next((i for i in investigations if i["id"]==investigation_id),None)
 if not inv: raise HTTPException(404,"Investigation not found")
 inv["status"]="Resolved"; return inv

@app.get("/api/dashboard")
def dashboard():
 return {"animals":len(animals)+124,"reports_today":len(reports),"active_investigations":len([i for i in investigations if i["status"]!="Resolved"]),
         "high_risk":len([r for r in reports if r["risk"]>=51]),"clusters":len(clusters),"vaccination":78,"pending_lab":len([s for s in samples if s["status"]!="Result Available"]),
         "risk":clusters[-1]["risk"] if clusters else (max([r["risk"] for r in reports],default=18))}

@app.post("/api/simulate")
def simulate():
 base_lat,base_lng=30.34,76.39
 for idx,count in enumerate([5,4,7]):
  for j in range(count):
   tag=f"SIM-{idx+1}-{j+1}-{uuid.uuid4().hex[:4]}"
   # demo animal + report
   a=add_animal(AnimalIn(farmer_id="U-FARMER",name=f"Sim Animal {idx+1}-{j+1}",tag=tag,species="Cattle",breed="Sahiwal",age=48+j,sex="Female",vaccination="Partial"))
   add_report(ReportIn(farmer_id="U-FARMER",animal_id=a["id"],species="Cattle",animal_tag=tag,
                       symptoms=["fever","lethargy","reduced appetite"],severity="Severe" if j==0 else "Moderate",
                       affected_animals=1,deaths=1 if idx==2 and j==0 else 0,vaccination="Unknown",
                       description="Synthetic SIH demonstration report.",village=["Village A","Village B","Village C"][idx],
                       lat=base_lat+idx*.02+(j%3)*.002,lng=base_lng+idx*.02+(j%2)*.002))
 return {"message":"Simulation complete","reports_added":16,"cluster":clusters[-1] if clusters else None}

app.mount("/",StaticFiles(directory=str(FRONTEND_DIR),html=True),name="frontend")
def _open_browser(): webbrowser.open("http://127.0.0.1:8000")
if __name__=="__main__":
 threading.Timer(1.0,_open_browser).start();uvicorn.run(app,host="127.0.0.1",port=8000)
