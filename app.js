const MODE = window.CC_MODE || "civic";
const TREATMENTS = [
  { id: "lpi", name: "Leading pedestrian interval", cost: "$5k–$25k", dollars: 15000, reduction: 0.22, fit: "Fits most signalized corners", injury: "Often cuts pedestrian injury crashes ~10–40% in studies", whenFails: "Does little if the problem is speed or left turns, not walk time." },
  { id: "daylight", name: "Daylighting (no parking at corners)", cost: "$1k–$15k", dollars: 8000, reduction: 0.12, fit: "Fits almost anywhere there is curb parking", injury: "Improves visibility; injury change varies by site", whenFails: "Weak if drivers still take the corner at high speed." },
  { id: "curb", name: "Curb extensions", cost: "$40k–$200k", dollars: 120000, reduction: 0.2, fit: "Needs leftover pavement; check turning trucks", injury: "Shortens crossing, can cut ped conflicts", whenFails: "Fails if the street is a heavy truck route and corners get clipped." },
  { id: "left", name: "Protected or banned left turns", cost: "$20k–$150k", dollars: 85000, reduction: 0.28, fit: "Works at signals with left-turn demand", injury: "Often reduces angle / left-turn injury crashes", whenFails: "Can push turns to the next block if there is no alternate path." },
  { id: "diet", name: "Road diet on the approach", cost: "$50k–$400k", dollars: 225000, reduction: 0.32, fit: "Best on 4-lane streets with moderate volume", injury: "Typically large drop in injury crashes on the corridor", whenFails: "Controversial where people believe capacity will collapse." },
  { id: "roundabout", name: "Single-lane roundabout", cost: "$250k–$2M+", dollars: 750000, reduction: 0.38, fit: "Needs a large clear footprint — many Chicago corners fail this", injury: "Injury crashes often drop; fender-benders may rise", whenFails: "Won't fit tight urban parcels; multi-lane versions are weaker on safety." }
];
const CHALLENGES = [
  { id: "fifty", name: "Fifty thousand", budget: 50000, maxStamps: 2, banned: ["roundabout", "diet", "curb"], blurb: "A cheap, visible change. Daylighting or an LPI — not a rebuild." },
  { id: "quarter", name: "Quarter million", budget: 250000, maxStamps: 3, banned: ["roundabout"], blurb: "Stack two or three street-scale tools. Roundabouts are off the table." },
  { id: "rebuild", name: "Rebuild it", budget: 1000000, maxStamps: 3, banned: [], blurb: "One serious rebuild. Measure the footprint before you drop a roundabout." }
];

const map = L.map("map").setView([41.85, -87.65], 11);
const streets = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "&copy; OpenStreetMap", maxZoom: 19 });
const satellite = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { attribution: "Tiles &copy; Esri — imagery for sketching only", maxZoom: 19 });
satellite.addTo(map);
document.getElementById("basemapToggle").addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  document.querySelectorAll("#basemapToggle button").forEach((b) => b.classList.toggle("on", b === btn));
  if (btn.dataset.base === "sat") { map.removeLayer(streets); if (!map.hasLayer(satellite)) satellite.addTo(map); }
  else { map.removeLayer(satellite); if (!map.hasLayer(streets)) streets.addTo(map); }
});

const panel = document.getElementById("detail");
const sketch = L.layerGroup().addTo(map);
const pins = L.layerGroup().addTo(map);
let intersections = [];
let selected = null;
let holding = null;
let place = null;
let placements = [];
let dragMode = null;
let challenge = null;
let submitted = false;

