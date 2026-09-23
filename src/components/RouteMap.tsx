"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { routeMap } from "@/lib/route-map";
import { marshalPosts } from "@/lib/marshal-posts";
import { route } from "@/lib/event-data";
import { pointAtT, tAtKm } from "@/lib/route-geo";

const [, , vbW, vbH] = routeMap.viewBox.split(" ").map(Number);
const DRAW_SECONDS = 2.6;
const reach = (t: number) => 0.2 + t * DRAW_SECONDS;

// Water station diambil dari daftar checkpoint (km), lalu ditempatkan di titik km itu pada jalur.
const waterStations = route.checkpoints
  .filter((c) => c.label === "Water station")
  .map((c) => { const t = tAtKm(c.km); return { ...pointAtT(t), t }; });

const pop = (delay: number) => ({
  hidden: { scale: 0, opacity: 0 },
  show: {
    scale: 1,
    opacity: 1,
    transition: { delay, type: "spring" as const, stiffness: 260, damping: 18 },
  },
});

// Titik-titik oktagon (radius r) untuk badge KM, meniru poster.
const octagon = (r: number) =>
  Array.from({ length: 8 }, (_, i) => {
    const a = (Math.PI / 8) * (2 * i + 1);
    return `${(r * Math.cos(a)).toFixed(1)},${(r * Math.sin(a)).toFixed(1)}`;
  }).join(" ");

export const FLAG_START = "#3DDC3D";
export const FLAG_FINISH = "#E53935";

function Flag({ x, y, color }: { x: number; y: number; color: string }) {
  // (x, y) = pangkal tiang bendera, sama seperti posisi di poster.
  return (
    <g transform={`translate(${x} ${y})`}>
      <line x1={0} y1={0} x2={0} y2={-170} stroke="#FDFBF5" strokeWidth={12} strokeLinecap="round" />
      <path d="M6,-170 L136,-170 L104,-130 L136,-90 L6,-90 Z" fill={color} stroke="#0B4A2C" strokeWidth={7} strokeLinejoin="round" />
    </g>
  );
}

// Start dan finish di titik yang sama (keputusan panitia 23 Sep 2026): dua bendera bersilang,
// hijau untuk start dan merah untuk finish, di lokasi bendera start pada poster.
function StartFinish({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g transform="rotate(14)"><Flag x={0} y={0} color={FLAG_START} /></g>
      <g transform="scale(-1 1) rotate(14)"><Flag x={0} y={0} color={FLAG_FINISH} /></g>
      <circle r={18} fill="#FDFBF5" stroke="#0B4A2C" strokeWidth={6} />
    </g>
  );
}

