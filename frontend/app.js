
const API="/api";
let session=JSON.parse(localStorage.getItem("pashu_session")||"null");
let state={tab:"overview",dashboard:{},animals:[],reports:[],clusters:[],investigations:[],samples:[],alerts:[]};

const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));
async function api(path,opt={}){let r=await fetch(API+path,{headers:{"Content-Type":"application/json",...(opt.headers||{})},...opt});if(!r.ok)throw new Error((await r.json()).detail||"Request failed");return r.json()}
function loginView(){document.getElementById("app").innerHTML=`
<div class="login"><div class="loginCard">
<div class="mark">PR</div><div class="eyebrow">LIVESTOCK HEALTH SURVEILLANCE</div><h1>PashuRakshak</h1>
<p class="muted">A simple chain from farmer report to veterinary field assessment.</p>
<form id="loginForm">
<label>Email<input id="email" value="farmer@demo.local" autocomplete="username"></label>
<label>Password<input id="password" type="password" value="demo123" autocomplete="current-password"></label>
<button class="primary full">Sign in</button>
</form>
<div class="demoAccounts"><span>Demo access</span><button data-e="farmer@demo.local">Farmer</button><button data-e="vet@demo.local">Veterinary Officer</button><button data-e="worker@demo.local">Field Worker</button></div>
<small class="muted">Demo password: demo123</small></div></div>`;
document.querySelectorAll("[data-e]").forEach(b=>b.onclick=()=>{email.value=b.dataset.e});
loginForm.onsubmit=async e=>{e.preventDefault();try{session=(await api("/login",{method:"POST",body:JSON.stringify({email:email.value,password:password.value})})).user;localStorage.setItem("pashu_session",JSON.stringify(session));await load();render()}catch(err){alert(err.message)}}
}
async function load(){const q=encodeURIComponent(session.id);state.dashboard=await api("/dashboard");state.animals=await api("/animals?farmer_id="+q);state.reports=await api("/reports?role="+session.role+"&user_id="+q);state.clusters=await api("/clusters");state.investigations=await api("/investigations?role="+session.role+"&user_id="+q);state.samples=await api("/samples");state.alerts=await api("/alerts")}
function shell(content){document.getElementById("app").innerHTML=`
<div class="shell"><aside><div class="brand"><div class="mark">PR</div><div><b>PashuRakshak</b><small>Early warning</small></div></div>
<div class="role">${session.role==="veterinarian"?"Veterinary Officer":session.role==="field_worker"?"Field Worker":"Farmer"}</div>
${nav().map(n=>`<button class="nav ${state.tab===n.id?"active":""}" onclick="go('${n.id}')">${n.label}</button>`).join("")}
<div class="asideBottom"><span class="online">● Online</span><button class="nav" onclick="logout()">Sign out</button></div></aside>
<main><header><div><div class="eyebrow">${session.role.toUpperCase()}</div><h2>${title()}</h2></div><span class="user">${esc(session.name)}</span></header>${content}</main></div>`}
function nav(){return session.role==="farmer"?[
{id:"overview",label:"Overview"},{id:"animals",label:"My animals"},{id:"report",label:"Report concern"},{id:"history",label:"My reports"}
]:session.role==="veterinarian"?[
{id:"overview",label:"Overview"},{id:"reports",label:"Incoming reports"},{id:"clusters",label:"Risk clusters"},{id:"assign",label:"Field assignment"},{id:"investigations",label:"Investigations"},{id:"lab",label:"Laboratory"}
]:[
{id:"overview",label:"Overview"},{id:"investigations",label:"My assignments"},{id:"lab",label:"Samples"}]}
function title(){return ({overview:"Situation overview",animals:"My animals",report:"Report an animal concern",history:"My submitted reports",reports:"Incoming health reports",clusters:"Potential clusters",assign:"Assign field assessment",investigations:"Investigations",lab:"Laboratory"})[state.tab]||"PashuRakshak"}
function go(t){state.tab=t;render()}
function logout(){localStorage.removeItem("pashu_session");session=null;loginView()}
function render(){if(!session){loginView();return}
let c="";
if(state.tab==="overview")c=overview();
if(state.tab==="animals")c=animalsView();
if(state.tab==="report")c=reportView();
if(state.tab==="history"||state.tab==="reports")c=reportsView(session.role==="farmer");
if(state.tab==="clusters")c=clustersView();
if(state.tab==="assign")c=assignView();
if(state.tab==="investigations")c=investigationsView();
if(state.tab==="lab")c=labView();
shell(c);bind()}
function overview(){let d=state.dashboard;return `<div class="hero"><div><div class="eyebrow">ONE CONNECTED WORKFLOW</div><h1>${session.role==="farmer"?"Report simply. Your veterinary team sees it.":session.role==="veterinarian"?"Review risk. Send the right field worker.":"See your assigned assessments in one place."}</h1><p class="muted">Farmer report → AI symptom structuring → risk assessment → veterinary review → field assessment → laboratory.</p></div></div>
<div class="kpis"><div><small>Animals</small><b>${d.animals}</b></div><div><small>Reports today</small><b>${d.reports_today}</b></div><div><small>Active investigations</small><b>${d.active_investigations}</b></div><div><small>High risk</small><b>${d.high_risk}</b></div><div><small>Potential clusters</small><b>${d.clusters}</b></div></div>
<div class="grid2"><section class="cardPanel"><div class="sectionHead"><h3>Recent activity</h3><span>Live</span></div>${state.alerts.slice(-5).reverse().map(a=>`<div class="row"><div><b>${esc(a.priority==="HIGH"?"Priority alert":"Workflow update")}</b><small>${esc(a.message)}</small></div><em>${esc(a.priority)}</em></div>`).join("")||empty("Nothing needs attention.")}</section>
<section class="cardPanel"><div class="sectionHead"><h3>Surveillance status</h3><span>Risk indicator</span></div><div class="riskScore"><b>${d.risk}</b><small>/100</small></div><p class="muted">This is a surveillance risk signal, not a confirmed diagnosis.</p><div class="flow">REPORT → RISK → VET → FIELD → LAB → ACTION</div></section></div>`}
function animalsView(){return `<section class="cardPanel"><div class="sectionHead"><h3>Registered animals</h3><button class="small" id="addAnimal">+ Add animal</button></div>${state.animals.map(a=>`<div class="row"><div><b>${esc(a.name)} · ${esc(a.tag)}</b><small>${esc(a.species)} · ${esc(a.breed)} · ${a.age} months</small></div><em>${esc(a.vaccination)}</em></div>`).join("")||empty("No animals registered yet.")}</section>`}
function reportView(){return `<section class="cardPanel form"><div class="info">Your report goes directly to the veterinary workflow. Keep it simple.</div><label>Animal<select id="animalSelect">${state.animals.map(a=>`<option value="${a.id}" data-tag="${esc(a.tag)}" data-species="${esc(a.species)}">${esc(a.name)} · ${esc(a.tag)}</option>`).join("")||"<option value=''>No animal — add one first</option>"}</select></label>
<label>Symptoms<textarea id="symText" placeholder="Example: मेरी गाय को बुखार है और वह खाना कम खा रही है।"></textarea></label>
<button class="small" id="structure">Structure symptoms</button><div id="structured"></div>
<div class="twoFields"><label>Severity<select id="severity"><option>Mild</option><option selected>Moderate</option><option>Severe</option></select></label><label>Affected animals<input id="affected" type="number" min="1" value="1"></label></div>
<label>Village<input id="village" value="Demo Village"></label><label>Additional note<textarea id="note" placeholder="Anything else the veterinary officer should know"></textarea></label>
<button class="primary full" id="submitReport">Submit health report</button></section>`}
function reportsView(farmer){return `<section class="cardPanel"><div class="sectionHead"><h3>${farmer?"My reports":"Incoming farmer reports"}</h3><span>${state.reports.length} records</span></div>${state.reports.slice().reverse().map(r=>`<div class="reportRow"><div><b>${esc(r.animal_tag)} · ${esc(r.village)}</b><small>${esc(r.symptoms.join(", ")||"Unstructured concern")}</small></div><span class="badge ${r.risk>=76?"critical":r.risk>=51?"high":"normal"}">${r.risk_label} · ${r.risk}</span>${!farmer?`<button class="small review" data-r="${r.id}">Review</button>`:""}</div>`).join("")||empty("No reports yet.")}</section>`}
function clustersView(){return `<section class="cardPanel"><div class="sectionHead"><h3>Potential clusters</h3><span>Not a confirmed outbreak</span></div>${state.clusters.slice().reverse().map(c=>`<div class="cluster"><div><small>${esc(c.id)}</small><h3>${esc(c.reports)} reports · ${esc(c.villages)} villages</h3><p>${esc(c.affected)} animals affected · ${esc(c.trend)} trend</p></div><div class="riskScore compact"><b>${c.risk}</b><small>/100</small></div><button class="small assignCluster" data-c="${c.id}">${c.assigned_worker?"Assigned":"Send field worker"}</button></div>`).join("")||empty("No potential clusters detected.")}</section>`}
function assignView(){return `<section class="cardPanel"><div class="sectionHead"><h3>Send field worker</h3><span>Veterinary action</span></div><label>Potential cluster<select id="clusterSelect">${state.clusters.slice().reverse().map(c=>`<option value="${c.id}">${c.id} · ${c.reports} reports · risk ${c.risk}</option>`).join("")}</select></label><label>Field worker<select id="worker"><option value="U-WORKER">Amit Singh</option></select></label><label>Instructions<textarea id="assignNotes" placeholder="What should the field worker assess?"></textarea></label><button class="primary" id="assignBtn">Assign assessment</button></section>`}
function investigationsView(){return `<section class="cardPanel"><div class="sectionHead"><h3>${session.role==="field_worker"?"My assignments":"Investigation workflow"}</h3><span>${state.investigations.length}</span></div>${state.investigations.slice().reverse().map(i=>`<div class="row"><div><b>${esc(i.id)} · ${esc(i.worker_name)}</b><small>Cluster ${esc(i.cluster_id)} · ${esc(i.notes||"Field assessment")}</small></div><em>${esc(i.status)}</em>${session.role==="field_worker"&&i.status==="Assigned"?`<button class="small collect" data-i="${i.id}">Collect sample</button>`:""}</div>`).join("")||empty("No investigations assigned.")}</section>`}
function labView(){return `<section class="cardPanel"><div class="sectionHead"><h3>Laboratory</h3><span>Sample workflow</span></div>${state.samples.slice().reverse().map(s=>`<div class="row"><div><b>${esc(s.id)}</b><small>Investigation ${esc(s.investigation_id)} · ${esc(s.sample_type)}</small></div><em>${esc(s.status)}</em>${session.role==="veterinarian"&&s.status!=="Result Available"?`<button class="small result" data-s="${s.id}">Enter result</button>`:""}</div>`).join("")||empty("No samples yet.")}</section>`}
function empty(t){return `<div class="empty">${t}</div>`}
function bind(){
const el=id=>document.getElementById(id);
if(el("addAnimal"))el("addAnimal").onclick=async()=>{let name=prompt("Animal name","Gauri"),tag=prompt("Animal tag","COW-001"),species=prompt("Species","Cattle");if(!name||!tag)return;await api("/animals",{method:"POST",body:JSON.stringify({farmer_id:session.id,name,tag,species,breed:"Local",age:36,sex:"Female",vaccination:"Unknown"})});await load();render()};
if(el("structure"))el("structure").onclick=async()=>{let text=el("symText").value;if(!text)return;let j=await api("/nl-extract",{method:"POST",body:JSON.stringify({text})});el("structured").innerHTML=`<div class="structured">${j.symptoms.map(s=>`<span>${esc(s)}</span>`).join("")||"<span>No matching symptom signal found</span>"}</div>`};
if(el("submitReport"))el("submitReport").onclick=async()=>{let o=el("animalSelect").selectedOptions[0];if(!o)return alert("Register an animal first.");let j=await api("/reports",{method:"POST",body:JSON.stringify({farmer_id:session.id,animal_id:o.value,species:o.dataset.species,animal_tag:o.dataset.tag,symptoms:[],severity:el("severity").value,affected_animals:+el("affected").value,deaths:0,vaccination:"Unknown",description:el("note").value+" "+el("symText").value,village:el("village").value,lat:30.34+Math.random()*.05,lng:76.39+Math.random()*.05})});alert(`Report ${j.report.id} submitted. Veterinary review has been triggered.`);await load();state.tab="history";render()};
document.querySelectorAll(".review").forEach(b=>b.onclick=()=>{let r=state.reports.find(x=>x.id===b.dataset.r);alert(`${r.animal_tag}\n${r.symptoms.join(", ")||"Natural-language concern"}\nRisk: ${r.risk}/100\n\nVeterinary decision: use “Risk clusters” to assign a field worker.`)});
document.querySelectorAll(".assignCluster").forEach(b=>b.onclick=()=>{state.tab="assign";setTimeout(()=>{let s=document.getElementById("clusterSelect");if(s)s.value=b.dataset.c},0);render()});
if(el("assignBtn"))el("assignBtn").onclick=async()=>{await api("/investigations",{method:"POST",body:JSON.stringify({cluster_id:el("clusterSelect").value,worker_id:el("worker").value,notes:el("assignNotes").value})});alert("Field worker assigned.");await load();state.tab="investigations";render()};
document.querySelectorAll(".collect").forEach(b=>b.onclick=async()=>{await api("/samples",{method:"POST",body:JSON.stringify({investigation_id:b.dataset.i,sample_type:"Blood / Swab"})});await load();render()});
document.querySelectorAll(".result").forEach(b=>b.onclick=async()=>{let v=prompt("Enter simulated laboratory result","Result available — refer to veterinary authority for interpretation.");if(!v)return;await api("/samples/"+b.dataset.s+"/result",{method:"POST",body:JSON.stringify({result:v})});await load();render()});
}
window.go=go;window.logout=logout;
async function init(){if(!session){loginView();return}try{await load();render()}catch(e){localStorage.removeItem("pashu_session");session=null;loginView()}}
init();
