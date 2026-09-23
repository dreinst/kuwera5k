"use client";

import Reveal from "@/components/Reveal";
import RouteMap from "@/components/RouteMap";
import JerseyTexture from "@/components/JerseyTexture";
import { route } from "@/lib/event-data";
import { routeMap } from "@/lib/route-map";
import { marshalPosts } from "@/lib/marshal-posts";

const [, , vbW, vbH] = routeMap.viewBox.split(" ").map(Number);

function LegendFlag({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
      <path d="M3 1v14" stroke="#FDFBF5" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M4 2h9l-2.5 3L13 8H4z" fill={color} />
    </svg>
  );
}

export default function RouteDetail() {
  return (
    <section id="rute" className="relative overflow-clip bg-green-deep px-6 py-24">
      <JerseyTexture dots="left" glow={false} />
      <div className="relative mx-auto max-w-6xl">
        <Reveal className="max-w-2xl">
          <p className="text-xs font-semibold tracking-wide text-gold uppercase">Rute</p>
          <h2 className="font-display mt-2 text-4xl text-white uppercase">
            5K <span className="text-yellow-lime underline decoration-yellow-lime underline-offset-8">Route</span>
          </h2>
          <p className="mt-4 text-white/70">
            Batas waktu {route.cutOffMinutes} menit. Ada dua water station dan {marshalPosts.length} pos
            marshal di sepanjang jalur.
          </p>
        </Reveal>

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
          <Reveal className="lg:sticky lg:top-24">
            <div
              className="overflow-hidden rounded-[20px] border border-glass-border bg-glass p-3 sm:p-5"
              style={{ aspectRatio: `${vbW} / ${vbH}` }}
            >
              <RouteMap />
            </div>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-white/80">
              <span className="flex items-center gap-2"><LegendFlag color="#3DDC3D" /> Start</span>
              <span className="flex items-center gap-2"><LegendFlag color="#E53935" /> Finish</span>
              <span className="flex items-center gap-2"><span className="inline-block h-4 w-4 rounded-md bg-green-deep ring-1 ring-white/50" /> Pos marshal</span>
              <span className="flex items-center gap-2"><span className="inline-block h-4 w-4 rounded-full bg-cream ring-1 ring-white/50" /> Water station</span>
              <span className="flex items-center gap-2"><span className="inline-block h-0.5 w-6 bg-brand-yellow" /> Rute</span>
              <span className="flex items-center gap-2"><span className="inline-block h-4 w-4 rotate-45 bg-brand-yellow" /> KM</span>
            </div>
            <p className="mt-3 text-xs text-white/65">
              Peta rute resmi panitia, utara di atas. Jarak 5K sudah termasuk lintasan di dalam lapangan.
            </p>
          </Reveal>

          <div className="grid gap-10 sm:grid-cols-2 lg:gap-8">
            <Reveal>
              <p className="text-xs font-semibold tracking-wide text-gold uppercase">Urutan jalan</p>
              <ol className="mt-4 space-y-2 text-sm text-white/80">
                {route.streets.map((street, i) => (
                  <li key={`${street}-${i}`} className="flex gap-3">
                    <span className="w-6 shrink-0 font-semibold text-gold">{i + 1}</span>
                    {street}
                  </li>
                ))}
              </ol>
            </Reveal>

            <div className="relative">
              <Reveal>
                <p className="mb-4 text-xs font-semibold tracking-wide text-gold uppercase">Checkpoint</p>
              </Reveal>
              {route.checkpoints.map((cp, i) => (
                <Reveal key={`${cp.label}-${cp.km}`} delay={i * 0.06} className="relative flex gap-4 pb-6 last:pb-0">
                  <div className="flex flex-col items-center">
                    <span className="flex h-3 w-3 shrink-0 rounded-full bg-gold" />
                    {i < route.checkpoints.length - 1 && (
                      <span className="mt-1 w-px flex-1 bg-white/15" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {cp.label} <span className="text-white/50">&middot; km {cp.km}</span>
                    </p>
                    <p className="text-sm text-white/70">{cp.place}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
