"use client";

import { motion } from "framer-motion";

// Rute resmi KUWERA 5K: loop dari/ke Lapangan Rampal via Jl. Ronggolawe, Urip Sumoharjo,
// Panglima Sudirman, Untung Suropati Utara, Terusan Kesatrian, Mayjen M. Wiyono, Indraprasta,
// Hamid Rusdi, Lapangan Brawijaya. Bentuk loop disederhanakan dari peta rute panitia.
const ROUTE_PATH =
  "M120,260 L85,340 L95,400 L170,430 L215,370 L225,330 L270,300 L300,260 L320,190 L290,120 L210,80 L150,110 Z";

const KM_MARKERS = [
  { label: "1", x: 95, y: 400 },
  { label: "2", x: 225, y: 330 },
  { label: "3", x: 320, y: 190 },
  { label: "4", x: 210, y: 80 },
];

const WATER_STATIONS = [
  { x: 270, y: 300 },
  { x: 150, y: 110 },
];

const START_FINISH = { x: 120, y: 260 };

export default function RouteMap() {
  return (
    <svg viewBox="0 0 400 500" className="h-full w-full">
      <defs>
        <linearGradient id="routeLine" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F4E71D" />
          <stop offset="100%" stopColor="#E3B219" />
        </linearGradient>
      </defs>

      <motion.path
        d={ROUTE_PATH}
        fill="none"
        stroke="url(#routeLine)"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 2, ease: [0.65, 0, 0.35, 1] }}
      />

      {WATER_STATIONS.map((ws, i) => (
        <g key={`ws-${i}`} transform={`translate(${ws.x}, ${ws.y})`}>
          <circle r={9} className="fill-green-deep" stroke="#FFBB00" strokeWidth={1.5} />
          <path
            d="M0,-4 C2.2,-1.5 4,0.7 4,2.5 C4,4.8 2.2,6.5 0,6.5 C-2.2,6.5 -4,4.8 -4,2.5 C-4,0.7 -2.2,-1.5 0,-4 Z"
            className="fill-brand-yellow"
          />
        </g>
      ))}

      {KM_MARKERS.map((km) => (
        <g key={km.label} transform={`translate(${km.x}, ${km.y})`}>
          <circle r={13} className="fill-brand-yellow" />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-green-deep font-display"
            style={{ fontSize: 11 }}
          >
            {km.label}
          </text>
        </g>
      ))}

      <g transform={`translate(${START_FINISH.x}, ${START_FINISH.y})`}>
        <circle r={16} className="fill-white" />
        <text
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-green-deep font-display"
          style={{ fontSize: 9 }}
        >
          S/F
        </text>
      </g>
    </svg>
  );
}
