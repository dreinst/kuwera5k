"use client";

import Image from "next/image";
import Reveal from "@/components/Reveal";
import ArrowCircle from "@/components/ArrowCircle";
import { eventData } from "@/lib/event-data";

// Kartu gelap dengan foto pelari di kanan, seperti banner ajakan daftar di konsep.
export default function CtaBanner() {
  return (
    <section className="px-6 py-20">
      <Reveal
        className="mx-auto max-w-6xl"
        variants={{
          hidden: { opacity: 0, scale: 0.97, filter: "blur(6px)" },
          show: { opacity: 1, scale: 1, filter: "blur(0px)", transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
        }}
      >
        <div className="relative overflow-hidden rounded-[20px] border border-glass-border bg-card">
          <div
            aria-hidden
            className="absolute inset-y-0 right-0 hidden w-3/5 sm:block"
            style={{ maskImage: "linear-gradient(to right, transparent, #000 50%)", WebkitMaskImage: "linear-gradient(to right, transparent, #000 50%)" }}
          >
            <Image src="/images/hero-runners.jpg" alt="" fill sizes="(min-width: 1152px) 700px, 60vw" className="object-cover object-[35%_75%] opacity-60" />
          </div>
          <div className="relative max-w-xl p-8 sm:p-12">
            <h2 className="font-display text-3xl leading-snug text-white uppercase sm:text-4xl">
              <span className="text-brand-yellow underline decoration-brand-yellow decoration-2 underline-offset-4">Siap lari</span> bareng{" "}
              <span className="text-brand-yellow underline decoration-brand-yellow decoration-2 underline-offset-4">KUWERA</span>?
            </h2>
            <p className="mt-4 text-white/85">
              Kuota {eventData.quotaTotal.toLocaleString("id-ID")} peserta, biaya pendaftaran Rp
              {eventData.price.toLocaleString("id-ID")} per orang.
            </p>
            <a
              href="/daftar"
              className="mt-7 inline-flex items-center gap-6 rounded-full bg-brand-yellow py-1.5 pr-1.5 pl-6 font-semibold text-green-deep transition-transform hover:translate-x-0.5"
            >
              Daftar sekarang
              <ArrowCircle />
            </a>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
