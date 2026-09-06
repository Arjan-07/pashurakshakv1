const API="/api";
let session=JSON.parse(localStorage.getItem("pashu_session")||"null");
let state={tab:"overview",dashboard:{},animals:[],reports:[],clusters:[],investigations:[],samples:[],alerts:[]};

const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));

async function api(path,opt={}){
  let r=await fetch(API+path,{headers:{"Content-Type":"application/json",...(opt.headers||{})},...opt});
  if(!r.ok) throw new Error((await r.json()).detail||"Request failed");
  return r.json();
}

/* ---------------------------- feedback: toasts + modal ---------------------------- */

function toast(message,variant="success"){
  const el=document.createElement("div");
  el.className=`toast align-items-center text-bg-${variant} border-0`;
  el.setAttribute("role","alert");
  el.innerHTML=`<div class="d-flex"><div class="toast-body">${esc(message)}</div>
    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
  document.getElementById("toastContainer").appendChild(el);
  const t=new bootstrap.Toast(el,{delay:3200});
  el.addEventListener("hidden.bs.toast",()=>el.remove());
  t.show();
}

let _modalConfirmHandler=null;
function openModal({title,bodyHtml,confirmLabel="Save",onConfirm,hideFooter=false}){
  document.getElementById("appModalTitle").textContent=title;
  document.getElementById("appModalBody").innerHTML=bodyHtml;
  const footer=document.getElementById("appModalFooter");
  const confirmBtn=document.getElementById("appModalConfirm");
  footer.style.display=hideFooter?"none":"";
  confirmBtn.textContent=confirmLabel;
  if(_modalConfirmHandler) confirmBtn.removeEventListener("click",_modalConfirmHandler);
  _modalConfirmHandler=async()=>{
    try{ if(onConfirm) await onConfirm(); }
    catch(err){ toast(err.message,"danger"); return; }
  };
  confirmBtn.addEventListener("click",_modalConfirmHandler);
  bootstrap.Modal.getOrCreateInstance(document.getElementById("appModal")).show();
}
function closeModal(){ bootstrap.Modal.getOrCreateInstance(document.getElementById("appModal")).hide(); }

/* ---------------------------------- views ---------------------------------- */

function loginView(){
  document.getElementById("app").innerHTML=`
  <div class="pr-login-shell">
    <div class="pr-login-card">
      <div class="card border-0 shadow-sm">
        <div class="card-body p-4 p-md-5">
          <div class="d-flex align-items-center gap-3 mb-4">
            <div class="pr-mark">PR</div>
            <div>
              <div class="text-uppercase small fw-semibold text-body-secondary" style="letter-spacing:.05em;font-size:11px">Livestock health surveillance</div>
              <h1 class="font-serif h2 mb-0 mt-1">PashuRakshak</h1>
            </div>
          </div>
          <p class="text-body-secondary small mb-4">A simple chain from farmer report to veterinary field assessment.</p>
          <form id="loginForm">
            <div class="mb-3">
              <label class="form-label small fw-semibold" for="email">Email</label>
              <input class="form-control" id="email" value="farmer@demo.local" autocomplete="username">
            </div>
            <div class="mb-3">
              <label class="form-label small fw-semibold" for="password">Password</label>
              <input class="form-control" id="password" type="password" value="demo123" autocomplete="current-password">
            </div>
            <button class="btn btn-primary w-100 py-2">Sign in</button>
          </form>
          <div class="mt-4 pt-3 border-top">
            <div class="small text-body-secondary mb-2">Demo access</div>
            <div class="d-flex flex-wrap gap-2">
              <button class="btn btn-sm btn-outline-secondary" data-e="farmer@demo.local">Farmer</button>
              <button class="btn btn-sm btn-outline-secondary" data-e="vet@demo.local">Veterinary officer</button>
              <button class="btn btn-sm btn-outline-secondary" data-e="worker@demo.local">Field worker</button>
            </div>
            <small class="text-body-secondary d-block mt-2">Demo password: demo123</small>
          </div>
        </div>
      </div>
    </div>
  </div>`;
  document.querySelectorAll("[data-e]").forEach(b=>b.onclick=()=>{email.value=b.dataset.e});
  loginForm.onsubmit=async e=>{
    e.preventDefault();
    try{
      session=(await api("/login",{method:"POST",body:JSON.stringify({email:email.value,password:password.value})})).user;
      localStorage.setItem("pashu_session",JSON.stringify(session));
      await load(); render();
    }catch(err){ toast(err.message,"danger"); }
  };
}

async function load(){
  const q=encodeURIComponent(session.id);
  state.dashboard=await api("/dashboard");
  state.animals=await api("/animals?farmer_id="+q);
  state.reports=await api("/reports?role="+session.role+"&user_id="+q);
  state.clusters=await api("/clusters");
  state.investigations=await api("/investigations?role="+session.role+"&user_id="+q);
  state.samples=await api("/samples");
  state.alerts=await api("/alerts");
}

function roleLabel(){ return session.role==="veterinarian"?"Veterinary officer":session.role==="field_worker"?"Field worker":"Farmer"; }

function shell(content){
  document.getElementById("app").innerHTML=`
  <div class="d-flex">
    <div class="offcanvas-md offcanvas-start pr-sidebar d-flex flex-column p-3" tabindex="-1" id="sidebar">
      <div class="d-flex align-items-center gap-2 mb-1">
        <div class="pr-mark">PR</div>
        <div>
          <div class="fw-bold text-white">PashuRakshak</div>
          <small class="text-body-secondary" style="color:#8FA69A!important">Early warning</small>
        </div>
        <button type="button" class="btn-close btn-close-white ms-auto d-md-none" data-bs-dismiss="offcanvas" data-bs-target="#sidebar"></button>
      </div>
      <div class="pr-role mt-3">${esc(roleLabel())}</div>
      <nav class="nav nav-pills flex-column pr-nav mb-auto">
        ${nav().map(n=>`<button class="nav-link text-start ${state.tab===n.id?"active":""}" onclick="go('${n.id}')"><i class="bi ${n.icon}"></i>${n.label}</button>`).join("")}
      </nav>
      <div class="pt-3 border-top border-secondary-subtle mt-3">
        <div class="small mb-2"><span class="pr-online-dot"></span> <span class="text-body-secondary" style="color:#8FA69A!important">Online</span></div>
        <button class="nav-link text-start w-100" onclick="logout()"><i class="bi bi-box-arrow-right"></i> Sign out</button>
      </div>
    </div>

    <div class="pr-main flex-fill">
      <header class="d-flex align-items-center justify-content-between px-3 px-md-4 py-3 border-bottom bg-white">
        <div class="d-flex align-items-center gap-2">
          <button class="btn btn-outline-secondary btn-sm d-md-none" type="button" data-bs-toggle="offcanvas" data-bs-target="#sidebar">
            <i class="bi bi-list"></i>
          </button>
          <div>
            <div class="text-uppercase small fw-semibold text-body-secondary" style="letter-spacing:.05em;font-size:10px">${esc(roleLabel())}</div>
            <h2 class="font-serif h4 mb-0">${esc(title())}</h2>
          </div>
        </div>
        <span class="small text-body-secondary d-none d-sm-inline">${esc(session.name)}</span>
      </header>
      <main class="p-3 p-md-4" style="max-width:1400px;margin:0 auto">${content}</main>
    </div>
  </div>`;
}

function nav(){
  return session.role==="farmer"?[
    {id:"overview",label:"Overview",icon:"bi-grid"},
    {id:"animals",label:"My animals",icon:"bi-clipboard2-pulse"},
    {id:"report",label:"Report concern",icon:"bi-flag"},
    {id:"history",label:"My reports",icon:"bi-journal-text"}
  ]:session.role==="veterinarian"?[
    {id:"overview",label:"Overview",icon:"bi-grid"},
    {id:"reports",label:"Incoming reports",icon:"bi-inbox"},
    {id:"clusters",label:"Risk clusters",icon:"bi-diagram-3"},
    {id:"assign",label:"Field assignment",icon:"bi-person-workspace"},
    {id:"investigations",label:"Investigations",icon:"bi-search"},
    {id:"lab",label:"Laboratory",icon:"bi-droplet-half"}
  ]:[
    {id:"overview",label:"Overview",icon:"bi-grid"},
    {id:"investigations",label:"My assignments",icon:"bi-search"},
    {id:"lab",label:"Samples",icon:"bi-droplet-half"}
  ];
}

function title(){
  return ({overview:"Situation overview",animals:"My animals",report:"Report an animal concern",history:"My submitted reports",
    reports:"Incoming health reports",clusters:"Potential clusters",assign:"Assign field assessment",
    investigations:"Investigations",lab:"Laboratory"})[state.tab]||"PashuRakshak";
}

function go(t){ state.tab=t; render(); }
function logout(){ localStorage.removeItem("pashu_session"); session=null; loginView(); }

function render(){
  if(!session){ loginView(); return; }
  let c="";
  if(state.tab==="overview") c=overview();
  if(state.tab==="animals") c=animalsView();
  if(state.tab==="report") c=reportView();
  if(state.tab==="history"||state.tab==="reports") c=reportsView(session.role==="farmer");
  if(state.tab==="clusters") c=clustersView();
  if(state.tab==="assign") c=assignView();
  if(state.tab==="investigations") c=investigationsView();
  if(state.tab==="lab") c=labView();
  shell(c);
  bind();
}

function riskVariant(risk){ return risk>=76?"danger":risk>=51?"warning":"success"; }

function overview(){
  const d=state.dashboard;
  const heroLine=session.role==="farmer"?"Report simply. Your veterinary team sees it."
    :session.role==="veterinarian"?"Review risk. Send the right field worker."
    :"See your assigned assessments in one place.";
  return `
  <div class="pr-hero mb-3">
    <div class="text-uppercase small fw-semibold mb-2" style="letter-spacing:.05em;font-size:10px;color:#BFE0CC">One connected workflow</div>
    <h1 class="font-serif h3" style="max-width:34ch">${esc(heroLine)}</h1>
    <p class="mb-0 small">Farmer report → AI symptom structuring → risk assessment → veterinary review → field assessment → laboratory.</p>
  </div>

  <div class="row row-cols-2 row-cols-lg-5 g-2 mb-3">
    <div class="col"><div class="pr-stat"><div class="pr-stat-label">Animals</div><div class="pr-stat-value">${d.animals??0}</div></div></div>
    <div class="col"><div class="pr-stat"><div class="pr-stat-label">Reports today</div><div class="pr-stat-value">${d.reports_today??0}</div></div></div>
    <div class="col"><div class="pr-stat"><div class="pr-stat-label">Active investigations</div><div class="pr-stat-value">${d.active_investigations??0}</div></div></div>
    <div class="col"><div class="pr-stat"><div class="pr-stat-label">High risk</div><div class="pr-stat-value">${d.high_risk??0}</div></div></div>
    <div class="col"><div class="pr-stat"><div class="pr-stat-label">Potential clusters</div><div class="pr-stat-value">${d.clusters??0}</div></div></div>
  </div>

  <div class="row g-3">
    <div class="col-lg-7">
      <div class="pr-panel p-3 h-100">
        <div class="d-flex justify-content-between align-items-center mb-1">
          <h3 class="font-serif h6 mb-0">Recent activity</h3>
          <span class="badge text-bg-light border">Live</span>
        </div>
        <div class="list-group list-group-flush">
          ${state.alerts.slice(-5).reverse().map(a=>`
            <div class="list-group-item d-flex justify-content-between align-items-start gap-3">
              <div>
                <div class="fw-semibold small">${a.priority==="HIGH"?"Priority alert":"Workflow update"}</div>
                <div class="small text-body-secondary">${esc(a.message)}</div>
              </div>
              <span class="badge text-bg-${a.priority==="HIGH"?"danger":"secondary"}">${esc(a.priority)}</span>
            </div>`).join("")||empty("bi-check2-circle","Nothing needs attention.")}
        </div>
      </div>
    </div>
    <div class="col-lg-5">
      <div class="pr-panel p-3 h-100 d-flex flex-column">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h3 class="font-serif h6 mb-0" style="color:#142018">Surveillance status</h3>
        </div>
        <div class="d-flex align-items-center gap-3 mb-3">
          <div class="pr-risk-ring" style="--val:${d.risk??0}">
            <div class="pr-risk-value">${d.risk??0}<small>OUT OF 100</small></div>
          </div>
          <p class="small text-body-secondary mb-0">This is a surveillance risk signal, not a confirmed diagnosis.</p>
        </div>
        <div class="pr-flow mt-auto pt-2 border-top">
          ${["Report","Risk","Vet","Field","Lab","Action"].map((s,i,arr)=>
            `<span class="badge text-bg-light border">${s}</span>${i<arr.length-1?'<i class="bi bi-chevron-right"></i>':""}`).join("")}
        </div>
      </div>
    </div>
  </div>`;
}

function animalsView(){
  return `
  <div class="pr-panel p-3">
    <div class="d-flex justify-content-between align-items-center mb-2">
      <h3 class="font-serif h6 mb-0">Registered animals</h3>
      <button class="btn btn-sm btn-primary" id="addAnimal"><i class="bi bi-plus-lg"></i> Add animal</button>
    </div>
    <div class="list-group list-group-flush">
      ${state.animals.map(a=>`
        <div class="list-group-item d-flex justify-content-between align-items-center">
          <div>
            <div class="fw-semibold small">${esc(a.name)} · ${esc(a.tag)}</div>
            <div class="small text-body-secondary">${esc(a.species)} · ${esc(a.breed)} · ${a.age} months</div>
          </div>
          <span class="badge text-bg-light border">${esc(a.vaccination)}</span>
        </div>`).join("")||empty("bi-clipboard2-pulse","No animals registered yet.")}
    </div>
  </div>`;
}

function reportView(){
  return `
  <div class="pr-panel p-3 p-md-4" style="max-width:760px">
    <div class="alert alert-light border small mb-4">Your report goes directly to the veterinary workflow. Keep it simple.</div>
    <div class="mb-3">
      <label class="form-label small fw-semibold">Animal</label>
      <select class="form-select" id="animalSelect">
        ${state.animals.map(a=>`<option value="${a.id}" data-tag="${esc(a.tag)}" data-species="${esc(a.species)}">${esc(a.name)} · ${esc(a.tag)}</option>`).join("")||"<option value=''>No animal — add one first</option>"}
      </select>
    </div>
    <div class="mb-2">
      <label class="form-label small fw-semibold">Symptoms</label>
      <textarea class="form-control" id="symText" rows="2" placeholder="Example: मेरी गाय को बुखार है और वह खाना कम खा रही है।"></textarea>
    </div>
    <button class="btn btn-sm btn-outline-secondary mb-2" id="structure"><i class="bi bi-magic"></i> Structure symptoms</button>
    <div id="structured" class="mb-3"></div>
    <div class="row g-3 mb-3">
      <div class="col-sm-6">
        <label class="form-label small fw-semibold">Severity</label>
        <select class="form-select" id="severity"><option>Mild</option><option selected>Moderate</option><option>Severe</option></select>
      </div>
      <div class="col-sm-6">
        <label class="form-label small fw-semibold">Affected animals</label>
        <input class="form-control" id="affected" type="number" min="1" value="1">
      </div>
    </div>
    <div class="mb-3">
      <label class="form-label small fw-semibold">Village</label>
      <input class="form-control" id="village" value="Demo Village">
    </div>
    <div class="mb-4">
      <label class="form-label small fw-semibold">Additional note</label>
      <textarea class="form-control" id="note" rows="2" placeholder="Anything else the veterinary officer should know"></textarea>
    </div>
    <button class="btn btn-primary w-100 py-2" id="submitReport">Submit health report</button>
  </div>`;
}

function reportsView(farmer){
  return `
  <div class="pr-panel p-3">
    <div class="d-flex justify-content-between align-items-center mb-2">
      <h3 class="font-serif h6 mb-0">${farmer?"My reports":"Incoming farmer reports"}</h3>
      <span class="small text-body-secondary">${state.reports.length} records</span>
    </div>
    <div class="list-group list-group-flush">
      ${state.reports.slice().reverse().map(r=>`
        <div class="list-group-item d-flex justify-content-between align-items-center gap-3 flex-wrap">
          <div>
            <div class="fw-semibold small">${esc(r.animal_tag)} · ${esc(r.village)}</div>
            <div class="small text-body-secondary">${esc(r.symptoms.join(", ")||"Unstructured concern")}</div>
          </div>
          <div class="d-flex align-items-center gap-2">
            <span class="badge text-bg-${riskVariant(r.risk)}">${esc(r.risk_label)} · ${r.risk}</span>
            ${!farmer?`<button class="btn btn-sm btn-outline-secondary review" data-r="${r.id}">Review</button>`:""}
          </div>
        </div>`).join("")||empty("bi-journal-text","No reports yet.")}
    </div>
  </div>`;
}

function clustersView(){
  return `
  <div class="pr-panel p-3">
    <div class="d-flex justify-content-between align-items-center mb-2">
      <h3 class="font-serif h6 mb-0">Potential clusters</h3>
      <span class="small text-body-secondary">Not a confirmed outbreak</span>
    </div>
    <div class="row g-2">
      ${state.clusters.slice().reverse().map(c=>`
        <div class="col-md-6">
          <div class="border rounded-3 p-3 h-100 d-flex flex-column">
            <small class="text-body-secondary">${esc(c.id)}</small>
            <div class="fw-semibold font-serif">${esc(c.reports)} reports · ${esc(c.villages)} villages</div>
            <div class="small text-body-secondary mb-2">${esc(c.affected)} animals affected · ${esc(c.trend)} trend</div>
            <div class="d-flex align-items-center gap-2 mb-2">
              <div class="progress flex-fill" style="height:8px">
                <div class="progress-bar bg-${riskVariant(c.risk)}" style="width:${c.risk}%"></div>
              </div>
              <span class="small fw-semibold">${c.risk}/100</span>
            </div>
            <button class="btn btn-sm ${c.assigned_worker?"btn-outline-secondary":"btn-primary"} mt-auto assignCluster" data-c="${c.id}">
              ${c.assigned_worker?"Assigned":"Send field worker"}
            </button>
          </div>
        </div>`).join("")||empty("bi-diagram-3","No potential clusters detected.")}
    </div>
  </div>`;
}

function assignView(){
  return `
  <div class="pr-panel p-3 p-md-4" style="max-width:640px">
    <h3 class="font-serif h6">Send field worker</h3>
    <div class="mb-3">
      <label class="form-label small fw-semibold">Potential cluster</label>
      <select class="form-select" id="clusterSelect">
        ${state.clusters.slice().reverse().map(c=>`<option value="${c.id}">${c.id} · ${c.reports} reports · risk ${c.risk}</option>`).join("")}
      </select>
    </div>
    <div class="mb-3">
      <label class="form-label small fw-semibold">Field worker</label>
      <select class="form-select" id="worker"><option value="U-WORKER">Amit Singh</option></select>
    </div>
    <div class="mb-4">
      <label class="form-label small fw-semibold">Instructions</label>
      <textarea class="form-control" id="assignNotes" rows="3" placeholder="What should the field worker assess?"></textarea>
    </div>
    <button class="btn btn-primary" id="assignBtn">Assign assessment</button>
  </div>`;
}

function investigationsView(){
  return `
  <div class="pr-panel p-3">
    <div class="d-flex justify-content-between align-items-center mb-2">
      <h3 class="font-serif h6 mb-0">${session.role==="field_worker"?"My assignments":"Investigation workflow"}</h3>
      <span class="small text-body-secondary">${state.investigations.length}</span>
    </div>
    <div class="list-group list-group-flush">
      ${state.investigations.slice().reverse().map(i=>`
        <div class="list-group-item d-flex justify-content-between align-items-center gap-3 flex-wrap">
          <div>
            <div class="fw-semibold small">${esc(i.id)} · ${esc(i.worker_name)}</div>
            <div class="small text-body-secondary">Cluster ${esc(i.cluster_id)} · ${esc(i.notes||"Field assessment")}</div>
          </div>
          <div class="d-flex align-items-center gap-2">
            <span class="badge text-bg-light border">${esc(i.status)}</span>
            ${session.role==="field_worker"&&i.status==="Assigned"?`<button class="btn btn-sm btn-primary collect" data-i="${i.id}">Collect sample</button>`:""}
          </div>
        </div>`).join("")||empty("bi-search","No investigations assigned.")}
    </div>
  </div>`;
}

function labView(){
  return `
  <div class="pr-panel p-3">
    <div class="d-flex justify-content-between align-items-center mb-2">
      <h3 class="font-serif h6 mb-0">Laboratory</h3>
      <span class="small text-body-secondary">Sample workflow</span>
    </div>
    <div class="list-group list-group-flush">
      ${state.samples.slice().reverse().map(s=>`
        <div class="list-group-item d-flex justify-content-between align-items-center gap-3 flex-wrap">
          <div>
            <div class="fw-semibold small">${esc(s.id)}</div>
            <div class="small text-body-secondary">Investigation ${esc(s.investigation_id)} · ${esc(s.sample_type)}</div>
          </div>
          <div class="d-flex align-items-center gap-2">
            <span class="badge text-bg-${s.status==="Result Available"?"success":"light border"}">${esc(s.status)}</span>
            ${session.role==="veterinarian"&&s.status!=="Result Available"?`<button class="btn btn-sm btn-outline-secondary result" data-s="${s.id}">Enter result</button>`:""}
          </div>
        </div>`).join("")||empty("bi-droplet-half","No samples yet.")}
    </div>
  </div>`;
}

function empty(icon,text){ return `<div class="pr-empty"><i class="bi ${icon}"></i>${esc(text)}</div>`; }

/* ---------------------------------- interaction bindings ---------------------------------- */

function bind(){
  const el=id=>document.getElementById(id);

  if(el("addAnimal")) el("addAnimal").onclick=()=>{
    openModal({
      title:"Add animal",
      confirmLabel:"Add animal",
      bodyHtml:`
        <div class="mb-3"><label class="form-label small fw-semibold">Name</label><input class="form-control" id="m_name" placeholder="Gauri"></div>
        <div class="row g-3 mb-3">
          <div class="col-6"><label class="form-label small fw-semibold">Tag</label><input class="form-control" id="m_tag" placeholder="COW-001"></div>
          <div class="col-6"><label class="form-label small fw-semibold">Species</label><input class="form-control" id="m_species" placeholder="Cattle" value="Cattle"></div>
        </div>
        <div class="row g-3 mb-3">
          <div class="col-6"><label class="form-label small fw-semibold">Breed</label><input class="form-control" id="m_breed" value="Local"></div>
          <div class="col-6"><label class="form-label small fw-semibold">Age (months)</label><input class="form-control" type="number" min="0" id="m_age" value="36"></div>
        </div>
        <div class="row g-3">
          <div class="col-6"><label class="form-label small fw-semibold">Sex</label>
            <select class="form-select" id="m_sex"><option>Female</option><option>Male</option></select></div>
          <div class="col-6"><label class="form-label small fw-semibold">Vaccination</label>
            <select class="form-select" id="m_vacc"><option>Unknown</option><option>Yes</option><option>Partial</option><option>Overdue</option><option>No</option></select></div>
        </div>`,
      onConfirm:async()=>{
        const name=el("m_name").value.trim(), tag=el("m_tag").value.trim();
        if(!name||!tag) throw new Error("Name and tag are required.");
        await api("/animals",{method:"POST",body:JSON.stringify({
          farmer_id:session.id,name,tag,species:el("m_species").value||"Cattle",breed:el("m_breed").value,
          age:+el("m_age").value||0,sex:el("m_sex").value,vaccination:el("m_vacc").value})});
        closeModal(); toast(`${name} added.`); await load(); render();
      }
    });
  };

  if(el("structure")) el("structure").onclick=async()=>{
    const text=el("symText").value;
    if(!text) return;
    const j=await api("/nl-extract",{method:"POST",body:JSON.stringify({text})});
    el("structured").innerHTML=`<div class="d-flex flex-wrap gap-2">${
      j.symptoms.map(s=>`<span class="badge text-bg-light border">${esc(s)}</span>`).join("")
      ||`<span class="text-body-secondary small">No matching symptom signal found</span>`}</div>`;
  };

  if(el("submitReport")) el("submitReport").onclick=async()=>{
    const o=el("animalSelect").selectedOptions[0];
    if(!o||!o.value){ toast("Register an animal first.","danger"); return; }
    const j=await api("/reports",{method:"POST",body:JSON.stringify({
      farmer_id:session.id,animal_id:o.value,species:o.dataset.species,animal_tag:o.dataset.tag,
      symptoms:[],severity:el("severity").value,affected_animals:+el("affected").value,deaths:0,
      vaccination:"Unknown",description:el("note").value+" "+el("symText").value,village:el("village").value,
      lat:30.34+Math.random()*.05,lng:76.39+Math.random()*.05})});
    toast(`Report ${j.report.id} submitted. Veterinary review has been triggered.`);
    await load(); state.tab="history"; render();
  };

  document.querySelectorAll(".review").forEach(b=>b.onclick=()=>{
    const r=state.reports.find(x=>x.id===b.dataset.r);
    openModal({
      title:`${r.animal_tag} · ${r.risk_label}`,
      hideFooter:true,
      bodyHtml:`
        <p class="small text-body-secondary mb-2">${esc(r.symptoms.join(", ")||"Natural-language concern")}</p>
        <p class="mb-3"><span class="badge text-bg-${riskVariant(r.risk)}">Risk ${r.risk}/100</span></p>
        <p class="small mb-0">Veterinary decision: use "Risk clusters" to assign a field worker.</p>`
    });
  });

  document.querySelectorAll(".assignCluster").forEach(b=>b.onclick=()=>{
    state.tab="assign";
    render();
    const s=document.getElementById("clusterSelect");
    if(s) s.value=b.dataset.c;
  });

  if(el("assignBtn")) el("assignBtn").onclick=async()=>{
    await api("/investigations",{method:"POST",body:JSON.stringify({
      cluster_id:el("clusterSelect").value,worker_id:el("worker").value,notes:el("assignNotes").value})});
    toast("Field worker assigned.");
    await load(); state.tab="investigations"; render();
  };

  document.querySelectorAll(".collect").forEach(b=>b.onclick=async()=>{
    await api("/samples",{method:"POST",body:JSON.stringify({investigation_id:b.dataset.i,sample_type:"Blood / Swab"})});
    toast("Sample recorded.");
    await load(); render();
  });

  document.querySelectorAll(".result").forEach(b=>b.onclick=()=>{
    openModal({
      title:"Enter laboratory result",
      confirmLabel:"Save result",
      bodyHtml:`<textarea class="form-control" id="m_result" rows="3">Result available — refer to veterinary authority for interpretation.</textarea>`,
      onConfirm:async()=>{
        const v=el("m_result").value.trim();
        if(!v) throw new Error("Enter a result first.");
        await api("/samples/"+b.dataset.s+"/result",{method:"POST",body:JSON.stringify({result:v})});
        closeModal(); toast("Result saved."); await load(); render();
      }
    });
  });
}

window.go=go;
window.logout=logout;

async function init(){
  if(!session){ loginView(); return; }
  try{ await load(); render(); }
  catch(e){ localStorage.removeItem("pashu_session"); session=null; loginView(); }
}
init();