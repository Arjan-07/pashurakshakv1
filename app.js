/* PashuRakshak — plain JS frontend (no build step required) */

const API = "/api";

let dash = {
  animals: 124, reports_today: 0, active_investigations: 0,
  high_risk: 0, clusters: 0, vaccination: 78, pending_lab: 0, risk: 18,
};
let reports = [];
let clusters = [];
let alerts = [];
let selectedSymptoms = [];

// ---------------------------------------------------------------------
// Map setup (created once, then updated in place on each refresh)
// ---------------------------------------------------------------------
const map = L.map("map").setView([30.34, 76.39], 10);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap",
}).addTo(map);
const markersLayer = L.layerGroup().addTo(map);

function updateMap() {
  markersLayer.clearLayers();
  reports.forEach((r) => {
    L.circleMarker([r.lat, r.lng], { radius: 7 })
      .bindPopup(`<b>${r.village}</b><br/>${r.species} · ${r.symptoms.join(", ")}`)
      .addTo(markersLayer);
  });
  clusters.forEach((c) => {
    L.circleMarker([c.lat, c.lng], { radius: 24, fillOpacity: 0.18, color: "#d8783d" })
      .bindPopup(`<b>${c.id}</b><br/>${c.risk}/100 · ${c.status}<br/>${c.reports} reports · ${c.affected} animals`)
      .addTo(markersLayer);
  });
}

// ---------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------
async function refresh() {
  const [d, r, c, a] = await Promise.all([
    fetch(`${API}/dashboard`).then((res) => res.json()),
    fetch(`${API}/reports`).then((res) => res.json()),
    fetch(`${API}/clusters`).then((res) => res.json()),
    fetch(`${API}/alerts`).then((res) => res.json()),
  ]);
  dash = d;
  reports = r;
  clusters = c;
  alerts = a;
  render();
}

async function simulate() {
  await fetch(`${API}/simulate`, { method: "POST" });
  await refresh();
}

// ---------------------------------------------------------------------
// Rendering (targeted DOM updates so the Leaflet map instance survives)
// ---------------------------------------------------------------------
function renderOnlineStatus() {
  const el = document.getElementById("onlineStatus");
  const online = navigator.onLine;
  el.className = online ? "online" : "offline";
  el.innerHTML = online
    ? `<i data-lucide="wifi"></i>ONLINE`
    : `<i data-lucide="wifi-off"></i>OFFLINE — Reports will sync automatically.`;
  lucide.createIcons();
}

function renderAlertBanner() {
  const el = document.getElementById("alertBanner");
  if (!alerts.length) {
    el.innerHTML = "";
    return;
  }
  const latest = alerts[alerts.length - 1];
  el.innerHTML = `
    <div class="alert">
      <i data-lucide="shield-alert"></i>
      <div><strong>HIGH PRIORITY HEALTH ALERT</strong><p>${latest.message}</p></div>
      <span>Potential Cluster</span>
    </div>`;
  lucide.createIcons();
}

function renderCards() {
  const el = document.getElementById("cardsContainer");
  const items = [
    ["Animals Registered", dash.animals, "+12 this month"],
    ["Reports Today", dash.reports_today, "Live intake"],
    ["Active Investigations", dash.active_investigations, "Field workflow"],
    ["High-Risk Areas", dash.high_risk, "Needs attention"],
    ["Potential Clusters", dash.clusters, "Not a diagnosis"],
    ["Vaccination Coverage", dash.vaccination + "%", "Area estimate"],
  ];
  el.innerHTML = items
    .map(([a, b, c]) => `<div class="card"><small>${a}</small><strong>${b}</strong><span>${c}</span></div>`)
    .join("");
}

function renderRisk() {
  document.getElementById("riskRingValue").innerHTML = `${dash.risk}<small>/100</small>`;
  const label =
    dash.risk > 75 ? "Potential Cluster" : dash.risk > 50 ? "High Risk" : dash.risk > 25 ? "Watch" : "Normal";
  document.getElementById("riskLabel").textContent = label;

  const totalAffected = reports.reduce((s, r) => s + r.affected_animals, 0);
  const villageCount = new Set(reports.map((r) => r.village)).size;
  document.getElementById("reasonsList").innerHTML = `
    <li>${reports.length} recent reports</li>
    <li>${totalAffected} animals affected in demo data</li>
    <li>${villageCount} nearby villages</li>
    <li>Similar symptom pattern detected</li>`;
}