function money(n) {
  if (n >= 1000000) return "$" + (n / 1000000).toFixed(n % 1000000 ? 1 : 0) + "M";
  if (n >= 1000) return "$" + Math.round(n / 1000) + "k";
  return "$" + n;
}
function navHtml() {
  return `<nav class="site-nav"><a href="index.html">Home</a><a href="map.html"${MODE === "civic" ? ' class="on"' : ""}>Civic</a><a href="play.html"${MODE === "game" ? ' class="on"' : ""}>Game</a></nav>`;
}
function offsetMeters(lat, lng, eastM, northM) {
  return [lat + northM / 111320, lng + eastM / (111320 * Math.cos((lat * Math.PI) / 180))];
}
function applyCompare() {
  const slider = document.getElementById("compareSlider");
  const line = document.getElementById("compareLine");
  if (!slider || !place) return;
  const pct = Number(slider.value) / 100;
  sketch.eachLayer((layer) => { if (layer.setStyle) layer.setStyle({ opacity: Math.max(0.15, pct), fillOpacity: pct * 0.85 }); });
  if (line) { line.hidden = pct >= 0.98 || pct <= 0.02; line.style.left = Number(slider.value) + "%"; }
}
function hideCompare() {
  const bar = document.getElementById("compareBar");
  const line = document.getElementById("compareLine");
  if (bar) bar.hidden = true;
  if (line) line.hidden = true;
}
function clearSketch() { sketch.clearLayers(); }
function ptFor(p, e, n) {
  const s = p.scale, rad = (p.heading * Math.PI) / 180;
  return offsetMeters(p.lat, p.lng, (e * Math.cos(rad) - n * Math.sin(rad)) * s, (e * Math.sin(rad) + n * Math.cos(rad)) * s);
}
function zebraOn(p, alongE, alongN, acrossE, acrossN) {
  for (let i = -4; i <= 4; i += 1) {
    const a0 = i * 1.6, a1 = a0 + 0.8;
    L.polyline([ptFor(p, alongE * a0 + acrossE, alongN * a0 + acrossN), ptFor(p, alongE * a1 + acrossE, alongN * a1 + acrossN)], { color: "#f4f1ea", weight: 4, opacity: 0.9 }).addTo(sketch);
  }
}
function bulbOn(p, signE, signN) {
  const sidewalk = 12, nose = 4.5;
  L.polygon([
    ptFor(p, signE * sidewalk, signN * sidewalk), ptFor(p, signE * nose, signN * sidewalk),
    ptFor(p, signE * (nose - 1), signN * (sidewalk - 3)), ptFor(p, signE * 5.5, signN * 5.5),
    ptFor(p, signE * (sidewalk - 3), signN * (nose - 1)), ptFor(p, signE * sidewalk, signN * nose)
  ], { color: "#3a3530", weight: 2, fillColor: "#cfc6b4", fillOpacity: 0.88 }).addTo(sketch);
}
function addHandle(p, e, n, mode, color) {
  const marker = L.circleMarker(ptFor(p, e, n), { radius: mode === "move" ? 9 : 8, color: "#fff", weight: 2, fillColor: color, fillOpacity: 1 }).addTo(sketch);
  marker.on("mousedown", (ev) => { L.DomEvent.stop(ev); dragMode = mode; map.dragging.disable(); });
}
function drawOne(p, active) {
  const { lat, lng, id, scale } = p;
  if (id === "roundabout") {
    L.circle([lat, lng], { color: "#d8d2c6", weight: 10, fill: false, radius: 16 * scale }).addTo(sketch);
    L.circle([lat, lng], { color: "#2f4a2f", weight: 1, fillColor: "#4d7a45", fillOpacity: 0.85, radius: 7 * scale }).addTo(sketch);
    L.circle([lat, lng], { color: "#f4f1ea", weight: 2, fill: false, radius: 21 * scale, dashArray: "6 8" }).addTo(sketch);
  } else if (id === "daylight") {
    [[9, 9], [9, -9], [-9, 9], [-9, -9]].forEach(([e, n]) => {
      L.circle(ptFor(p, e, n), { color: "#c9a227", weight: 1, fillColor: "#f4d35e", fillOpacity: 0.45, radius: 5 * scale, dashArray: "3 4" }).addTo(sketch);
    });
  } else if (id === "curb") {
    bulbOn(p, 1, 1); bulbOn(p, 1, -1); bulbOn(p, -1, 1); bulbOn(p, -1, -1);
    zebraOn(p, 1, 0, 0, 6); zebraOn(p, 0, 1, 6, 0); zebraOn(p, 1, 0, 0, -6); zebraOn(p, 0, 1, -6, 0);
  } else if (id === "lpi") {
    zebraOn(p, 1, 0, 0, 5); zebraOn(p, 0, 1, 5, 0); zebraOn(p, 1, 0, 0, -5); zebraOn(p, 0, 1, -5, 0);
  } else if (id === "diet") {
    L.polygon([ptFor(p, -3.2, -48), ptFor(p, 3.2, -48), ptFor(p, 3.2, 48), ptFor(p, -3.2, 48)], { color: "#2e7d32", weight: 1, fillColor: "#5aa35e", fillOpacity: 0.55 }).addTo(sketch);
    L.polyline([ptFor(p, -7, -48), ptFor(p, -7, 48)], { color: "#f4f1ea", weight: 2, dashArray: "8 10" }).addTo(sketch);
    L.polyline([ptFor(p, 7, -48), ptFor(p, 7, 48)], { color: "#f4f1ea", weight: 2, dashArray: "8 10" }).addTo(sketch);
  } else if (id === "left") {
    L.polyline([ptFor(p, -22, 3.5), ptFor(p, 0, 3.5), ptFor(p, 3.5, 22)], { color: "#e74c3c", weight: 5 }).addTo(sketch);
  }
  if (active) {
    addHandle(p, 0, 0, "move", "#4aa3df");
    addHandle(p, 0, 22, "rotate", "#e2a54b");
    addHandle(p, 18, 18, "scale", "#7dba7f");
  }
}
function drawSketch() {
  clearSketch();
  const list = placements.length ? placements : place ? [place] : [];
  if (!list.length) { hideCompare(); return; }
  place = list[list.length - 1];
  list.forEach((p, i) => drawOne(p, i === list.length - 1));
  document.getElementById("compareBar").hidden = false;
  applyCompare();
}
function nearestIntersection(lat, lng) {
  let best = null, bestD = Infinity;
  intersections.forEach((ix) => {
    const d = Math.hypot((ix.lat - lat) * 111320, (ix.lng - lng) * 111320 * Math.cos((lat * Math.PI) / 180));
    if (d < bestD) { bestD = d; best = ix; }
  });
  return { ix: best, meters: bestD };
}
function tone(score100) { return score100 >= 70 ? "high" : score100 >= 40 ? "mid" : "ok"; }
function treatmentCopy(tr, ix) {
  let fit = tr.fit;
  if (tr.id === "roundabout") fit = "Likely tight on a typical Chicago parcel — treat fit as maybe until someone measures the right-of-way.";
  if (ix && tr.id === "lpi" && !/SIGNAL/i.test(ix.control)) fit = "This corner is not coded as a signal in the crash file — LPI only applies if there is a signal.";
  return fit;
}
function headingFrom(latlng) {
  const dLat = (latlng.lat - place.lat) * 111320;
  const dLng = (latlng.lng - place.lng) * 111320 * Math.cos((place.lat * Math.PI) / 180);
  return (Math.atan2(dLng, dLat) * 180) / Math.PI;
}
function scaleFrom(latlng) {
  const dLat = (latlng.lat - place.lat) * 111320;
  const dLng = (latlng.lng - place.lng) * 111320 * Math.cos((place.lat * Math.PI) / 180);
  return Math.max(0.4, Math.min(2.8, Math.hypot(dLat, dLng) / 26));
}
function placeTreatment(lat, lng) {
  if (!holding) return;
  const found = nearestIntersection(lat, lng);
  if (found.ix && found.meters < 120) selected = found.ix;
  const next = { id: holding.id, lat, lng, heading: place ? place.heading : 0, scale: place ? place.scale : 1 };
  if (MODE === "game") {
    if (!placements.length) placements = [next];
    else placements[placements.length - 1] = { ...placements[placements.length - 1], lat, lng };
  } else {
    placements = [next];
  }
  place = placements[placements.length - 1];
  if (map.getZoom() < 17) map.setView([lat, lng], 18);
  else map.panTo([lat, lng]);
  drawSketch();
  renderPanel();
}
map.on("mousemove", (e) => {
  if (!dragMode || !place) return;
  if (dragMode === "rotate") place.heading = headingFrom(e.latlng);
  if (dragMode === "scale") place.scale = scaleFrom(e.latlng);
  if (dragMode === "move") { place.lat = e.latlng.lat; place.lng = e.latlng.lng; }
  placements[placements.length - 1] = place;
  drawSketch();
});
map.on("mouseup", () => { if (dragMode) { dragMode = null; map.dragging.enable(); } });
function gameIssues() {
  if (!challenge || !selected) return [];
  const spent = placements.reduce((s, p) => s + TREATMENTS.find((t) => t.id === p.id).dollars, 0);
  const out = [];
  if (spent > challenge.budget) out.push("Over budget.");
  if (!placements.length) out.push("Place at least one stamp.");
  if (placements.length > challenge.maxStamps) out.push("Too many stamps.");
  placements.forEach((p) => {
    const tr = TREATMENTS.find((t) => t.id === p.id);
    if (challenge.banned.includes(p.id)) out.push(tr.name + " is banned on this challenge.");
    if (p.id === "lpi" && !/SIGNAL/i.test(selected.control)) out.push("LPI needs a signal. This corner is not coded as one.");
  });
  return out;
}
function sketchScore() {
  const ids = [...new Set(placements.map((p) => p.id))];
  const r = 1 - ids.reduce((acc, id) => acc * (1 - TREATMENTS.find((t) => t.id === id).reduction), 1);
  return Math.round(r * 100);
}
function renderPanel() {
  if (MODE === "game" && !challenge) {
    panel.innerHTML = `${navHtml()}<h1>Spend a budget on a real corner</h1><p class="lede">The crash numbers stay. You get a budget, a handful of stamps, and one high-score Chicago intersection. A sketch score estimates injury drop from research ranges — it is not a traffic model.</p>${CHALLENGES.map((c) => `<button class="challenge" data-id="${c.id}"><strong>${c.name}<span>${money(c.budget)}</span></strong><span>${c.blurb}</span></button>`).join("")}<p class="disclaimer">Sketch for public discussion, not an engineering study.</p>`;
    panel.querySelectorAll(".challenge").forEach((btn) => { btn.onclick = () => startChallenge(btn.dataset.id); });
    return;
  }
  const holdNote = holding
    ? `<p class="lede pickup">Holding <strong>${holding.name}</strong>. Click the photo to move it, or use the blue handle.</p>`
    : `<p class="lede">${MODE === "game" ? "Click a stamp, then rotate and resize so it matches the streets." : "Click a corner (or search), then click a change."}</p>`;
  let stats = selected
    ? `<h1>${selected.name}</h1><p class="lede">${selected.control} · ${selected.crashes} reported intersection crashes since 2023 · trend ${selected.trend}</p><div class="score-row"><div class="stat ${tone(selected.score100)}"><b>${selected.score100}</b><span>Safety score</span></div><div class="stat"><b>${selected.injuryCrashes}</b><span>Injury crashes</span></div><div class="stat"><b>${selected.seriousCrashes + selected.fatalCrashes}</b><span>Serious or fatal</span></div></div>`
    : `<h1>Chicago Corners</h1><p class="lede">Search or click a problematic intersection first. Then stamp a change.</p>`;
  let gameHud = "";
  if (MODE === "game" && challenge) {
    const spent = placements.reduce((s, p) => s + TREATMENTS.find((t) => t.id === p.id).dollars, 0);
    const left = challenge.budget - spent;
    gameHud = `<p class="lede">${challenge.blurb}</p><div class="score-row"><div class="stat ${left < 0 ? "high" : ""}"><b>${money(left)}</b><span>Budget left</span></div><div class="stat"><b>${placements.length}/${challenge.maxStamps}</b><span>Stamps</span></div><div class="stat"><b>${sketchScore()}</b><span>Sketch score</span></div></div>`;
  }
  let result = `<div id="result" class="result empty">No change placed yet.</div>`;
  if (holding && place) {
    const fit = treatmentCopy(holding, selected);
    result = `<div id="result" class="result"><h3>${holding.name}</h3><p><strong>Cost band:</strong> ${holding.cost}</p><p><strong>Fit:</strong> ${fit}</p><p><strong>Injuries (research range):</strong> ${holding.injury}</p><p><strong>When it fails:</strong> ${holding.whenFails}</p><p class="lede">Blue = move. Gold = rotate. Green = resize.</p><p><button type="button" class="mini" id="rotL">Rotate left</button><button type="button" class="mini" id="rotR">Rotate right</button><button type="button" class="mini" id="bigger">Bigger</button><button type="button" class="mini" id="smaller">Smaller</button></p></div>`;
  }
  let gameEnd = "";
  if (MODE === "game") {
    const issues = gameIssues();
    if (submitted && issues.length) gameEnd = `<ul class="warn">${issues.map((i) => `<li>${i}</li>`).join("")}</ul>`;
    if (submitted && !issues.length) {
      const best = Math.max(sketchScore(), Number(localStorage.getItem("cc-best") || 0));
      localStorage.setItem("cc-best", String(best));
      gameEnd = `<p class="ok-note">Brief filed. Sketch score ${sketchScore()}. Best on this device is ${best}.</p>`;
    }
    gameEnd += `<p><button type="button" class="mini" id="fileBrief">File the brief</button> <button type="button" class="mini" id="newCh">New challenge</button></p>`;
  }
  panel.innerHTML = `${navHtml()}${stats}${gameHud}${holdNote}<h2>Changes</h2><div class="treatments">${TREATMENTS.map((tr) => {
    const banned = MODE === "game" && challenge && challenge.banned.includes(tr.id);
    const full = MODE === "game" && challenge && placements.length >= challenge.maxStamps;
    return `<button class="treat${holding && holding.id === tr.id ? " active" : ""}" data-id="${tr.id}" ${banned || full || submitted ? "disabled" : ""}><strong>${tr.name}</strong><em>${MODE === "game" ? money(tr.dollars) : tr.cost}${banned ? " · not allowed" : ""}</em></button>`;
  }).join("")}</div>${result}${gameEnd}<p class="disclaimer">Sketch for public discussion, not an engineering study. Crash data: City of Chicago open portal, intersection-related records 2023–present.</p>`;
  panel.querySelectorAll(".treat").forEach((btn) => {
    const tr = TREATMENTS.find((x) => x.id === btn.dataset.id);
    btn.onclick = () => {
      holding = tr;
      document.body.classList.add("holding");
      if (MODE === "game") {
        if (challenge && placements.length < challenge.maxStamps && selected) {
          const next = { id: tr.id, lat: selected.lat, lng: selected.lng, heading: 0, scale: 1 };
          placements.push(next);
          place = next;
          drawSketch();
        }
        renderPanel();
      } else if (selected) placeTreatment(selected.lat, selected.lng);
      else renderPanel();
    };
  });
  if (document.getElementById("rotL") && place) {
    document.getElementById("rotL").onclick = () => { place.heading -= 15; placements[placements.length - 1] = place; drawSketch(); };
    document.getElementById("rotR").onclick = () => { place.heading += 15; placements[placements.length - 1] = place; drawSketch(); };
    document.getElementById("bigger").onclick = () => { place.scale = Math.min(2.8, place.scale + 0.12); placements[placements.length - 1] = place; drawSketch(); };
    document.getElementById("smaller").onclick = () => { place.scale = Math.max(0.4, place.scale - 0.12); placements[placements.length - 1] = place; drawSketch(); };
  }
  const file = document.getElementById("fileBrief");
  if (file) file.onclick = () => { submitted = true; renderPanel(); };
  const neu = document.getElementById("newCh");
  if (neu) neu.onclick = () => { challenge = null; placements = []; place = null; holding = null; submitted = false; clearSketch(); hideCompare(); renderPins(); map.setView([41.85, -87.65], 11); renderPanel(); };
}
function startChallenge(id) {
  challenge = CHALLENGES.find((c) => c.id === id);
  submitted = false;
  placements = [];
  place = null;
  holding = null;
  const pool = intersections.filter((i) => i.score100 >= 70);
  selected = pool[Math.floor(Math.random() * pool.length)] || intersections[0];
  renderPins();
  map.setView([selected.lat, selected.lng], 18);
  renderPanel();
}
function renderPins() {
  pins.clearLayers();
  const list = MODE === "game" && selected ? [selected] : intersections;
  list.forEach((ix) => {
    const color = ix.score100 >= 70 ? "#e24b4b" : ix.score100 >= 40 ? "#e2a54b" : "#3d9b6e";
    const marker = L.circleMarker([ix.lat, ix.lng], { radius: 5 + ix.score100 / 25, color, weight: 1, fillColor: color, fillOpacity: 0.75, pane: "markerPane" }).addTo(pins);
    marker.bindTooltip(`${ix.name} · ${ix.score100}`);
    marker.on("click", (ev) => { L.DomEvent.stopPropagation(ev); selectCorner(ix); });
  });
}
const mapEl = document.getElementById("map");
mapEl.addEventListener("dragover", (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; });
mapEl.addEventListener("drop", (e) => {
  e.preventDefault();
  const mouse = L.DomEvent.getMousePosition(e, mapEl);
  const ll = map.containerPointToLatLng([mouse.x, mouse.y]);
  placeTreatment(ll.lat, ll.lng);
  document.body.classList.remove("holding");
});
map.on("click", (e) => { if (holding) placeTreatment(e.latlng.lat, e.latlng.lng); });
document.getElementById("compareSlider").addEventListener("input", applyCompare);
function selectCorner(ix) {
  selected = ix;
  map.setView([ix.lat, ix.lng], Math.max(map.getZoom(), 17));
  if (MODE !== "game" && !holding) { place = null; placements = []; clearSketch(); hideCompare(); }
  renderPanel();
}
function norm(s) { return (s || "").toLowerCase().replace(/[^a-z0-9& ]/g, " ").replace(/\s+/g, " ").trim(); }
function searchCorners(q) {
  const parts = norm(q).split(" ").filter(Boolean);
  if (!parts.length) return [];
  return intersections.map((ix) => ({ ix, hits: parts.filter((p) => norm(ix.name).includes(p)).length }))
    .filter((r) => r.hits === parts.length).sort((a, b) => b.ix.score100 - a.ix.score100).slice(0, 8).map((r) => r.ix);
}
const searchInput = document.getElementById("searchInput");
const searchHits = document.getElementById("searchHits");
if (searchInput) {
  searchInput.addEventListener("input", () => {
    const hits = searchCorners(searchInput.value);
    if (!searchInput.value.trim() || !hits.length) { searchHits.hidden = true; searchHits.innerHTML = ""; return; }
    searchHits.hidden = false;
    searchHits.innerHTML = hits.map((ix) => `<button type="button" data-id="${ix.id}"><strong>${ix.name}</strong><br><em>score ${ix.score100} · ${ix.crashes} crashes</em></button>`).join("");
    searchHits.querySelectorAll("button").forEach((btn) => {
      btn.onclick = () => {
        const ix = intersections.find((x) => x.id === btn.dataset.id);
        searchHits.hidden = true;
        searchInput.value = ix.name;
        selectCorner(ix);
      };
    });
  });
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const hits = searchCorners(searchInput.value);
      if (hits[0]) { searchHits.hidden = true; searchInput.value = hits[0].name; selectCorner(hits[0]); }
    }
  });
}
fetch("intersections.json").then((r) => r.json()).then((data) => {
  intersections = data.intersections;
  renderPins();
  renderPanel();
}).catch((err) => { panel.innerHTML = `<p>Could not load intersections.json (${err}).</p>`; });
