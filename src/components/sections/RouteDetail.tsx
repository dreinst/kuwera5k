"use client";

import Reveal from "@/components/Reveal";
import { route } from "@/lib/event-data";

export default function RouteDetail() {
  return (
    <section id="rute" className="bg-green-deep px-6 py-24">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-2">
        <Reveal>
          <p className="text-xs font-semibold tracking-wide text-gold uppercase">Rute</p>
          <h2 className="font-display mt-2 text-4xl text-white uppercase">
            5K <span className="text-yellow-lime underline decoration-yellow-lime underline-offset-8">Route</span>
          </h2>
          <p className="mt-4 max-w-md text-white/60">
            Cut-off waktu {route.cutOffMinutes} menit. Water station tersedia di sepanjang rute, dijaga
            marshal dan tim medis.
          </p>

          <div className="mt-8 flex h-64 items-center justify-center rounded-[20px] border border-glass-border bg-glass backdrop-blur-md">
            <svg viewBox="0 0 200 100" className="h-40 w-full px-6">
              <path
                d="M10,80 C40,20 70,90 100,50 S160,10 190,40"
                fill="none"
                stroke="#F4E71D"
                strokeWidth="2"
                strokeLinecap="round"
                pathLength={1}
                style={{
                  strokeDasharray: 1,
                  strokeDashoffset: 0,
                }}
              />
            </svg>
          </div>
          <p className="mt-2 text-xs text-white/40">Ilustrasi rute, diukur ulang dari GPX resmi</p>
        </Reveal>

        <div className="relative">
          {route.checkpoints.map((cp, i) => (
            <Reveal key={cp.label} delay={i * 0.06} className="relative flex gap-4 pb-8 last:pb-0">
              <div className="flex flex-col items-center">
                <span className="flex h-3 w-3 shrink-0 rounded-full bg-gold" />
                {i < route.checkpoints.length - 1 && (
                  <span className="mt-1 w-px flex-1 bg-white/15" />
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-white">
                  {cp.label} <span className="text-white/40">&middot; km {cp.km}</span>
                </p>
                <p className="text-sm text-white/60">{cp.place}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
