"use client";

import { motion } from "framer-motion";
import { routeMap } from "@/lib/route-map";

const [, , vbW, vbH] = routeMap.viewBox.split(" ").map(Number);
const DRAW_SECONDS = 2.4;
const drawEase = [0.65, 0, 0.35, 1] as const;

// Marker muncul saat garis rute sampai di titiknya.
const reachDelay = (meters: number) => 0.2 + (meters / routeMap.lengthM) * DRAW_SECONDS;

const pop = (delay: number) => ({
  hidden: { scale: 0, opacity: 0 },
  show: {
    scale: 1,
    opacity: 1,
    transition: { delay, type: "spring" as const, stiffness: 260, damping: 18 },
  },
});

// compact: versi kecil untuk kartu hero, tanpa latar jalan, panah, dan water station.
export default function RouteMap({ compact = false }: { compact?: boolean }) {
  return (
    <motion.svg
      viewBox={routeMap.viewBox}
      className="h-full w-full"
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.3 }}
    >
      <defs>
        <linearGradient id="routeLine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#F4E71D" />
          <stop offset="100%" stopColor="#FFBB00" />
        </linearGradient>
      </defs>

      {!compact && <image href="/images/route-map-bg.svg" x={0} y={0} width={vbW} height={vbH} />}

      {!compact && (
      <text
        x={routeMap.field.x}
        y={routeMap.field.y}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-white font-display"
        style={{ fontSize: 15, letterSpacing: 2 }}
        opacity={0.9}
      >
        {routeMap.field.label}
      </text>
      )}

      <path
        d={routeMap.path}
        fill="none"
        stroke="#0B4A2C"
        strokeOpacity={0.75}
        strokeWidth={15}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <motion.path
        d={routeMap.path}
        fill="none"
        stroke="url(#routeLine)"
        strokeWidth={8}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        variants={{
          hidden: { pathLength: 0 },
          show: { pathLength: 1, transition: { duration: DRAW_SECONDS, ease: drawEase } },
        }}
      />

      {!compact && routeMap.arrows.map((a, i) => (
        <motion.g
          key={`arrow-${i}`}
          variants={{
            hidden: { opacity: 0 },
            show: { opacity: 1, transition: { delay: DRAW_SECONDS + 0.2 + i * 0.08 } },
          }}
        >
          <polygon
            points="-11,-8 13,0 -11,8"
            fill="#0B4A2C"
            transform={`translate(${a.x} ${a.y}) rotate(${a.angle})`}
          />
        </motion.g>
      ))}

      {!compact && routeMap.water.map((w) => (
        <motion.g key={`water-${w.m}`} variants={pop(reachDelay(w.m))}>
          <circle cx={w.x} cy={w.y} r={17} fill="#FDFBF5" stroke="#0B4A2C" strokeWidth={2.5} />
          <path
            d="M0,-8 C4,-3 7,1 7,4.5 C7,8.6 3.9,11.5 0,11.5 C-3.9,11.5 -7,8.6 -7,4.5 C-7,1 -4,-3 0,-8 Z"
            fill="#1C6B06"
            transform={`translate(${w.x} ${w.y - 1.5})`}
          />
        </motion.g>
      ))}

      {routeMap.km.map((k) => (
        <motion.g key={`km-${k.km}`} variants={pop(reachDelay(k.km * 1000))}>
          <circle cx={k.x} cy={k.y} r={23} fill="#FFBB00" stroke="#0B4A2C" strokeWidth={3} />
          <text
            x={k.x}
            y={k.y + 1}
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-green-deep font-display"
            style={{ fontSize: 23 }}
          >
            {k.km}
          </text>
        </motion.g>
      ))}

      <motion.g variants={pop(0.1)}>
        <circle cx={routeMap.start.x} cy={routeMap.start.y} r={29} fill="#FFFFFF" stroke="#0B4A2C" strokeWidth={3} />
        <text
          x={routeMap.start.x}
          y={routeMap.start.y - 6}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-green-deep font-display"
          style={{ fontSize: 13, letterSpacing: 1 }}
        >
          START
        </text>
        <text
          x={routeMap.start.x}
          y={routeMap.start.y + 8}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-green-deep font-display"
          style={{ fontSize: 13, letterSpacing: 1 }}
        >
          FINISH
        </text>
      </motion.g>
    </motion.svg>
  );
}
