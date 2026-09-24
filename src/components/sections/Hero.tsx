"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { eventData, route } from "@/lib/event-data";
import Counter from "@/components/Counter";
import JerseyTexture from "@/components/JerseyTexture";
import ArrowCircle from "@/components/ArrowCircle";
import Countdown from "@/components/Countdown";

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

const card = (delay: number) => ({ variants: cardVariants, initial: "hidden", animate: "show", transition: { delay } });

// "Sabtu, 24 Oktober 2026" dipecah supaya tanggal bisa ditulis besar seperti kartu Save the date di konsep.
const [weekday, dateRest] = eventData.dateLabel.split(", ");
const [day, month, year] = dateRest.split(" ");

// Tambah ke kalender (Google Calendar): mulai jam start, selesai setelah batas waktu lari.
const calendarUrl = (() => {
  const start = new Date(eventData.startIso);
  const end = new Date(start.getTime() + route.cutOffMinutes * 60_000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]|\.\d{3}/g, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: eventData.name,
    dates: `${fmt(start)}/${fmt(end)}`,
    location: `${eventData.venue.name}, ${eventData.venue.street}, ${eventData.venue.locality}`,
    details: `Fun run ${route.distanceKm}K, start dan finish di ${eventData.startPoint}.`,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
})();

const HEADLINE = [
  { word: "KUWERA", outline: true },
  { word: "FUN RUN", outline: false },
  { word: "5K", outline: true },
];

