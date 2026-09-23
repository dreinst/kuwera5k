"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Reveal from "@/components/Reveal";
import { faqs } from "@/lib/event-data";

function FaqItem({ q, a, index }: { q: string; a: string; index: number }) {
  const [open, setOpen] = useState(false);

  return (
    <Reveal
      delay={index * 0.05}
      variants={{
        hidden: { opacity: 0, x: -20 },
        show: { opacity: 1, x: 0, transition: { duration: 0.4 } },
      }}
      className="border-b border-white/10 py-4"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={`faq-${index}`}
        className="flex w-full items-center justify-between gap-4 text-left"
      >
        <span className="font-medium text-white">{q}</span>
        <span className={`text-brand-yellow transition-transform ${open ? "rotate-45" : ""}`}>+</span>
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
        <p className="pt-3 text-sm text-white/75">{a}</p>
      </motion.div>
    </Reveal>
  );
}

export default function NewsletterFaq() {
  return (
    <section className="relative px-6 py-20">
      <div className="relative mx-auto grid max-w-6xl gap-16 lg:grid-cols-2">
        <Reveal>
          <p className="text-xs font-semibold tracking-wide text-gold uppercase">Newsletter</p>
          <h2 className="font-display mt-2 text-3xl text-white uppercase">
            Jangan sampai <span className="text-brand-yellow">ketinggalan</span>
          </h2>
          <p className="mt-3 max-w-sm text-white/75">
            Jadwal race pack dan kabar terbaru soal acara kami kirim ke email kamu.
          </p>
          <form
            onSubmit={(e) => e.preventDefault()}
            className="mt-6 flex max-w-sm flex-col gap-3 sm:flex-row"
          >
            <input
              type="email"
              required
              placeholder="Email kamu"
              className="flex-1 rounded-full border border-glass-border bg-card px-5 py-3 text-sm text-white placeholder:text-white/60 focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-full bg-brand-yellow px-6 py-3 text-sm font-semibold text-green-deep"
            >
              Langganan
            </button>
          </form>
        </Reveal>

        <div id="faq" className="scroll-mt-24">
          <Reveal>
            <p className="text-xs font-semibold tracking-wide text-gold uppercase">FAQ</p>
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
