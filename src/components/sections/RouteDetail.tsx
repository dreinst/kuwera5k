"use client";

import Reveal from "@/components/Reveal";
import RouteMap from "@/components/RouteMap";
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

          <div className="mt-8 h-80 rounded-[20px] border border-glass-border bg-glass p-4 backdrop-blur-md">
            <RouteMap />
          </div>
          <p className="mt-2 text-xs text-white/40">
            Loop dari &amp; ke Lapangan Rampal, diukur ulang dari GPX resmi
          </p>

          <p className="mt-4 text-xs leading-relaxed text-white/50">
            {route.streets.join(" → ")}
          </p>
        </Reveal>

        <div className="relative">
          {route.checkpoints.map((cp, i) => (
            <Reveal key={`${cp.label}-${cp.km}`} delay={i * 0.06} className="relative flex gap-4 pb-8 last:pb-0">
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