export default function Hero({ stats }: { stats: { paid: number; remaining: number } | null }) {
  return (
    <section id="hero" className="relative overflow-hidden px-6 pt-32 pb-20">
      {/* Latar hero memudar di bagian bawah ke tekstur halaman, jadi tidak ada garis batas saat digulir. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-green-deep"
        style={{ maskImage: "linear-gradient(to bottom, #000 75%, transparent)", WebkitMaskImage: "linear-gradient(to bottom, #000 75%, transparent)" }}
      >
        <Image src="/images/hero-runners.jpg" alt="" fill priority sizes="100vw" className="object-cover opacity-40" />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(180deg, rgba(11,74,44,0.55) 0%, rgba(11,74,44,0.8) 55%, #0B4A2C 90%)" }}
        />
        <JerseyTexture dots="right" glow={false} dotsOpacity={0.32} />
      </div>

      <div className="relative mx-auto w-full max-w-6xl">
        <div className="flex flex-col items-center text-center">
          {/* Judul dan hitung mundur sebaris di layar lebar; di HP hitung mundur turun ke bawah judul. */}
          <div className="flex flex-col items-center gap-8 lg:flex-row lg:gap-8 xl:gap-10">
            <h1 className="font-display flex flex-wrap justify-center gap-x-4 text-5xl leading-none uppercase sm:gap-x-6 sm:text-7xl lg:shrink-0 xl:text-8xl">
              {HEADLINE.map((w, i) => (
                <motion.span
                  key={w.word}
                  variants={wordVariants}
                  initial="hidden"
                  animate="show"
                  transition={{ delay: i * 0.08 }}
                  className={w.outline ? "text-outline" : "text-brand-yellow"}
                >
                  {i > 0 && " "}
                  {w.word}
                </motion.span>
              ))}
            </h1>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="lg:border-l lg:border-glass-border lg:pl-8 xl:pl-10"
            >
              <Countdown to={eventData.startIso} label="Menuju hari lomba" />
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-8 max-w-xl"
          >
            <p className="text-lg font-semibold text-balance text-white sm:text-xl">Kejar garis finish, bawa pulang medalinya!</p>
            <p className="mt-2 text-balance text-white/80">Diselenggarakan oleh {eventData.host}.</p>
          </motion.div>
        </div>

        {/* Tiga kolom bertingkat seperti konsep: kolom tengah paling tinggi. */}
        <div className="mt-14 grid grid-cols-1 items-start gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex flex-col gap-5 lg:pt-20">
            <motion.div {...card(0.3)} className="rounded-[20px] border border-glass-border bg-glass p-6 backdrop-blur-md">
              <p className="text-sm font-semibold tracking-wide text-white uppercase">Save the date!</p>
              <p className="font-display mt-2 text-[2.6rem] leading-none uppercase">
                <span className="text-brand-yellow">{day}</span> <span className="text-white">{month}</span>{" "}
                <span className="text-brand-yellow">{year}</span>
              </p>
              <p className="font-display mt-3 text-xl text-white uppercase">
                {weekday}, pukul <span className="underline decoration-brand-yellow decoration-2 underline-offset-4">{eventData.timeLabel}</span>
              </p>
              <p className="mt-1 text-sm text-gold">{eventData.startPoint}, Malang</p>
              <a
                href={calendarUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 flex items-center justify-between rounded-full bg-white py-1.5 pr-1.5 pl-5 text-sm font-semibold text-green-deep transition-transform hover:translate-x-0.5"
              >
                Tambah ke kalender
                <ArrowCircle />
              </a>
            </motion.div>

            <motion.div
              {...card(0.5)}
              className="rounded-[20px] p-6"
              style={{ background: "linear-gradient(135deg, #F4E71D 0%, #C6DA2A 50%, #8DBF2A 100%)" }}
            >
              <p className="text-xs font-semibold tracking-wide text-green-deep uppercase">Biaya pendaftaran</p>
              <p className="font-display mt-1 text-5xl text-green-deep">Rp{eventData.price.toLocaleString("id-ID")}</p>
              <p className="mt-2 text-sm font-medium text-green-deep">
                Sudah termasuk jersey, BIB, dan medali finisher. Belum termasuk biaya layanan pembayaran.
              </p>
            </motion.div>
          </div>

          <div className="flex flex-col gap-5">
            <motion.div
              {...card(0.4)}
              className="rounded-[20px] border border-glass-border bg-glass p-6 backdrop-blur-md"
              style={{ backgroundImage: "radial-gradient(circle at 100% 0%, rgba(244,231,29,0.28), transparent 60%)" }}
            >
              {stats ? (
                <>
                  <p className="flex items-baseline gap-3">
                    <span className="font-display text-6xl leading-none text-brand-yellow"><Counter to={stats.paid} /></span>
                    <span className="font-display text-2xl text-white uppercase">Peserta</span>
                  </p>
                  <p className="mt-2 text-lg text-white/85">sudah terdaftar</p>
                </>
              ) : (
                <p className="font-display text-4xl leading-tight text-brand-yellow uppercase">
                  Kuota {eventData.quotaTotal.toLocaleString("id-ID")} peserta
                </p>
              )}
              <a
                href="/daftar"
                className="mt-5 flex items-center justify-between rounded-full bg-brand-yellow py-1.5 pr-1.5 pl-6 font-semibold text-green-deep transition-transform hover:translate-x-0.5"
              >
                Daftar sekarang
                <ArrowCircle />
              </a>
              {stats && <p className="mt-3 text-center text-sm text-white/75">Sisa kuota {stats.remaining.toLocaleString("id-ID")}</p>}
            </motion.div>

            <motion.div
              {...card(0.6)}
              className="relative min-h-[300px] overflow-hidden rounded-[20px] p-6 text-green-deep"
              style={{ background: "linear-gradient(160deg, #F4E71D 0%, #D6E02A 100%)" }}
            >
              <div className="absolute inset-y-4 right-3 w-[44%]">
                <Image
                  src="/images/medali.webp"
                  alt="Medali finisher KUWERA Fun Run 5K dengan lanyard hijau, tampak depan (pelari) dan belakang (lambang Keuangan Angkatan Darat)"
                  fill
                  sizes="180px"
                  className="object-contain drop-shadow-[0_10px_18px_rgba(11,74,44,0.45)]"
                />
              </div>
              <div className="relative flex h-24 w-24 flex-col items-center justify-center rounded-full bg-green-deep text-brand-yellow ring-4 ring-green-deep/25 ring-offset-2 ring-offset-transparent">
                <span className="font-display text-4xl leading-none">5K</span>
                <span className="mt-0.5 text-[10px] font-semibold tracking-widest uppercase">Finisher</span>
              </div>
              <p className="relative mt-8 max-w-[52%] text-2xl leading-snug">
                <span className="font-display uppercase">Medali</span> finisher menunggu <span className="font-display uppercase">kamu!</span>
              </p>
            </motion.div>
          </div>

          <motion.div
            {...card(0.7)}
            className="relative overflow-hidden rounded-[20px] border border-glass-border p-5 backdrop-blur-md sm:col-span-2 lg:col-span-1 lg:mt-24"
            style={{ background: "linear-gradient(165deg, rgba(244,231,29,0.30) 0%, rgba(255,255,255,0.08) 45%, rgba(255,255,255,0.06) 100%)" }}
          >
            <div className="relative aspect-[1400/829] w-full">
              <Image
                src="/images/jersey.webp"
                alt="Jersey KUWERA Fun Run 5K tampak depan dan belakang, hijau dengan pundak kuning"
                fill
                sizes="(min-width: 1024px) 340px, (min-width: 640px) 80vw, 90vw"
                className="object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.45)]"
              />
            </div>
            <p className="font-display mt-4 text-6xl leading-[0.9] uppercase">
              <span className="block text-brand-yellow">Jersey</span>
              <span className="block text-white">Peserta</span>
            </p>
            <p className="mt-3 text-sm text-white/80">Tampak depan dan belakang. Ukurannya dipilih saat mendaftar.</p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
