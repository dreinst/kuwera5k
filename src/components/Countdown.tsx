"use client";

import { useNow } from "@/lib/use-now";

const UNITS = [
  { label: "Hari", of: (s: number) => Math.floor(s / 86400) },
  { label: "Jam", of: (s: number) => Math.floor((s % 86400) / 3600) },
  { label: "Menit", of: (s: number) => Math.floor((s % 3600) / 60) },
  { label: "Detik", of: (s: number) => s % 60 },
];

// Sebelum jam browser terbaca, kotaknya tetap dirender (angka disembunyikan) supaya tata letak tidak bergeser.
export default function Countdown({ to, label }: { to: string; label: string }) {
  const now = useNow();
  const left = now === null ? 0 : Math.max(0, Math.floor((new Date(to).getTime() - now) / 1000));
  return (
    <div role="timer" aria-label={label} className="flex flex-col items-center">
      <p className="text-xs font-semibold tracking-[0.2em] text-white/80 uppercase">{label}</p>
      <div className="mt-3 flex gap-2 sm:gap-3">
        {UNITS.map((u) => (
          <div
            key={u.label}
            className="flex w-[4.5rem] flex-col items-center rounded-2xl border border-glass-border bg-glass py-3 backdrop-blur-md sm:w-20 lg:w-[4.5rem] xl:w-20"
          >
            <span className={`font-display text-4xl leading-none text-brand-yellow tabular-nums sm:text-5xl lg:text-4xl xl:text-5xl ${now === null ? "invisible" : ""}`}>
              {String(u.of(left)).padStart(2, "0")}
            </span>
            <span className="mt-1.5 text-[11px] font-semibold tracking-wide text-white uppercase">{u.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
