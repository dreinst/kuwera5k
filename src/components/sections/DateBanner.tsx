"use client";

import Image from "next/image";
import Reveal from "@/components/Reveal";
import { eventData } from "@/lib/event-data";

// Pita tanggal selebar layar seperti konsep: foto di kiri memudar ke kuning, tanggal dan lokasi rata kanan.
export default function DateBanner() {
  return (
    <section id="info" className="scroll-mt-16 overflow-x-clip py-20">
      <Reveal
        variants={{
          hidden: { opacity: 0, x: 40 },
          show: { opacity: 1, x: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
        }}
      >
        <div className="relative overflow-hidden">
          {/* Foto di kiri pita (Tugu berada di 61% lebar foto), sisanya kuning polos. */}
          <div className="absolute inset-y-0 left-0 w-full sm:w-[45%]">
            <Image
              src="/images/tugu-malang.jpg"
              alt="Tugu Malang di depan Balai Kota"
              fill
              sizes="(min-width: 640px) 45vw, 100vw"
              className="object-cover object-[50%_18%]"
            />
          </div>
          {/* Di HP teks memenuhi lebar pita, jadi kuningnya dibuat pekat sampai ujung kiri (kontras >= 4,5:1). */}
          <div
            aria-hidden
            className="absolute inset-0 sm:hidden"
            style={{ background: "linear-gradient(90deg, rgba(244,231,29,0.82) 0%, rgba(244,231,29,0.96) 45%)" }}
          />
          <div
            aria-hidden
            className="absolute inset-0 hidden sm:block"
            style={{ background: "linear-gradient(90deg, rgba(244,231,29,0) 0%, rgba(244,231,29,0) 20%, rgba(244,231,29,0.7) 32%, #F4E71D 43%)" }}
          />
          <div className="relative mx-auto flex max-w-6xl flex-col items-end px-6 py-12 text-right">
            <span className="font-display rounded-xl bg-green-deep px-5 py-2 text-2xl text-brand-yellow uppercase sm:text-3xl">
              {eventData.dateLabel}
            </span>
            <div className="mt-4 flex flex-wrap items-center justify-end gap-x-4 gap-y-3">
              <span className="font-display rounded-xl bg-green-deep px-5 py-2 text-2xl text-brand-yellow sm:text-3xl">
                {eventData.timeLabel}
              </span>
              <h2 className="font-display text-2xl text-green-deep uppercase sm:text-3xl">
                Titik kumpul{" "}
                <span className="underline decoration-green-deep decoration-2 underline-offset-4">{eventData.startPoint}</span>
              </h2>
            </div>
            <p className="mt-5 max-w-md text-sm font-medium text-green-deep">
              Pendaftaran ditutup {eventData.registrationCloseLabel}. Datang lebih awal untuk pemanasan bersama.
            </p>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
