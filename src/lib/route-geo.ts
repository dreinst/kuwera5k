import { routeMap } from "@/lib/route-map";

// Titik jalur poster dan jarak kumulatifnya (satuan piksel poster).
const points = [...routeMap.path.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)].map((m) => [Number(m[1]), Number(m[2])] as const);
const cumulative = points.reduce<number[]>((acc, p, i) => {
  acc.push(i === 0 ? 0 : acc[i - 1] + Math.hypot(p[0] - points[i - 1][0], p[1] - points[i - 1][1]));
  return acc;
}, []);

// Km lomba ke posisi relatif di jalur (0 sampai 1), diinterpolasi di antara penanda KM poster.
// Start = km 0 di awal jalur, finish = km 5 di ujung jalur.
export function tAtKm(km: number) {
  const marks = [{ km: 0, t: 0 }, ...routeMap.km.map((k) => ({ km: k.km, t: k.t })), { km: 5, t: 1 }];
  for (let i = 0; i < marks.length - 1; i++) {
    const a = marks[i], b = marks[i + 1];
    if (km <= b.km) return a.t + ((km - a.km) / (b.km - a.km)) * (b.t - a.t);
  }
  return 1;
}

export function pointAtT(t: number) {
  const target = Math.max(0, Math.min(1, t)) * cumulative[cumulative.length - 1];
  const i = Math.max(1, cumulative.findIndex((c) => c >= target));
  const [x0, y0] = points[i - 1], [x1, y1] = points[i];
  const u = (target - cumulative[i - 1]) / (cumulative[i] - cumulative[i - 1] || 1);
  return { x: x0 + u * (x1 - x0), y: y0 + u * (y1 - y0) };
}
