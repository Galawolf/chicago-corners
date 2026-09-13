const TREATMENTS = [
  {
    id: "lpi",
    name: "Leading pedestrian interval",
    cost: "$5k–$25k",
    fit: "Fits most signalized corners",
    injury: "Often cuts pedestrian injury crashes ~10–40% in studies",
    whenFails: "Does little if the problem is speed or left turns, not walk time.",
  },
  {
    id: "daylight",
    name: "Daylighting (no parking at corners)",
    cost: "$1k–$15k",
    fit: "Fits almost anywhere there is curb parking",
    injury: "Improves visibility; injury change varies by site",
    whenFails: "Weak if drivers still take the corner at high speed.",
  },
  {
    id: "curb",
    name: "Curb extensions",
    cost: "$40k–$200k",
    fit: "Needs leftover pavement; check turning trucks",
    injury: "Shortens crossing, can cut ped conflicts",
    whenFails: "Fails if the street is a heavy truck route and corners get clipped.",
  },
  {
    id: "left",
    name: "Protected or banned left turns",
    cost: "$20k–$150k",
    fit: "Works at signals with left-turn demand",
    injury: "Often reduces angle / left-turn injury crashes",
    whenFails: "Can push turns to the next block if there is no alternate path.",
  },
  {
    id: "diet",
    name: "Road diet on the approach",
    cost: "$50k–$400k",
    fit: "Best on 4-lane streets with moderate volume",
    injury: "Typically large drop in injury crashes on the corridor",
    whenFails: "Controversial where people believe capacity will collapse.",
  },
  {
    id: "roundabout",
    name: "Single-lane roundabout",
    cost: "$250k–$2M+",
    fit: "Needs a large clear footprint — many Chicago corners fail this",
    injury: "Injury crashes often drop; fender-benders may rise",
    whenFails: "Won't fit tight urban parcels; multi-lane versions are weaker on safety.",
  },
];

const map = L.map("map").setView([41.85, -87.65], 11);

const streets = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap",
  maxZoom: 19,
});
const satellite = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
  attribution: "Tiles &copy; Esri — imagery for sketching only",
  maxZoom: 19,
});
satellite.addTo(map);

document.getElementById("basemapToggle").addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  document.querySelectorAll("#basemapToggle button").forEach((b) => b.classList.toggle("on", b === btn));
  if (btn.dataset.base === "sat") {
    map.removeLayer(streets);
    if (!map.hasLayer(satellite)) satellite.addTo(map);
  } else {
    map.removeLayer(satellite);
    if (!map.hasLayer(streets)) streets.addTo(map);
  }
});

const panel = document.getElementById("detail");
const sketch = L.layerGroup().addTo(map);

let intersections = [];
let selected = null;
let holding = null;

function offsetMeters(lat, lng, eastM, northM) {
  const dLat = northM / 111320;
  const dLng = eastM / (111320 * Math.cos((lat * Math.PI) / 180));
  return [lat + dLat, lng + dLng];
}

function clearSketch() {
  sketch.clearLayers();
}

function pt(lat, lng, e, n) {
  return offsetMeters(lat, lng, e, n);
}

function zebra(lat, lng, alongE, alongN, acrossE, acrossN) {
  for (let i = -4; i <= 4; i += 1) {
    const a0 = i * 1.6;
    const a1 = a0 + 0.8;
    L.polyline(
      [
        pt(lat, lng, alongE * a0 + acrossE, alongN * a0 + acrossN),
        pt(lat, lng, alongE * a1 + acrossE, alongN * a1 + acrossN),
      ],
      { color: "#f4f1ea", weight: 4, opacity: 0.9 }
    ).addTo(sketch);
  }
}

function bulbOut(lat, lng, signE, signN) {
  const sidewalk = 12;
  const nose = 4.5;
  const ring = {
    color: "#3a3530",
    weight: 2,
    fillColor: "#cfc6b4",
    fillOpacity: 0.88,
  };
  return L.polygon(
    [
      pt(lat, lng, signE * sidewalk, signN * sidewalk),
      pt(lat, lng, signE * nose, signN * sidewalk),
      pt(lat, lng, signE * (nose - 1), signN * (sidewalk - 3)),
      pt(lat, lng, signE * 5.5, signN * 5.5),
      pt(lat, lng, signE * (sidewalk - 3), signN * (nose - 1)),
      pt(lat, lng, signE * sidewalk, signN * nose),
    ],
    ring
  ).addTo(sketch);
}

