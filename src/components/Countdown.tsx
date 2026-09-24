"use client";

import { useSyncExternalStore } from "react";

// Jam dibaca dari browser tiap detik. Di server snapshot-nya null, jadi HTML statis tidak memuat angka yang
// langsung basi; kotaknya tetap dirender (angka disembunyikan) supaya tata letak tidak bergeser saat angka muncul.
const subscribe = (tick: () => void) => {
  const id = setInterval(tick, 1000);
  return () => clearInterval(id);
};
const nowSeconds = () => Math.floor(Date.now() / 1000);
const serverSnapshot = () => null;

const UNITS = [
  { label: "Hari", of: (s: number) => Math.floor(s / 86400) },
  { label: "Jam", of: (s: number) => Math.floor((s % 86400) / 3600) },
  { label: "Menit", of: (s: number) => Math.floor((s % 3600) / 60) },
  { label: "Detik", of: (s: number) => s % 60 },
];

export default function Countdown({ to, label }: { to: string; label: string }) {
  const now = useSyncExternalStore(subscribe, nowSeconds, serverSnapshot);
  const left = now === null ? 0 : Math.max(0, Math.floor(new Date(to).getTime() / 1000) - now);
  return (
    <div role="timer" aria-label={label} className="flex flex-col items-center">
      <p className="text-xs font-semibold tracking-[0.2em] text-white/80 uppercase">{label}</p>
      <div className="mt-3 flex gap-2 sm:gap-3">
        {UNITS.map((u) => (
          <div
            key={u.label}
            className="flex w-[4.5rem] flex-col items-center rounded-2xl border border-glass-border bg-glass py-3 backdrop-blur-md sm:w-20"
          >
            <span className={`font-display text-4xl leading-none text-brand-yellow tabular-nums sm:text-5xl ${now === null ? "invisible" : ""}`}>
              {String(u.of(left)).padStart(2, "0")}
            </span>
            <span className="mt-1.5 text-[11px] font-semibold tracking-wide text-white uppercase">{u.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
