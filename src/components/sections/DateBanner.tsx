"use client";

import Image from "next/image";
import Reveal from "@/components/Reveal";
import { eventData } from "@/lib/event-data";

export default function DateBanner() {
  return (
    <section id="info" className="overflow-x-clip px-6 py-20">
      <Reveal
        className="mx-auto max-w-6xl"
        variants={{
          hidden: { opacity: 0, x: 40 },
          show: { opacity: 1, x: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
        }}
      >
        <div className="relative overflow-hidden rounded-[20px] p-10 sm:p-16">
          <Image
            src="/images/tugu-malang.jpg"
            alt="Tugu Malang di depan Balai Kota"
            fill
            sizes="(min-width: 1152px) 1152px, 100vw"
            className="object-cover"
          />
          {/* Di HP teks memenuhi lebar kartu, jadi overlay dibuat terang dan pekat sampai ujung kanan (kontras >= 4,5:1). */}
          <div
            aria-hidden
            className="absolute inset-0 sm:hidden"
            style={{ background: "linear-gradient(100deg, rgba(244,231,29,0.95) 0%, rgba(201,219,39,0.95) 50%, rgba(150,198,45,0.95) 100%)" }}
          />
          <div
            aria-hidden
            className="absolute inset-0 hidden sm:block"
            style={{
              background:
                "linear-gradient(100deg, rgba(244,231,29,0.94) 0%, rgba(201,219,39,0.9) 40%, rgba(100,163,34,0.6) 75%, rgba(28,107,6,0.45) 100%)",
            }}
          />
          <span className="relative inline-block rounded-full bg-green-deep px-4 py-1.5 text-xs font-semibold tracking-wide text-white uppercase">
            {eventData.dateLabel} &middot; {eventData.timeLabel}
          </span>
          <h2 className="font-display relative mt-4 max-w-lg text-4xl text-green-deep uppercase sm:text-5xl">
            Titik kumpul {eventData.startPoint}
          </h2>
          <p className="relative mt-3 max-w-md text-green-deep">
            Pendaftaran ditutup {eventData.registrationCloseLabel}. Datang lebih awal untuk pemanasan bersama.
          </p>
        </div>
      </Reveal>
    </section>
  );
}