function drawSketch(lat, lng, id) {
  clearSketch();

  if (id === "roundabout") {
    L.circle([lat, lng], { color: "#d8d2c6", weight: 10, fill: false, radius: 16 }).addTo(sketch);
    L.circle([lat, lng], { color: "#2f4a2f", weight: 1, fillColor: "#4d7a45", fillOpacity: 0.85, radius: 7 }).addTo(sketch);
    L.circle([lat, lng], { color: "#f4f1ea", weight: 2, fill: false, radius: 21, dashArray: "6 8" }).addTo(sketch);
  } else if (id === "daylight") {
    [[9, 9], [9, -9], [-9, 9], [-9, -9]].forEach(([e, n]) => {
      L.circle(pt(lat, lng, e, n), {
        color: "#c9a227",
        weight: 1,
        fillColor: "#f4d35e",
        fillOpacity: 0.45,
        radius: 5,
        dashArray: "3 4",
      }).addTo(sketch);
    });
  } else if (id === "curb") {
    bulbOut(lat, lng, 1, 1);
    bulbOut(lat, lng, 1, -1);
    bulbOut(lat, lng, -1, 1);
    bulbOut(lat, lng, -1, -1);
    zebra(lat, lng, 1, 0, 0, 6);
    zebra(lat, lng, 0, 1, 6, 0);
    zebra(lat, lng, 1, 0, 0, -6);
    zebra(lat, lng, 0, 1, -6, 0);
  } else if (id === "lpi") {
    zebra(lat, lng, 1, 0, 0, 5);
    zebra(lat, lng, 0, 1, 5, 0);
    zebra(lat, lng, 1, 0, 0, -5);
    zebra(lat, lng, 0, 1, -5, 0);
    L.circleMarker([lat, lng], { radius: 4, color: "#2ecc71", fillColor: "#2ecc71", fillOpacity: 1 }).addTo(sketch);
  } else if (id === "diet") {
    L.polygon(
      [pt(lat, lng, -3.2, -48), pt(lat, lng, 3.2, -48), pt(lat, lng, 3.2, 48), pt(lat, lng, -3.2, 48)],
      { color: "#2e7d32", weight: 1, fillColor: "#5aa35e", fillOpacity: 0.55 }
    ).addTo(sketch);
    L.polyline([pt(lat, lng, -7, -48), pt(lat, lng, -7, 48)], { color: "#f4f1ea", weight: 2, dashArray: "8 10" }).addTo(sketch);
    L.polyline([pt(lat, lng, 7, -48), pt(lat, lng, 7, 48)], { color: "#f4f1ea", weight: 2, dashArray: "8 10" }).addTo(sketch);
  } else if (id === "left") {
    L.polyline([pt(lat, lng, -22, 3.5), pt(lat, lng, 0, 3.5), pt(lat, lng, 3.5, 22)], { color: "#e74c3c", weight: 5 }).addTo(sketch);
    L.circleMarker(pt(lat, lng, 3.5, 22), { radius: 5, color: "#e74c3c", fillColor: "#e74c3c", fillOpacity: 1 }).addTo(sketch);
    L.polyline([pt(lat, lng, -8, 3.5), pt(lat, lng, -4, 6.5), pt(lat, lng, -8, 3.5), pt(lat, lng, -4, 0.5)], { color: "#e74c3c", weight: 3 }).addTo(sketch);
  }
}

function nearestIntersection(lat, lng) {
  let best = null;
  let bestD = Infinity;
  intersections.forEach((ix) => {
    const dLat = (ix.lat - lat) * 111320;
    const dLng = (ix.lng - lng) * 111320 * Math.cos((lat * Math.PI) / 180);
    const d = Math.hypot(dLat, dLng);
    if (d < bestD) {
      bestD = d;
      best = ix;
    }
  });
  return { ix: best, meters: bestD };
}

function tone(score100) {
  if (score100 >= 70) return "high";
  if (score100 >= 40) return "mid";
  return "ok";
}

function treatmentCopy(tr, ix) {
  let fit = tr.fit;
  if (tr.id === "roundabout") {
    fit = "Likely tight on a typical Chicago parcel — treat fit as \u201cmaybe\u201d until someone measures the right-of-way.";
  }
  if (ix && tr.id === "lpi" && !/SIGNAL/i.test(ix.control)) {
    fit = "This corner is not coded as a signal in the crash file — LPI only applies if there is a signal.";
  }
  return fit;
}

function placeTreatment(lat, lng) {
  if (!holding) return;
  const found = nearestIntersection(lat, lng);
  if (found.ix && found.meters < 120) selected = found.ix;
  drawSketch(lat, lng, holding.id);
  renderPanel();
}

