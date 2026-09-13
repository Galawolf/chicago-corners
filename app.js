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
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap",
  maxZoom: 19,
}).addTo(map);

const panel = document.getElementById("detail");
let selected = null;
let activeTreat = null;
const sketch = L.layerGroup().addTo(map);

function offsetMeters(lat, lng, eastM, northM) {
  const dLat = northM / 111320;
  const dLng = eastM / (111320 * Math.cos((lat * Math.PI) / 180));
  return [lat + dLat, lng + dLng];
}

function clearSketch() {
  sketch.clearLayers();
}

function drawSketch(ix, id) {
  clearSketch();
  const { lat, lng } = ix;
  const ink = "#1d4e89";
  const paint = { color: ink, weight: 3, fillColor: "#4aa3df", fillOpacity: 0.35 };
  map.setView([lat, lng], 18);

  if (id === "roundabout") {
    L.circle([lat, lng], { ...paint, radius: 18 }).addTo(sketch);
    L.circle([lat, lng], { color: "#2e7d32", weight: 2, fillColor: "#7dba7f", fillOpacity: 0.5, radius: 6 }).addTo(sketch);
    L.circle([lat, lng], { color: ink, weight: 1, fill: false, radius: 26, dashArray: "4 4" }).addTo(sketch);
  } else if (id === "daylight") {
    [
      [10, 10],
      [10, -10],
      [-10, 10],
      [-10, -10],
    ].forEach(([e, n]) => {
      L.circle(offsetMeters(lat, lng, e, n), { ...paint, radius: 5, fillColor: "#f4d35e" }).addTo(sketch);
    });
  } else if (id === "curb") {
    [
      [8, 8],
      [8, -8],
      [-8, 8],
      [-8, -8],
    ].forEach(([e, n]) => {
      L.circle(offsetMeters(lat, lng, e, n), { ...paint, radius: 7 }).addTo(sketch);
    });
  } else if (id === "lpi") {
    const arms = [
      [offsetMeters(lat, lng, -14, 3), offsetMeters(lat, lng, 14, 3)],
      [offsetMeters(lat, lng, -14, -3), offsetMeters(lat, lng, 14, -3)],
      [offsetMeters(lat, lng, 3, -14), offsetMeters(lat, lng, 3, 14)],
      [offsetMeters(lat, lng, -3, -14), offsetMeters(lat, lng, -3, 14)],
    ];
    arms.forEach((line) => L.polyline(line, { color: "#c9a227", weight: 6, opacity: 0.85 }).addTo(sketch));
  } else if (id === "diet") {
    L.polyline([offsetMeters(lat, lng, 0, -45), offsetMeters(lat, lng, 0, 45)], { color: "#2e7d32", weight: 8, opacity: 0.7 }).addTo(sketch);
    L.polyline([offsetMeters(lat, lng, -6, -45), offsetMeters(lat, lng, -6, 45)], { color: "#fff", weight: 2, dashArray: "6 8" }).addTo(sketch);
    L.polyline([offsetMeters(lat, lng, 6, -45), offsetMeters(lat, lng, 6, 45)], { color: "#fff", weight: 2, dashArray: "6 8" }).addTo(sketch);
  } else if (id === "left") {
    L.polyline(
      [offsetMeters(lat, lng, -20, 4), offsetMeters(lat, lng, 0, 4), offsetMeters(lat, lng, 4, 20)],
      { color: "#c0392b", weight: 4 }
    ).addTo(sketch);
    L.circleMarker(offsetMeters(lat, lng, 4, 20), { radius: 5, color: "#c0392b", fillColor: "#c0392b", fillOpacity: 1 }).addTo(sketch);
  }
}

function tone(score100) {
  if (score100 >= 70) return "high";
  if (score100 >= 40) return "mid";
  return "ok";
}

function render(ix) {
  selected = ix;
  activeTreat = null;
  clearSketch();
  const t = tone(ix.score100);
  panel.innerHTML = `
    <h1>${ix.name}</h1>
    <p class="lede">${ix.control} · ${ix.crashes} reported intersection crashes since 2023 · trend ${ix.trend}</p>
    <div class="score-row">
      <div class="stat ${t}"><b>${ix.score100}</b><span>Safety score</span></div>
      <div class="stat"><b>${ix.injuryCrashes}</b><span>Injury crashes</span></div>
      <div class="stat"><b>${ix.seriousCrashes + ix.fatalCrashes}</b><span>Serious or fatal</span></div>
    </div>
    <p class="lede">Score weights how many crashes happened and how severe they were. It does not describe who was involved.</p>
    <h2>Try a change</h2>
    <div class="treatments">
      ${TREATMENTS.map(
        (tr) => `<button class="treat" data-id="${tr.id}"><strong>${tr.name}</strong><em>${tr.cost}</em></button>`
      ).join("")}
    </div>
    <div id="result" class="result empty">Pick a treatment to see a sketch of cost, fit, and what research usually finds.</div>
    <p class="disclaimer">Sketch for public discussion, not an engineering study. Crash data: City of Chicago open portal, intersection-related records 2023–present. Safety ranges come from published crash-modification research and will not match any one corner exactly.</p>
  `;
  panel.querySelectorAll(".treat").forEach((btn) => {
    btn.onclick = () => showTreat(btn.dataset.id);
  });
}

function showTreat(id) {
  const tr = TREATMENTS.find((x) => x.id === id);
  activeTreat = id;
  panel.querySelectorAll(".treat").forEach((b) => b.classList.toggle("active", b.dataset.id === id));
  const box = document.getElementById("result");
  let fit = tr.fit;
  if (tr.id === "roundabout") {
    fit = "Likely tight on a typical Chicago parcel — treat fit as “maybe” until someone measures the right-of-way.";
  }
  if (tr.id === "lpi" && !/SIGNAL/i.test(selected.control)) {
    fit = "This corner is not coded as a signal in the crash file — LPI only applies if there is a signal.";
  }
  box.className = "result";
  box.innerHTML = `
    <h3>${tr.name}</h3>
    <p><strong>Cost band:</strong> ${tr.cost}</p>
    <p><strong>Fit:</strong> ${fit}</p>
    <p><strong>Injuries (research range):</strong> ${tr.injury}</p>
    <p><strong>When it fails:</strong> ${tr.whenFails}</p>
    <p class="lede">Blue / yellow shapes on the map are a sketch of the idea, not a surveyed design.</p>
  `;
  drawSketch(selected, tr.id);
}

fetch("intersections.json")
  .then((r) => r.json())
  .then((data) => {
    data.intersections.forEach((ix) => {
      const color = ix.score100 >= 70 ? "#e24b4b" : ix.score100 >= 40 ? "#e2a54b" : "#3d9b6e";
      const marker = L.circleMarker([ix.lat, ix.lng], {
        radius: 5 + ix.score100 / 25,
        color,
        weight: 1,
        fillColor: color,
        fillOpacity: 0.75,
      }).addTo(map);
      marker.bindTooltip(`${ix.name} · ${ix.score100}`);
      marker.on("click", () => {
        map.panTo([ix.lat, ix.lng]);
        render(ix);
      });
    });
    render(data.intersections[0]);
  })
  .catch((err) => {
    panel.innerHTML = `<p>Could not load intersections.json (${err}). Open this folder with a local web server.</p>`;
  });
