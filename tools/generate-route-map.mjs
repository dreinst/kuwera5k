// Bangun peta rute KUWERA 5K dari data OpenStreetMap.
// Output: public/images/route-map-bg.svg (latar jalan) dan src/lib/route-map.ts (jalur + marker).
// Jalankan: node tools/generate-route-map.mjs   (pakai cache tools/cache/roads.json kalau ada)
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const cacheFile = join(here, "cache", "roads.json");
const extraFiles = ["route-streets.json", "rampal-roads.json"].map((f) => join(here, "cache", f));
const BBOX = "-7.981,112.626,-7.955,112.654";
const UA = "kuwera5k-route-map/1.0 (asteinec@gmail.com)";

// Urutan jalan sesuai peta rute panitia (nama persis seperti di OSM).
const ROUTE = [
  "Jalan Ronggolawe",
  "Jalan Jendral Urip Sumoharjo",
  "Jalan Panglima Besar Sudirman",
  "Jalan Untung Suropati Utara",
  "Jalan Kesatrian",
  "Jalan Terusan Kesatrian",
  "Jalan Mayor Jenderal Mohammad Wiyono",
  "Jalan Indraprasta",
  "Jalan Hamid Rusdi Timur",
  "Jalan Hamid Rusdi",
  "Jalan Ronggolawe",
];
// "Jl. Lapangan Brawijaya" di peta panitia = putaran mengelilingi Lapangan Rampal (sisi timur lalu
// selatan) sebelum finish di sisi barat; jalannya tidak bernama di OSM, jadi dipakai titik antara
// di sisi timur dan selatan lapangan.
const FIELD_NAME = /Lapangan Rampal/i;
const WATER_M = [2600, -250]; // meter dari start; negatif = dari finish
const ARROW_EVERY_M = 650;

async function loadRoads() {
  if (existsSync(cacheFile)) {
    const main = JSON.parse(readFileSync(cacheFile, "utf8"));
    const seen = new Set(main.elements.map((e) => e.id));
    for (const f of extraFiles) {
      if (!existsSync(f)) continue;
      for (const e of JSON.parse(readFileSync(f, "utf8")).elements) if (!seen.has(e.id)) { seen.add(e.id); main.elements.push(e); }
    }
    return main;
  }
  const ql = `[out:json][timeout:120];(
    way["highway"~"^(trunk|primary|secondary|tertiary|residential|unclassified|living_street|primary_link|secondary_link|tertiary_link)$"](${BBOX});
    way["highway"](-7.9780,112.6380,-7.9700,112.6460);
    way["railway"="rail"](${BBOX});
    way["waterway"="river"](${BBOX});
    way["leisure"~"^(park|pitch|stadium)$"](${BBOX});
  );out geom;`;
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" },
    body: "data=" + encodeURIComponent(ql),
  });
  if (!res.ok) throw new Error(`Overpass ${res.status}`);
  const json = await res.json();
  mkdirSync(dirname(cacheFile), { recursive: true });
  writeFileSync(cacheFile, JSON.stringify(json));
  return json;
}