export default function RouteMap({ compact = false }: { compact?: boolean }) {
  const s = compact ? 1.6 : 1; // marker sedikit lebih besar di peta mini
  // Latar peta (~300 KB) baru diunduh saat peta mendekati layar, supaya tidak berebut jaringan dengan hero.
  const ref = useRef<SVGSVGElement>(null);
  const near = useInView(ref, { once: true, margin: "800px 0px" });
  return (
    <motion.svg
      ref={ref}
      viewBox={routeMap.viewBox}
      className="h-full w-full"
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.3 }}
    >
      <defs>
        {/* userSpaceOnUse: semua segmen rute berbagi satu gradasi, jadi warnanya menyambung di sambungan. */}
        <linearGradient id="routeLine" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={vbW} y2={vbH}>
          <stop offset="0%" stopColor="#F4E71D" />
          <stop offset="100%" stopColor="#FFBB00" />
        </linearGradient>
      </defs>

      {!compact && near && (
        <image href={routeMap.background} x={0} y={0} width={vbW} height={vbH} preserveAspectRatio="none" />
      )}

      {!compact && routeMap.field && (
        <g>
          <ellipse
            cx={routeMap.field.cx} cy={routeMap.field.cy} rx={routeMap.field.rx} ry={routeMap.field.ry}
            fill="#64A322" fillOpacity={0.85} stroke="#F4E71D" strokeWidth={6}
          />
          <ellipse
            cx={routeMap.field.cx} cy={routeMap.field.cy} rx={routeMap.field.rx * 0.72} ry={routeMap.field.ry * 0.62}
            fill="none" stroke="#FDFBF5" strokeOpacity={0.5} strokeWidth={4}
          />
          {/* Label di bagian atas lapangan supaya tidak tertutup bendera start dan finish. */}
          <text
            x={routeMap.field.cx + 60} y={routeMap.field.cy - 95} textAnchor="middle" dominantBaseline="central"
            className="fill-white font-display" style={{ fontSize: 78, letterSpacing: 4 }}
            transform={`rotate(-8 ${routeMap.field.cx + 60} ${routeMap.field.cy - 95})`}
          >
            {routeMap.field.label}
          </text>
        </g>
      )}

      {/* Rute digambar per segmen: lajur start (bentuk U) dan lajur finish di Jl. Urip Sumoharjo lebih ramping
          dari garis utama supaya tiga lajur sejajar muat tanpa menutupi lapangan. Digambar berurutan. */}
      {routeMap.segments.map((seg, i) => (
        <path
          key={`halo-${i}`} d={seg.d} fill="none" stroke="#0B4A2C" strokeOpacity={0.75}
          strokeWidth={(seg.lane ? routeMap.laneWidth + 26 : 150) * s} strokeLinecap="round" strokeLinejoin="round"
        />
      ))}
      {routeMap.segments.map((seg, i) => (
        <motion.path
          key={`line-${i}`}
          d={seg.d}
          fill="none"
          stroke="url(#routeLine)"
          strokeWidth={(seg.lane ? routeMap.laneWidth : 118) * s}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          variants={{
            hidden: { pathLength: 0 },
            show: { pathLength: 1, transition: { delay: 0.2 + seg.t0 * DRAW_SECONDS, duration: (seg.t1 - seg.t0) * DRAW_SECONDS, ease: "linear" } },
          }}
        />
      ))}

      {/* Panah arah dibuat lebih kecil dari lebar garis rute supaya tetap di dalam garis (di lajur S/F diperkecil lagi). */}
      {!compact && routeMap.arrows.map((a, i) => (
        <motion.g key={`arrow-${i}`} variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { delay: reach(a.t) + 0.15 } } }}>
          <polygon points="-48,-32 58,0 -48,32 -24,0" fill="#0B4A2C" transform={`translate(${a.x} ${a.y}) rotate(${a.angle}) scale(${a.scale})`} />
        </motion.g>
      ))}

      {/* Pos marshal dari peta pos PAM panitia: titik di garis rute, ikon di sampingnya. */}
      {!compact && marshalPosts.map((m, i) => (
        <motion.g key={`marshal-${i}`} variants={{ hidden: { opacity: 0, scale: 0 }, show: { opacity: 1, scale: 1, transition: { delay: reach(m.t) + 0.2 } } }}>
          <line x1={m.x} y1={m.y} x2={m.ix} y2={m.iy} stroke="#FDFBF5" strokeWidth={8} strokeLinecap="round" />
          <circle cx={m.x} cy={m.y} r={30} fill="#0B4A2C" stroke="#FDFBF5" strokeWidth={9} />
          <rect x={m.ix - 62} y={m.iy - 62} width={124} height={124} rx={22} fill="#0B4A2C" stroke="#FDFBF5" strokeWidth={6} />
          <circle cx={m.ix} cy={m.iy - 16} r={22} fill="#FDFBF5" />
          <path d={`M${m.ix - 40},${m.iy + 46} a40,36 0 0 1 80,0 z`} fill="#FDFBF5" />
        </motion.g>
      ))}

      {!compact && waterStations.map((w, i) => (
        <motion.g key={`water-${i}`} variants={pop(reach(w.t))}>
          <path
            d={`M${w.x},${w.y} c-70,-95 -110,-135 -110,-195 a110,110 0 0 1 220,0 c0,60 -40,100 -110,195 z`}
            fill="#FDFBF5" stroke="#0B4A2C" strokeWidth={6}
          />
          <rect x={w.x - 30} y={w.y - 250} width={60} height={92} rx={14} fill="#1C6B06" />
          <rect x={w.x - 14} y={w.y - 268} width={28} height={22} rx={6} fill="#1C6B06" />
        </motion.g>
      ))}

      {routeMap.km.map((k) => (
        <motion.g key={`km-${k.km}`} variants={pop(reach(k.t))}>
          <polygon points={octagon(88 * s)} fill="#FFBB00" stroke="#0B4A2C" strokeWidth={8 * s} strokeLinejoin="round" transform={`translate(${k.x} ${k.y})`} />
          <text x={k.x} y={k.y - 14 * s} textAnchor="middle" dominantBaseline="central" className="fill-green-deep font-display" style={{ fontSize: 66 * s }}>{k.km}</text>
          <text x={k.x} y={k.y + 40 * s} textAnchor="middle" dominantBaseline="central" className="fill-green-deep font-display" style={{ fontSize: 34 * s, letterSpacing: 2 }}>KM</text>
        </motion.g>
      ))}

      {routeMap.start && (
        <motion.g variants={pop(0.1)}>
          <StartFinish x={routeMap.start.x} y={routeMap.start.y} />
        </motion.g>
      )}
    </motion.svg>
  );
}
