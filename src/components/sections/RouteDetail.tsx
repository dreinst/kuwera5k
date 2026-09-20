"use client";

import Reveal from "@/components/Reveal";
import RouteMap from "@/components/RouteMap";
import { route } from "@/lib/event-data";
import { routeMap } from "@/lib/route-map";

const [, , vbW, vbH] = routeMap.viewBox.split(" ").map(Number);

export default function RouteDetail() {
  return (
    <section id="rute" className="bg-green-deep px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal className="max-w-2xl">
          <p className="text-xs font-semibold tracking-wide text-gold uppercase">Rute</p>
          <h2 className="font-display mt-2 text-4xl text-white uppercase">
            5K <span className="text-yellow-lime underline decoration-yellow-lime underline-offset-8">Route</span>
          </h2>
          <p className="mt-4 text-white/70">
            Batas waktu {route.cutOffMinutes} menit. Ada dua water station di rute, dan marshal
            berjaga di sepanjang jalur.
          </p>
        </Reveal>

        <Reveal className="mx-auto mt-10 max-w-4xl">
          <div
            className="overflow-hidden rounded-[20px] border border-glass-border bg-glass p-3 sm:p-5"
            style={{ aspectRatio: `${vbW} / ${vbH}` }}
          >
            <RouteMap />
          </div>
          <p className="mt-3 text-xs text-white/65">
            Utara di atas. Jalur mengikuti peta rute resmi panitia (jarak 5K termasuk lintasan di
            dalam lapangan); titik KM dan water station diletakkan dari geometri jalan. Data peta &copy;{" "}
            <a href="https://www.openstreetmap.org/copyright" className="underline hover:text-brand-yellow">
              OpenStreetMap contributors
            </a>
            , lisensi ODbL.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-12 lg:grid-cols-2">
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
              <Reveal key={`${cp.label}-${cp.km}`} delay={i * 0.06} className="relative flex gap-4 pb-8 last:pb-0">
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
    </section>
  );
}
