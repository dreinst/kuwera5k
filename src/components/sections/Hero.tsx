"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { eventData, remainingQuota } from "@/lib/event-data";
import Counter from "@/components/Counter";
import RouteMap from "@/components/RouteMap";

const HEADLINE_WORDS = ["KUWERA", "5K"];

const wordVariants = {
  hidden: { y: 30, opacity: 0, clipPath: "inset(100% 0 0 0)" },
  show: {
    y: 0,
    opacity: 1,
    clipPath: "inset(0% 0 0 0)",
    transition: { duration: 0.7, ease: [0.33, 1, 0.68, 1] as const },
  },
};

const cardVariants = {
  hidden: { opacity: 0, scale: 0.95, filter: "blur(8px)" },
  show: {
    opacity: 1,
    scale: 1,
    filter: "blur(0px)",
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
  },
};

export default function Hero() {
  return (
    <section
      id="hero"
      className="relative flex min-h-screen flex-col justify-center overflow-hidden bg-green-deep px-6 pt-32 pb-16"
    >
      <Image
        src="/images/hero-runners.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover opacity-45"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(11,74,44,0.4) 0%, rgba(11,74,44,0.8) 60%, #0B4A2C 100%), radial-gradient(circle at 20% 20%, rgba(100,163,34,0.35), transparent 55%)",
        }}
      />

      <div className="relative mx-auto w-full max-w-6xl">
        <motion.span
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6 inline-block w-fit rounded-full border border-glass-border bg-glass px-4 py-1.5 text-xs font-semibold tracking-wide text-white uppercase backdrop-blur-md"
        >
          Ayo Lari Bareng
        </motion.span>

        <h1 className="font-display flex flex-wrap gap-x-5 text-6xl leading-none text-white uppercase sm:text-8xl">
          {HEADLINE_WORDS.map((word, i) => (
            <motion.span
              key={word}
              variants={wordVariants}
              initial="hidden"
              animate="show"
              transition={{ delay: i * 0.08 }}
              className={word === "5K" ? "text-brand-yellow" : undefined}
            >
              {word}
            </motion.span>
          ))}
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-6 max-w-lg text-white/70"
        >
          Fun run 5K di {eventData.city}. Daftar dan bayar online, e-ticket langsung
          masuk ke email dan WhatsApp kamu.
        </motion.p>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Save the date */}
          <motion.div
            variants={cardVariants}
            initial="hidden"
            animate="show"
            transition={{ delay: 0.3 }}
            className="rounded-[20px] border border-glass-border bg-glass p-6 backdrop-blur-md"
          >
            <p className="text-xs tracking-wide text-white/60 uppercase">Save the date</p>
            <p className="mt-2 text-2xl font-semibold text-white">{eventData.dateLabel}</p>
            <p className="mt-1 text-sm text-gold">{eventData.timeLabel} &middot; {eventData.startPoint}</p>
          </motion.div>

          {/* Counter + register */}
          <motion.div
            variants={cardVariants}
            initial="hidden"
            animate="show"
            transition={{ delay: 0.4 }}
            className="flex flex-col justify-between rounded-[20px] border border-glass-border bg-glass p-6 backdrop-blur-md"
          >
            <div>
              <p className="text-xs tracking-wide text-white/60 uppercase">Pendaftar</p>
              <p className="font-display mt-1 text-4xl text-brand-yellow">
                <Counter to={eventData.paidCount} />
              </p>
              <p className="text-sm text-white/60">Sisa kuota {remainingQuota}</p>
            </div>
            <a
              href="/daftar"
              className="mt-4 inline-flex w-fit items-center gap-2 rounded-full bg-brand-yellow px-5 py-2 text-sm font-semibold text-green-deep transition-transform hover:translate-x-0.5"
            >
              Daftar sekarang &rarr;
            </a>
          </motion.div>

          {/* Route map placeholder */}
          <motion.div
            variants={cardVariants}
            initial="hidden"
            animate="show"
            transition={{ delay: 0.5 }}
            className="rounded-[20px] border border-glass-border bg-glass p-6 backdrop-blur-md"
          >
            <p className="text-xs tracking-wide text-white/70 uppercase">5K Route</p>
            <div className="mt-1 h-28">
              <RouteMap />
            </div>
          </motion.div>

          {/* Early bird promo */}
          <motion.div
            variants={cardVariants}
            initial="hidden"
            animate="show"
            transition={{ delay: 0.6 }}
            className="rounded-[20px] p-6 sm:col-span-2"
            style={{
              background:
                "linear-gradient(135deg, #F4E71D 0%, #B9D42A 45%, #64A322 100%)",
            }}
          >
            <p className="text-xs font-semibold tracking-wide text-green-deep uppercase">
              Early bird
            </p>
            <p className="mt-2 text-2xl font-semibold text-green-deep">
              Rp{eventData.earlyBirdPrice.toLocaleString("id-ID")}{" "}
              <span className="text-base font-normal">sampai {eventData.earlyBirdUntil}</span>
            </p>
          </motion.div>

          {/* Medal */}
          <motion.div
            variants={cardVariants}
            initial="hidden"
            animate="show"
            transition={{ delay: 0.7 }}
            className="relative flex flex-col items-center justify-center overflow-hidden rounded-[20px] border border-glass-border bg-glass p-6 text-center"
          >
            <Image
              src="/images/medals.jpg"
              alt=""
              fill
              sizes="(min-width: 640px) 33vw, 100vw"
              className="object-cover opacity-35"
            />
            <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-brand-yellow font-display text-green-deep">
              5K
            </div>
            <p className="relative mt-3 text-xs text-white/80">Medali finisher untuk semua peserta</p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
