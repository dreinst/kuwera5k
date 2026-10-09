"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Pita pembatalan di bawah semua halaman publik selama refund aktif (Setting "refund"). Tidak tampil di halaman
// admin dan di halaman refund sendiri. Tombol WhatsApp melayang ikut naik supaya tidak tertutup (lihat WhatsAppButton).
export const pitaTampil = (path: string) => !path.startsWith("/kuweraadmin") && !path.startsWith("/refund");

export default function Pita() {
  const path = usePathname() ?? "/";
  if (!pitaTampil(path)) return null;
  return (
    <aside aria-label="Pengumuman pembatalan" className="fixed inset-x-0 bottom-0 z-40 bg-brand-yellow px-4 pt-3 text-green-deep shadow-[0_-4px_20px_rgba(0,0,0,0.35)]" style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-4 gap-y-2 text-center text-sm">
        <p className="font-semibold">KUWERA Fun Run 5K dibatalkan. Uang pendaftaran kami kembalikan 100%.</p>
        <Link href="/refund" className="rounded-full bg-green-deep px-4 py-1.5 font-semibold text-brand-yellow">Ajukan refund</Link>
      </div>
    </aside>
  );
}
