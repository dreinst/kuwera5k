"use client";

import Reveal from "@/components/Reveal";
import { eventData } from "@/lib/event-data";

export default function DateBanner() {
  return (
    <section id="info" className="px-6 py-16">
      <Reveal
        className="mx-auto max-w-6xl overflow-hidden rounded-[20px] p-10 sm:p-16"
        variants={{
          hidden: { opacity: 0, x: 40 },
          show: { opacity: 1, x: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
        }}
      >
        <div
          className="relative overflow-hidden rounded-[20px] p-10 sm:p-16"
          style={{
            background: "linear-gradient(135deg, #1C6B06 0%, #64A322 55%, #F4E71D 100%)",
          }}
        >
          <span className="inline-block rounded-full bg-green-deep px-4 py-1.5 text-xs font-semibold tracking-wide text-white uppercase">
            {eventData.dateLabel} &middot; {eventData.timeLabel}
          </span>
          <h2 className="font-display mt-4 max-w-lg text-4xl text-green-deep uppercase sm:text-5xl">
            Titik kumpul {eventData.startPoint}
          </h2>
          <p className="mt-3 max-w-md text-green-deep/80">
            Registrasi dibuka {eventData.registrationOpen}. Datang lebih awal untuk pemanasan bersama.
          </p>
        </div>
      </Reveal>
    </section>
  );
}
