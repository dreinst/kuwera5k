"use client";

import Reveal from "@/components/Reveal";
import { sponsors } from "@/lib/event-data";

export default function Sponsors() {
  return (
    <section className="bg-cream px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <p className="text-center text-xs font-semibold tracking-wide text-green-deep/75 uppercase">
            Sponsor &amp; Partner
          </p>
        </Reveal>

        <div className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
          {sponsors.map((sponsor, i) => (
            <Reveal
              key={sponsor.name}
              delay={i * 0.05}
              variants={{
                hidden: { opacity: 0, y: 12 },
                show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
              }}
              className="flex h-16 items-center justify-center rounded-lg border border-green-deep/20 bg-white text-xs font-medium text-green-deep"
            >
              {sponsor.name}
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