const R = 6371000;
const rad = (d) => (d * Math.PI) / 180;
function haversine(a, b) {
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

const data = await loadRoads();
const ways = data.elements.filter((e) => e.type === "way" && e.geometry);
const roads = ways.filter((w) => w.tags.highway);

// Graf jalan: node id -> {lat,lon}, adjacency dengan panjang + nama jalan.
const coord = new Map();
const adj = new Map();
const routeSet = new Set(ROUTE);
function addEdge(a, b, len, name) {
  if (!adj.has(a)) adj.set(a, []);
  if (!adj.has(b)) adj.set(b, []);
  adj.get(a).push({ to: b, len, name });
  adj.get(b).push({ to: a, len, name });
}
const nodesByStreet = new Map(ROUTE.map((n) => [n, new Set()]));
for (const w of roads) {
  const name = w.tags.name ?? "";
  for (let i = 0; i < w.nodes.length; i++) {
    coord.set(w.nodes[i], w.geometry[i]);
    if (nodesByStreet.has(name)) nodesByStreet.get(name).add(w.nodes[i]);
    if (i > 0) addEdge(w.nodes[i - 1], w.nodes[i], haversine(w.geometry[i - 1], w.geometry[i]), name);
  }
}
for (const [name, set] of nodesByStreet) if (!set.size) throw new Error(`Jalan tidak ditemukan di OSM: ${name}`);

// Titik start/finish: node Jalan Ronggolawe terdekat ke pusat Lapangan Rampal.
// Ambil poligon Rampal terbesar (lapangan utamanya tercatat sebagai leisure=park, bukan pitch).
const bboxArea = (g) => (Math.max(...g.map((p) => p.lat)) - Math.min(...g.map((p) => p.lat))) * (Math.max(...g.map((p) => p.lon)) - Math.min(...g.map((p) => p.lon)));
const fieldCandidates = ways.filter((w) => FIELD_NAME.test(w.tags.name ?? "") && w.tags.leisure);
fieldCandidates.forEach((w) => {
  const g = w.geometry, la = g.map((p) => p.lat), lo = g.map((p) => p.lon);
  console.log(`lapangan: ${w.tags.name} (${w.tags.leisure}) ~${Math.round(haversine({lat:Math.min(...la),lon:Math.min(...lo)},{lat:Math.min(...la),lon:Math.max(...lo)}))} x ${Math.round(haversine({lat:Math.min(...la),lon:Math.min(...lo)},{lat:Math.max(...la),lon:Math.min(...lo)}))} m`);
});
const field = fieldCandidates.reduce((a, b) => (bboxArea(b.geometry) > bboxArea(a.geometry) ? b : a));
console.log(`dipakai: ${field.tags.name} (${field.tags.leisure})`);
const centroid = (g) => ({ lat: g.reduce((s, p) => s + p.lat, 0) / g.length, lon: g.reduce((s, p) => s + p.lon, 0) / g.length });
const fieldC = centroid(field.geometry);
const nearest = (ids, target) => [...ids].reduce((best, id) => (haversine(coord.get(id), target) < haversine(coord.get(best), target) ? id : best));
const startNode = nearest(nodesByStreet.get("Jalan Ronggolawe"), fieldC);

// Simpang antar jalan berurutan: node yang dipakai bersama, kalau tidak ada pakai pasangan terdekat.
const junctions = [];
let prev = startNode;
for (let i = 0; i < ROUTE.length - 1; i++) {
  const A = nodesByStreet.get(ROUTE[i]), B = nodesByStreet.get(ROUTE[i + 1]);
  const shared = [...A].filter((id) => B.has(id));
  let j;
  if (shared.length) j = nearest(shared, coord.get(prev));
  else {
    let best = Infinity;
    for (const a of A) for (const b of B) { const d = haversine(coord.get(a), coord.get(b)); if (d < best) { best = d; j = b; } }
    console.warn(`tidak ada simpang langsung ${ROUTE[i]} -> ${ROUTE[i + 1]}, jarak terdekat ${best.toFixed(0)} m`);
  }
  junctions.push({ node: j, from: ROUTE[i], to: ROUTE[i + 1] });
  prev = j;
}

// Dijkstra dengan penalti untuk ruas di luar jalan rute, supaya jalur menempel di jalan yang disebut panitia.
function shortest(from, to) {
  const dist = new Map([[from, 0]]), back = new Map(), done = new Set();
  const pq = [[0, from]];
  while (pq.length) {
    pq.sort((a, b) => a[0] - b[0]);
    const [d, u] = pq.shift();
    if (done.has(u)) continue;
    done.add(u);
    if (u === to) break;
    for (const e of adj.get(u) ?? []) {
      const cost = d + e.len * (routeSet.has(e.name) ? 1 : 6);
      if (cost < (dist.get(e.to) ?? Infinity)) { dist.set(e.to, cost); back.set(e.to, { from: u, name: e.name, len: e.len }); pq.push([cost, e.to]); }
    }
  }
  if (!back.has(to) && from !== to) throw new Error("tidak ada jalur");
  const path = [];
  for (let u = to; u !== from; u = back.get(u).from) path.push({ node: u, name: back.get(u).name, len: back.get(u).len });
  return path.reverse();
}

const eastV = field.geometry.reduce((a, b) => (b.lon > a.lon ? b : a));
const southV = field.geometry.reduce((a, b) => (b.lat < a.lat ? b : a));
function nearestRoadNode(target, maxM = 150) {
  let best = null, bd = Infinity;
  for (const [id, c] of coord) { const d = haversine(c, target); if (d < bd) { bd = d; best = id; } }
  if (bd > maxM) throw new Error(`tidak ada jalan dalam ${maxM} m dari ${target.lat},${target.lon}`);
  return best;
}
// FIELD_LAP=true menambah putaran sisi timur lalu selatan lapangan sebelum finish. Dimatikan sampai
// panitia mengonfirmasi jalur di dalam kawasan Rampal (loop jalan raya saja sekitar 4,0 km).
const FIELD_LAP = process.env.FIELD_LAP === "1";
if (FIELD_LAP) {
  junctions.push(
    { node: nearestRoadNode(eastV), to: "sisi timur Lapangan Rampal" },
    { node: nearestRoadNode(southV), to: "sisi selatan Lapangan Rampal" },
  );
}
// Kalau ada tools/route.gpx (rekaman lari resmi), pakai jalurnya langsung; nama jalan per titik
// diambil dari ruas OSM terdekat supaya label KM tetap terisi.
const gpxFile = join(here, "route.gpx");
let pts;
if (existsSync(gpxFile)) {
  const gpx = readFileSync(gpxFile, "utf8");
  const raw = [...gpx.matchAll(/<trkpt[^>]*lat="([-\d.]+)"[^>]*lon="([-\d.]+)"/g)].map((m) => ({ lat: +m[1], lon: +m[2] }));
  if (raw.length < 2) throw new Error("route.gpx tidak berisi trkpt");
  const nameNear = (p) => { let best = "", bd = 60; for (const w of roads) for (const g of w.geometry) { const d = haversine(g, p); if (d < bd) { bd = d; best = w.tags.name ?? ""; } } return best; };
  pts = [{ ...raw[0], d: 0, name: nameNear(raw[0]) }];
  for (let i = 1; i < raw.length; i++) pts.push({ ...raw[i], d: pts[i - 1].d + haversine(raw[i - 1], raw[i]), name: nameNear(raw[i]) });
  console.log(`sumber: route.gpx (${raw.length} titik), panjang ${pts.at(-1).d.toFixed(0)} m`);
} else {
  const stops = [startNode, ...junctions.map((j) => j.node), startNode];
  const legs = [];
  for (let i = 0; i < stops.length - 1; i++) legs.push(shortest(stops[i], stops[i + 1]));
  const steps = legs.flat();
  legs.forEach((leg, i) => {
    const names = leg.map((e) => e.name).filter((n, k, arr) => k === 0 || n !== arr[k - 1]);
    const j = junctions[i] ? coord.get(junctions[i].node) : coord.get(startNode);
    console.log(`  leg ${i + 1} -> ${(junctions[i]?.to ?? "Finish")}: ${leg.reduce((s, e) => s + e.len, 0).toFixed(0)} m @ ${j.lat.toFixed(4)},${j.lon.toFixed(4)} via ${names.join(" > ") || "-"}`);
  });
  pts = [{ ...coord.get(startNode), d: 0, name: ROUTE[0] }];
  let acc = 0;
  for (const e of steps) { acc += e.len; pts.push({ ...coord.get(e.node), d: acc, name: e.name }); }
}
const total = pts.at(-1).d;
console.log(`panjang rute: ${total.toFixed(0)} m`);
function at(dm) {
  if (dm < 0) dm = total + dm;
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].d >= dm) {
      const a = pts[i - 1], b = pts[i], t = (dm - a.d) / ((b.d - a.d) || 1);
      return { lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t, name: b.name, a, b };
    }
  }
  return { ...pts.at(-1), a: pts.at(-2), b: pts.at(-1) };
}
for (let km = 1; km * 1000 < total; km++) console.log(`  KM ${km}: ${at(km * 1000).name}`);