function renderPanel() {
  const holdNote = holding
    ? `<p class="lede pickup">Holding <strong>${holding.name}</strong>. Drag it onto the map, or click the map where the streets actually meet.</p>`
    : `<p class="lede">Click a change, then drag it onto the corner you mean — the colored dot is only an approximate pin.</p>`;

  let stats = "";
  if (selected) {
    const t = tone(selected.score100);
    stats = `
      <h1>${selected.name}</h1>
      <p class="lede">${selected.control} · ${selected.crashes} reported intersection crashes since 2023 · trend ${selected.trend}</p>
      <div class="score-row">
        <div class="stat ${t}"><b>${selected.score100}</b><span>Safety score</span></div>
        <div class="stat"><b>${selected.injuryCrashes}</b><span>Injury crashes</span></div>
        <div class="stat"><b>${selected.seriousCrashes + selected.fatalCrashes}</b><span>Serious or fatal</span></div>
      </div>
    `;
  } else {
    stats = `<h1>Chicago Corners</h1><p class="lede">Click a problematic intersection to read its score. Changes live in the list below until you drop them on the map.</p>`;
  }

  let result = `<div id="result" class="result empty">No change placed yet.</div>`;
  if (holding && sketch.getLayers().length) {
    const fit = treatmentCopy(holding, selected);
    result = `
      <div id="result" class="result">
        <h3>${holding.name}</h3>
        <p><strong>Cost band:</strong> ${holding.cost}</p>
        <p><strong>Fit:</strong> ${fit}</p>
        <p><strong>Injuries (research range):</strong> ${holding.injury}</p>
        <p><strong>When it fails:</strong> ${holding.whenFails}</p>
        <p class="lede">You placed this sketch. Drag again to move it onto the painted intersection.</p>
      </div>`;
  }

  panel.innerHTML = `
    ${stats}
    ${holdNote}
    <h2>Changes</h2>
    <div class="treatments">
      ${TREATMENTS.map(
        (tr) => `<button class="treat${holding && holding.id === tr.id ? " active" : ""}" draggable="true" data-id="${tr.id}"><strong>${tr.name}</strong><em>${tr.cost} · drag onto map</em></button>`
      ).join("")}
    </div>
    ${result}
    <p class="disclaimer">Sketch for public discussion, not an engineering study. Crash data: City of Chicago open portal, intersection-related records 2023–present.</p>
  `;

  panel.querySelectorAll(".treat").forEach((btn) => {
    const tr = TREATMENTS.find((x) => x.id === btn.dataset.id);
    btn.onclick = () => {
      holding = tr;
      document.body.classList.add("holding");
      renderPanel();
    };
    btn.addEventListener("dragstart", (e) => {
      holding = tr;
      e.dataTransfer.setData("text/plain", tr.id);
      e.dataTransfer.effectAllowed = "copy";
      document.body.classList.add("holding");
    });
  });
}

const mapEl = document.getElementById("map");
mapEl.addEventListener("dragover", (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = "copy";
});
mapEl.addEventListener("drop", (e) => {
  e.preventDefault();
  const mouse = L.DomEvent.getMousePosition(e, mapEl);
  const ll = map.containerPointToLatLng([mouse.x, mouse.y]);
  placeTreatment(ll.lat, ll.lng);
  document.body.classList.remove("holding");
});

map.on("click", (e) => {
  if (holding) placeTreatment(e.latlng.lat, e.latlng.lng);
});

fetch("intersections.json")
  .then((r) => r.json())
  .then((data) => {
    intersections = data.intersections;
    intersections.forEach((ix) => {
      const color = ix.score100 >= 70 ? "#e24b4b" : ix.score100 >= 40 ? "#e2a54b" : "#3d9b6e";
      const marker = L.circleMarker([ix.lat, ix.lng], {
        radius: 5 + ix.score100 / 25,
        color,
        weight: 1,
        fillColor: color,
        fillOpacity: 0.75,
      }).addTo(map);
      marker.bindTooltip(`${ix.name} · ${ix.score100}`);
      marker.on("click", (ev) => {
        L.DomEvent.stopPropagation(ev);
        selected = ix;
        map.setView([ix.lat, ix.lng], Math.max(map.getZoom(), 16));
        if (!holding) clearSketch();
        renderPanel();
      });
    });
    renderPanel();
  })
  .catch((err) => {
    panel.innerHTML = `<p>Could not load intersections.json (${err}).</p>`;
  });
