"use client";

import Reveal from "@/components/Reveal";
import { guestStars } from "@/lib/event-data";

export default function GuestStar() {
  return (
    <section className="bg-green-deep px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <p className="text-xs font-semibold tracking-wide text-gold uppercase">Rangkaian acara</p>
          <h2 className="font-display mt-2 text-4xl text-white uppercase">
            Guest <span className="text-brand-yellow">Star</span>
          </h2>
          <p className="mt-3 max-w-md text-white/60">
            Senam pemanasan, live music, dan doorprize menanti di garis finish.
          </p>
        </Reveal>

        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {guestStars.map((guest, i) => (
            <Reveal
              key={guest.name}
              delay={i * 0.1}
              variants={{
                hidden: { opacity: 0, clipPath: "inset(0 100% 0 0)" },
                show: {
                  opacity: 1,
                  clipPath: "inset(0 0% 0 0)",
                  transition: { duration: 0.7, ease: [0.33, 1, 0.68, 1] },
                },
              }}
              className="aspect-3/4 overflow-hidden rounded-[20px] border border-glass-border bg-glass backdrop-blur-md"
            >
              <div className="flex h-full flex-col items-center justify-end bg-gradient-to-t from-green-deep/90 to-transparent p-4 text-center">
                <p className="font-semibold text-brand-yellow">{guest.name}</p>
                <p className="text-xs text-white/50">{guest.role}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
