"use client";

import Reveal from "@/components/Reveal";
import { sponsors } from "@/lib/event-data";

export default function Sponsors() {
  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-6xl">
        <Reveal className="text-center">
          <h2 className="font-display text-3xl text-white uppercase sm:text-4xl">
            Sponsor &amp;{" "}
            <span className="text-brand-yellow underline decoration-brand-yellow decoration-4 underline-offset-8">Partner</span>
          </h2>
        </Reveal>

        <div className="mt-10 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-6">
          {sponsors.map((sponsor, i) => (
            <Reveal
              key={sponsor.name}
              delay={i * 0.05}
              variants={{
                hidden: { opacity: 0, y: 12 },
                show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
              }}
              className="flex h-20 items-center justify-center rounded-2xl bg-cream text-sm font-semibold text-green-deep"
            >
              {sponsor.name}
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
