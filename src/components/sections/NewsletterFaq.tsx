"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Reveal from "@/components/Reveal";
import { faqs } from "@/lib/event-data";
import ArrowCircle from "@/components/ArrowCircle";

function FaqItem({ q, a, index }: { q: string; a: string; index: number }) {
  const [open, setOpen] = useState(false);

  return (
    <Reveal
      delay={index * 0.05}
      variants={{
        hidden: { opacity: 0, x: -20 },
        show: { opacity: 1, x: 0, transition: { duration: 0.4 } },
      }}
      className="border-b border-white/40 py-4"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={`faq-${index}`}
        className="flex w-full items-center justify-between gap-4 text-left"
      >
        <span className="text-white">{q}</span>
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          className={`h-4 w-4 shrink-0 text-brand-yellow transition-transform ${open ? "rotate-90" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 10h12M11 5l5 5-5 5" />
        </svg>
      </button>
      {/* Jawaban selalu ada di HTML (terbaca mesin pencari), hanya dilipat saat tertutup. */}
      <motion.div
        id={`faq-${index}`}
        initial={false}
        animate={open ? { height: "auto", opacity: 1 } : { height: 0, opacity: 0 }}
        transition={{ duration: 0.3 }}
        aria-hidden={!open}
        inert={!open}
        className="overflow-hidden"
      >
        <p className="pt-3 text-sm text-white/80">{a}</p>
      </motion.div>
    </Reveal>
  );
}

export default function NewsletterFaq() {
  return (
    <section className="relative px-6 py-20">
      <div className="relative mx-auto grid max-w-6xl gap-16 lg:grid-cols-[1.1fr_1fr] lg:gap-24">
        <Reveal>
          <h2 className="font-display text-4xl leading-tight text-white uppercase sm:text-5xl">
            Jangan sampai
            <br />
            <span className="text-brand-yellow underline decoration-brand-yellow decoration-4 underline-offset-8">ketinggalan!</span>
          </h2>
          <p className="mt-5 max-w-md text-white/80">
            Jadwal race pack dan kabar terbaru soal acara kami kirim ke email kamu.
          </p>
          <form onSubmit={(e) => e.preventDefault()} className="mt-7 flex max-w-lg flex-col gap-3 sm:flex-row">
            <label className="flex flex-1 items-center gap-3 rounded-full border border-glass-border bg-card px-5">
              <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-white/75" fill="none" stroke="currentColor" strokeWidth="1.6">
                <rect x="2.5" y="4.5" width="15" height="11" rx="2" />
                <path d="M3 5.5l7 5 7-5" />
              </svg>
              <input
                type="email"
                required
                placeholder="Alamat email"
                aria-label="Alamat email"
                className="w-full bg-transparent py-3 text-sm text-white placeholder:text-white/60 focus:outline-none"
              />
            </label>
            <button
              type="submit"
              className="flex items-center justify-between gap-6 rounded-full bg-brand-yellow py-1.5 pr-1.5 pl-6 text-sm font-semibold text-green-deep"
            >
              Langganan
              <ArrowCircle />
            </button>
          </form>
        </Reveal>

        <div id="faq" className="scroll-mt-24">
          <Reveal>
            <h2 className="font-display text-3xl text-white uppercase sm:text-4xl">
              Pertanyaan{" "}
              <span className="text-brand-yellow underline decoration-brand-yellow decoration-4 underline-offset-8">umum</span>
            </h2>
          </Reveal>
          <div className="mt-4">
            {faqs.map((faq, i) => (
              <FaqItem key={faq.q} q={faq.q} a={faq.a} index={i} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
