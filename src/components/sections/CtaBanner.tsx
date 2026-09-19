"use client";

import Reveal from "@/components/Reveal";
import { eventData } from "@/lib/event-data";

export default function CtaBanner() {
  return (
    <section className="bg-cream px-6 pb-24">
      <Reveal
        className="mx-auto max-w-6xl text-center"
        variants={{
          hidden: { opacity: 0, scale: 0.97, filter: "blur(6px)" },
          show: {
            opacity: 1,
            scale: 1,
            filter: "blur(0px)",
            transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
          },
        }}
      >
        <div
          className="rounded-[20px] p-10 sm:p-16"
          style={{
            background:
              "radial-gradient(ellipse at center, #F4E71D 0%, #C9DB27 45%, #64A322 100%)",
          }}
        >
          <h2 className="font-display text-3xl text-green-deep uppercase sm:text-5xl">
            Siap lari bareng KUWERA?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-green-deep">
            Kuota {eventData.quotaTotal.toLocaleString("id-ID")} peserta. Harga early bird Rp
            {eventData.earlyBirdPrice.toLocaleString("id-ID")} berlaku sampai {eventData.earlyBirdUntil}.
          </p>
          <a
            href="/daftar"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-green-deep px-8 py-3 text-sm font-semibold text-white transition-transform hover:translate-x-0.5"
          >
            Daftar sekarang &rarr;
          </a>
        </div>
      </Reveal>
    </section>
  );
}
