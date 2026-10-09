import type { Metadata } from "next";
import { pageMeta } from "@/lib/site";
import { eventData } from "@/lib/event-data";
import BioLinks from "@/components/BioLinks";

// Halaman tautan untuk bio Instagram: satu alamat berisi tombol daftar, WhatsApp panitia, dan info acara.
// Dibuat di situs sendiri (bukan Linktree) supaya pengunjung dari bio ikut tercatat Meta Pixel.
export const metadata: Metadata = {
  title: "Tautan",
  description: `Daftar ${eventData.name}, chat panitia lewat WhatsApp, dan lihat info acara dalam satu halaman.`,
  robots: { index: false, follow: true },
  ...pageMeta("/link"),
};

export default function Page() {
  return (
    <main className="relative mx-auto flex w-full max-w-md flex-1 flex-col items-center px-6 py-14 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/kuwera-logo-light.svg" alt="KUWERA Fun Run" width={2400} height={853} className="h-16 w-auto" />
      <h1 className="mt-8 font-display text-3xl text-white uppercase">Yuk, lari bareng di Malang!</h1>
      <p className="mt-3 text-white/80">
        {eventData.dateLabel}, {eventData.timeLabel} di {eventData.startPoint}. Tiket sudah termasuk jersey, BIB, dan medali finisher.
      </p>
      <BioLinks />
      <p className="mt-8 text-sm text-white/70">Pendaftaran dibuka sampai {eventData.registrationCloseLabel}, atau sampai kuota penuh.</p>
    </main>
  );
}
