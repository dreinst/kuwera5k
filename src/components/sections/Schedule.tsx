"use client";

import Reveal from "@/components/Reveal";
import ArrowCircle from "@/components/ArrowCircle";
import { eventData, route } from "@/lib/event-data";

// "Sabtu, 17 Oktober 2026 pukul 23.59 WIB" dipecah jadi tanggal dan jam.
const [closeDate, closeTime] = eventData.registrationCloseLabel.split(" pukul ");

const SCHEDULE = [
  {
    title: "Periode pendaftaran",
    date: `Sampai ${closeDate}`,
    note: `Ditutup pukul ${closeTime}, atau lebih awal kalau kuota ${eventData.quotaTotal.toLocaleString("id-ID")} peserta sudah penuh. Setelah itu ukuran jersey dikirim ke vendor untuk dicetak.`,
  },
  {
    title: "Pengambilan race pack",
    date: eventData.racePackDates,
    note: `Jamnya diumumkan menyusul. Tempatnya di ${eventData.racePackPlace}; bawa KTP atau KIA asli dan QR e-ticket.`,
  },
  {
    title: "Hari lomba",
    date: eventData.dateLabel,
    note: `Start pukul ${eventData.timeLabel} di ${eventData.startPoint}, batas waktu lari ${route.cutOffMinutes} menit.`,
  },
];

// Jadwal lomba seperti referensi (tiga kartu lalu tombol daftar), memakai kartu dan judul gaya beranda.
export default function Schedule() {
  return (
    <section id="jadwal" className="scroll-mt-16 px-6 py-20">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-4xl text-white uppercase sm:text-5xl">
            Jadwal{" "}
            <span className="text-brand-yellow underline decoration-brand-yellow decoration-4 underline-offset-8">Lomba</span>
          </h2>
          <p className="mt-5 text-white/80">Catat tanggalnya supaya tidak ketinggalan pendaftaran, race pack, dan hari lomba.</p>
        </Reveal>

        <ol className="mt-12 grid gap-5 md:grid-cols-3">
          {SCHEDULE.map((item, i) => (
            <Reveal
              as="li"
              key={item.title}
              delay={i * 0.1}
              className="flex flex-col rounded-[20px] border border-glass-border bg-card p-6 sm:p-7"
            >
              <span aria-hidden className="font-display text-outline text-5xl leading-none">0{i + 1}</span>
              <h3 className="font-display mt-6 text-2xl text-brand-yellow uppercase">{item.title}</h3>
              <p className="mt-2 text-lg font-semibold text-white">{item.date}</p>
              <p className="mt-3 text-sm text-white/80">{item.note}</p>
            </Reveal>
          ))}
        </ol>

        <Reveal className="mt-10 flex justify-center">
          <a
            href="/daftar"
            className="inline-flex items-center gap-4 rounded-full bg-brand-yellow py-1.5 pr-1.5 pl-6 font-semibold text-green-deep transition-transform hover:translate-x-0.5"
          >
            Daftar sekarang
            <ArrowCircle />
          </a>
        </Reveal>
      </div>
    </section>
  );
}