function renderTable() {
  const rows = reports
    .slice(-8)
    .reverse()
    .map(
      (r) => `
      <tr>
        <td>${r.id}</td><td>${r.village}</td><td>${r.species}</td>
        <td>${r.symptoms.join(", ")}</td><td>${r.affected_animals}</td>
        <td><span class="tag">${r.severity}</span></td>
      </tr>`
    )
    .join("");
  document.getElementById("reportsTableBody").innerHTML = rows;
}

function renderModules() {
  document.getElementById("activeInvestigationsSpan").textContent = `${dash.active_investigations} active`;
  document.getElementById("pendingLabSpan").textContent = `${dash.pending_lab} pending tests`;
}

function render() {
  renderOnlineStatus();
  renderAlertBanner();
  renderCards();
  renderRisk();
  renderTable();
  renderModules();
  updateMap();
}

// ---------------------------------------------------------------------
// New health report modal/form
// ---------------------------------------------------------------------
const SYMPTOM_OPTIONS = ["Fever", "Reduced appetite", "Lethargy", "Cough", "Diarrhea", "Swelling"];

function openForm() {
  selectedSymptoms = [];
  const el = document.getElementById("formModalContainer");
  el.innerHTML = `
    <div class="modal" id="modalBackdrop">
      <form class="form" id="reportForm">
        <div class="panelHead">
          <div><h3>New Health Report</h3><p>AI-ready structured intake · surveillance only</p></div>
          <button type="button" id="closeFormBtn">×</button>
        </div>
        <label>Animal species
          <select name="species">
            <option>Cattle</option><option>Buffalo</option><option>Goat</option>
            <option>Sheep</option><option>Poultry</option>
          </select>
        </label>
        <label>Animal ID<input name="animal_id" placeholder="e.g. COW-104" /></label>
        <label>Village<input name="village" value="Demo Village" /></label>
        <label>Number affected<input name="affected" type="number" min="1" value="1" /></label>
        <label>Severity
          <select name="severity"><option>Mild</option><option>Moderate</option><option>Severe</option></select>
        </label>
        <label>Vaccination status
          <select name="vaccination"><option>Up to date</option><option>Unknown</option><option>Overdue</option></select>
        </label>
        <label>Symptoms
          <div class="checks" id="symptomChecks">
            ${SYMPTOM_OPTIONS.map((x) => `<button type="button" data-symptom="${x}">${x}</button>`).join("")}
          </div>
        </label>
        <label>Description
          <textarea name="description" placeholder='Natural language: "मेरी 3 गायों को बुखार है और वे खाना नहीं खा रही हैं।"'></textarea>
        </label>
        <p class="note">AI extraction can convert natural-language symptoms into structured fields. Risk scores are indicators, not confirmed diagnoses.</p>
        <button class="primary full" id="submitReportBtn">Submit Health Report</button>
      </form>
    </div>`;

  document.getElementById("closeFormBtn").addEventListener("click", closeForm);
  document.getElementById("modalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "modalBackdrop") closeForm();
  });

  document.querySelectorAll("#symptomChecks button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const s = btn.dataset.symptom;
      if (selectedSymptoms.includes(s)) {
        selectedSymptoms = selectedSymptoms.filter((x) => x !== s);
        btn.classList.remove("chosen");
      } else {
        selectedSymptoms.push(s);
        btn.classList.add("chosen");
      }
    });
  });

  document.getElementById("reportForm").addEventListener("submit", submitForm);
}

function closeForm() {
  document.getElementById("formModalContainer").innerHTML = "";
}

async function submitForm(e) {
  e.preventDefault();
  const submitBtn = document.getElementById("submitReportBtn");
  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting…";

  const f = new FormData(e.currentTarget);
  const payload = {
    species: f.get("species"),
    animal_id: f.get("animal_id"),
    affected_animals: Number(f.get("affected")),
    symptoms: selectedSymptoms,
    severity: f.get("severity"),
    vaccination: f.get("vaccination"),
    description: f.get("description"),
    village: f.get("village"),
    lat: 30.34 + Math.random() * 0.06,
    lng: 76.39 + Math.random() * 0.06,
  };

  const res = await fetch(`${API}/reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  localStorage.setItem("pashu_last_report", JSON.stringify(json.report));

  await refresh();
  submitBtn.disabled = false;
  submitBtn.textContent = "Submit Health Report";
  closeForm();
}

// ---------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------
document.getElementById("newReportBtn").addEventListener("click", openForm);
document.getElementById("addReportBtn2").addEventListener("click", openForm);
document.getElementById("simulateBtn").addEventListener("click", simulate);
window.addEventListener("online", renderOnlineStatus);
window.addEventListener("offline", renderOnlineStatus);

lucide.createIcons();
refresh();
