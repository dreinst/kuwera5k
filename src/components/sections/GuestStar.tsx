"use client";

import Image from "next/image";
import { motion } from "framer-motion";
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
            Ada senam pemanasan sebelum start, lalu live music dan undian doorprize setelah finish.
          </p>
        </Reveal>

        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {guestStars.map((guest, i) => (
            // Observer di wrapper tanpa clip; kalau clip-path dipasang di elemen yang
            // diamati, IntersectionObserver tidak pernah memicu karena area terlihatnya nol.
            <motion.div
              key={guest.name}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.2 }}
              className="aspect-3/4"
            >
              <motion.div
                variants={{
                  hidden: { clipPath: "inset(0% 100% 0% 0%)" },
                  show: {
                    clipPath: "inset(0% 0% 0% 0%)",
                    transition: { duration: 0.7, ease: [0.33, 1, 0.68, 1], delay: i * 0.12 },
                  },
                }}
                className="relative h-full overflow-hidden rounded-[20px] border border-glass-border bg-glass"
              >
                <Image
                  src={guest.image}
                  alt={guest.name}
                  fill
                  sizes="(min-width: 640px) 25vw, 50vw"
                  className="object-cover"
                />
                <motion.div
                  variants={{
                    hidden: { y: 20, opacity: 0 },
                    show: { y: 0, opacity: 1, transition: { duration: 0.5, delay: i * 0.12 + 0.3 } },
                  }}
                  className="relative flex h-full flex-col items-center justify-end bg-gradient-to-t from-green-deep via-green-deep/40 to-transparent p-4 text-center"
                >
                  <p className="font-semibold text-brand-yellow">{guest.name}</p>
                  <p className="text-xs text-white/75">{guest.role}</p>
                </motion.div>
              </motion.div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