// Proyeksi ke koordinat SVG (equirectangular, utara di atas).
const lat0 = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
const kx = Math.cos(rad(lat0));
const lats = pts.map((p) => p.lat), lons = pts.map((p) => p.lon);
const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLon = Math.min(...lons), maxLon = Math.max(...lons);
const spanX = (maxLon - minLon) * kx, spanY = maxLat - minLat;
const margin = 0.16;
const scale = 1000 / (Math.max(spanX, spanY) * (1 + 2 * margin));
const ox = minLon - (spanX * margin) / kx, oy = maxLat + spanY * margin;
const W = Math.round(spanX * (1 + 2 * margin) * scale), H = Math.round(spanY * (1 + 2 * margin) * scale);
const proj = (p) => [((p.lon - ox) * kx * scale), ((oy - p.lat) * scale)];
const r1 = (n) => Math.round(n * 10) / 10;

// Latar: sederhanakan polyline, buang yang di luar bidang gambar.
function simplify(points, tol) {
  if (points.length < 3) return points;
  const sq = (p, a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    if (!dx && !dy) return (p[0] - a[0]) ** 2 + (p[1] - a[1]) ** 2;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)));
    return (p[0] - a[0] - t * dx) ** 2 + (p[1] - a[1] - t * dy) ** 2;
  };
  const keep = new Array(points.length).fill(false); keep[0] = keep[points.length - 1] = true;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop(); let idx = -1, max = tol * tol;
    for (let i = s + 1; i < e; i++) { const d = sq(points[i], points[s], points[e]); if (d > max) { max = d; idx = i; } }
    if (idx > 0) { keep[idx] = true; stack.push([s, idx], [idx, e]); }
  }
  return points.filter((_, i) => keep[i]);
}
const inside = (p) => p[0] > -40 && p[0] < W + 40 && p[1] > -40 && p[1] < H + 40;
const toD = (points, close = false) => points.map((p, i) => `${i ? "L" : "M"}${r1(p[0])},${r1(p[1])}`).join("") + (close ? "Z" : "");
const layers = { main: [], mid: [], minor: [], rail: [], river: [], green: [] };
let fieldD = "";
for (const w of ways) {
  const t = w.tags; const g = w.geometry.map(proj);
  if (!g.some(inside)) continue;
  const s = simplify(g, 0.7);
  if (t.leisure) {
    if (FIELD_NAME.test(t.name ?? "") && w === field) fieldD = toD(s, true);
    else layers.green.push(toD(s, true));
  } else if (t.railway) layers.rail.push(toD(s));
  else if (t.waterway) layers.river.push(toD(s));
  else if (/^(trunk|primary|primary_link)$/.test(t.highway)) layers.main.push(toD(s));
  else if (/^(secondary|tertiary|secondary_link|tertiary_link)$/.test(t.highway)) layers.mid.push(toD(s));
  else layers.minor.push(toD(s));
}
const bg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" fill="none" stroke-linecap="round" stroke-linejoin="round">
<path d="${layers.green.join("")}" fill="#ffffff" fill-opacity="0.05"/>
<path d="${layers.river.join("")}" stroke="#ffffff" stroke-opacity="0.22" stroke-width="5"/>
<path d="${layers.minor.join("")}" stroke="#ffffff" stroke-opacity="0.16" stroke-width="1.6"/>
<path d="${layers.mid.join("")}" stroke="#ffffff" stroke-opacity="0.32" stroke-width="3"/>
<path d="${layers.main.join("")}" stroke="#ffffff" stroke-opacity="0.42" stroke-width="4.5"/>
<path d="${layers.rail.join("")}" stroke="#ffffff" stroke-opacity="0.3" stroke-width="2.4" stroke-dasharray="8 6"/>
<path d="${fieldD}" fill="#64A322" fill-opacity="0.55" stroke="#F4E71D" stroke-opacity="0.6" stroke-width="2"/>
</svg>`;
mkdirSync(join(root, "public", "images"), { recursive: true });
writeFileSync(join(root, "public", "images", "route-map-bg.svg"), bg);

// Jalur rute + marker.
const routePts = simplify(pts.map(proj), 0.5);
const km = [];
for (let k = 1; k * 1000 < total; k++) { const p = proj(at(k * 1000)); km.push({ km: k, x: r1(p[0]), y: r1(p[1]) }); }
const water = WATER_M.map((m) => { const p = proj(at(m)); return { m: Math.round(m < 0 ? total + m : m), x: r1(p[0]), y: r1(p[1]) }; });
water.forEach((w) => console.log(`  water station ${w.m} m: ${at(w.m).name || "(jalan tanpa nama)"}`));
const arrows = [];
for (let m = 350; m < total - 200; m += ARROW_EVERY_M) {
  const s = at(m); const a = proj(s.a), b = proj(s.b), p = proj(s);
  arrows.push({ x: r1(p[0]), y: r1(p[1]), angle: Math.round((Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI) });
}
const sp = proj(pts[0]);
const fc = proj(fieldC);
const ts = `// Dihasilkan oleh tools/generate-route-map.mjs dari data OpenStreetMap. Jangan diedit manual.
export const routeMap = {
  viewBox: "0 0 ${W} ${H}",
  lengthM: ${Math.round(total)},
  path: "${toD(routePts)}",
  start: { x: ${r1(sp[0])}, y: ${r1(sp[1])} },
  field: { label: "LAP. RAMPAL", x: ${r1(fc[0])}, y: ${r1(fc[1])} },
  km: ${JSON.stringify(km)},
  water: ${JSON.stringify(water)},
  arrows: ${JSON.stringify(arrows)},
};
`;
writeFileSync(join(root, "src", "lib", "route-map.ts"), ts);
console.log(`viewBox 0 0 ${W} ${H}; latar ${(Buffer.byteLength(bg) / 1024).toFixed(0)} KB; titik jalur ${routePts.length}`);
