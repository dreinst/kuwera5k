"use client";

import Reveal from "@/components/Reveal";
import RouteMap from "@/components/RouteMap";
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

// Nama jalan dua warna seperti konsep: kata terakhir putih, sisanya kuning.
function TwoTone({ text }: { text: string }) {
  const words = text.toUpperCase().split(" ");
  const tail = words.length > 1 ? words.pop() : null;
  return (
    <>
      <span className="text-brand-yellow">{words.join(" ")}</span>
      {tail && <span className="text-white"> {tail}</span>}
    </>
  );
}

function Node({ edge }: { edge: boolean }) {
  return (
    <span
      className={`relative z-10 h-5 w-5 shrink-0 rounded-full border-2 ${
        edge ? "border-brand-yellow bg-cream shadow-[0_0_14px_rgba(244,231,29,0.85)]" : "border-white bg-green-deep"
      }`}
    />
  );
}

export default function RouteDetail() {
  const lastStreet = route.streets.length - 1;
  const lastCheckpoint = route.checkpoints.length - 1;
  return (
    <section id="rute" className="relative scroll-mt-16 px-6 py-20">
      <div className="relative mx-auto max-w-6xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-4xl text-white uppercase sm:text-5xl">
            Detail{" "}
            <span className="text-brand-yellow underline decoration-brand-yellow decoration-4 underline-offset-8">Rute</span>
          </h2>
          <p className="mt-5 text-white/80">
            Rute {route.distanceKm} km dengan batas waktu {route.cutOffMinutes} menit. Water station ada di km 2,5, tepatnya di
            Denzibang, dan {marshalPosts.length} pos marshal berjaga di sepanjang jalur.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
          <Reveal className="lg:sticky lg:top-24">
            <div
              className="overflow-hidden rounded-[20px] border border-glass-border bg-card p-3 sm:p-5"
              style={{ aspectRatio: `${vbW} / ${vbH}` }}
            >
              <RouteMap />
            </div>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-white/80">
              <span className="flex items-center gap-2"><span className="flex"><LegendFlag color="#3DDC3D" /><LegendFlag color="#E53935" /></span> Start dan finish</span>
              <span className="flex items-center gap-2"><span className="inline-block h-4 w-4 rounded-md bg-green-deep ring-1 ring-white/50" /> Pos marshal</span>
              <span className="flex items-center gap-2"><span className="inline-block h-4 w-4 rounded-full bg-cream ring-1 ring-white/50" /> Water station</span>
              <span className="flex items-center gap-2"><span className="inline-block h-0.5 w-6 bg-brand-yellow" /> Rute</span>
              <span className="flex items-center gap-2"><span className="inline-block h-4 w-4 rotate-45 bg-brand-yellow" /> KM</span>
            </div>
            <p className="mt-3 text-xs text-white/75">
              Peta rute resmi panitia, utara di atas. Jarak 5K sudah termasuk lintasan di dalam lapangan.
            </p>
          </Reveal>

          {/* Urutan jalan lalu checkpoint di sebelah kanannya (permintaan Donny), bergaya linimasa konsep. */}
          <div className="grid gap-10 sm:grid-cols-2 lg:gap-8">
            <div>
              <Reveal>
                <p className="mb-5 text-xs font-semibold tracking-wide text-gold uppercase">Urutan jalan</p>
              </Reveal>
              <ol>
                {route.streets.map((street, i) => (
                  <Reveal as="li" key={`${street}-${i}`} delay={i * 0.04} className="relative flex items-center gap-4 pb-4 last:pb-0">
                    {i < lastStreet && <span aria-hidden className="absolute top-5 bottom-0 left-[9px] w-0.5 bg-white/35" />}
                    <Node edge={i === 0 || i === lastStreet} />
                    <span className="font-display text-base leading-tight tracking-wide sm:text-lg">
                      <TwoTone text={street} />
                    </span>
                  </Reveal>
                ))}
              </ol>
            </div>

            <div>
              <Reveal>
                <p className="mb-5 text-xs font-semibold tracking-wide text-gold uppercase">Checkpoint</p>
              </Reveal>
              <ol>
                {route.checkpoints.map((cp, i) => (
                  <Reveal as="li" key={`${cp.label}-${cp.km}`} delay={i * 0.06} className="relative flex gap-4 pb-5 last:pb-0">
                    {i < lastCheckpoint && <span aria-hidden className="absolute top-5 bottom-0 left-[9px] w-0.5 bg-white/35" />}
                    <Node edge={i === 0 || i === lastCheckpoint} />
                    <div className="-mt-0.5">
                      <p className="font-display text-base tracking-wide uppercase sm:text-lg">
                        <span className="text-brand-yellow">{cp.label}</span>
                        {/* "1 KM" dan seterusnya sudah memuat jaraknya sendiri */}
                        {!/km/i.test(cp.label) && <span className="text-white"> km {cp.km.toLocaleString("id-ID")}</span>}
                      </p>
                      <p className="text-sm text-white/75">{cp.place}</p>
                    </div>
                  </Reveal>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
