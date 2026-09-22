"use client";

import { motion } from "framer-motion";
import { routeMap } from "@/lib/route-map";

const [, , vbW, vbH] = routeMap.viewBox.split(" ").map(Number);
const DRAW_SECONDS = 2.6;
const drawEase = [0.65, 0, 0.35, 1] as const;
const reach = (t: number) => 0.2 + t * DRAW_SECONDS;

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

export default function RouteMap({ compact = false }: { compact?: boolean }) {
  const s = compact ? 1.6 : 1; // marker sedikit lebih besar di peta mini
  return (
    <motion.svg
      viewBox={routeMap.viewBox}
      className="h-full w-full"
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.3 }}
    >
      <defs>
        <linearGradient id="routeLine" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F4E71D" />
          <stop offset="100%" stopColor="#FFBB00" />
        </linearGradient>
      </defs>

      {!compact && (
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
          <text
            x={routeMap.field.cx} y={routeMap.field.cy} textAnchor="middle" dominantBaseline="central"
            className="fill-white font-display" style={{ fontSize: 96, letterSpacing: 4 }}
            transform={`rotate(-8 ${routeMap.field.cx} ${routeMap.field.cy})`}
          >
            {routeMap.field.label}
          </text>
        </g>
      )}

      <path d={routeMap.path} fill="none" stroke="#0B4A2C" strokeOpacity={0.75} strokeWidth={150 * s} strokeLinecap="round" strokeLinejoin="round" />
      <motion.path
        d={routeMap.path}
        fill="none"
        stroke="url(#routeLine)"
        strokeWidth={118 * s}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        variants={{ hidden: { pathLength: 0 }, show: { pathLength: 1, transition: { duration: DRAW_SECONDS, ease: drawEase } } }}
      />

      {!compact && routeMap.arrows.map((a, i) => (
        <motion.g key={`arrow-${i}`} variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { delay: reach(a.t) + 0.15 } } }}>
          <polygon points="-110,-70 130,0 -110,70 -62,0" fill="#0B4A2C" transform={`translate(${a.x} ${a.y}) rotate(${a.angle})`} />
        </motion.g>
      ))}

      {!compact && routeMap.marshals.map((m, i) => (
        <motion.g key={`marshal-${i}`} variants={{ hidden: { opacity: 0, scale: 0 }, show: { opacity: 1, scale: 1, transition: { delay: DRAW_SECONDS + 0.3 + i * 0.03 } } }}>
          <rect x={m.x - 62} y={m.y - 62} width={124} height={124} rx={22} fill="#0B4A2C" stroke="#FDFBF5" strokeWidth={6} />
          <circle cx={m.x} cy={m.y - 16} r={22} fill="#FDFBF5" />
          <path d={`M${m.x - 40},${m.y + 46} a40,36 0 0 1 80,0 z`} fill="#FDFBF5" />
        </motion.g>
      ))}

      {!compact && routeMap.water.map((w, i) => (
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
          <Flag x={routeMap.start.x} y={routeMap.start.y} color={FLAG_START} />
        </motion.g>
      )}
      {routeMap.finish && (
        <motion.g variants={pop(DRAW_SECONDS + 0.2)}>
          <Flag x={routeMap.finish.x} y={routeMap.finish.y} color={FLAG_FINISH} />
        </motion.g>
      )}
    </motion.svg>
  );
}
