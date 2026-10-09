"use client";

import Link from "next/link";
import { trackPixel } from "@/lib/meta-pixel";
import { WA_ICON_PATH, waLink, waText } from "@/lib/whatsapp";

const base = "flex w-full items-center justify-center gap-2 rounded-full px-6 py-4 text-base font-semibold transition-transform hover:scale-[1.02]";

// Tombol di halaman /link. Klik WhatsApp dikirim ke Meta Pixel sebagai event Contact (tanpa data pribadi).
export default function BioLinks() {
  return (
    <div className="mt-8 flex w-full flex-col gap-3">
      <Link href="/daftar" className={`${base} bg-yellow-lime text-green-deep`}>Daftar sekarang</Link>
      <a
        href={waLink(waText.bio)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackPixel("Contact", { content_name: "wa-link-bio" })}
        className={`${base} bg-[#25D366] text-green-deep`}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="currentColor" aria-hidden>
          <path d={WA_ICON_PATH} />
        </svg>
        Chat panitia lewat WhatsApp
      </a>
      <Link href="/" className={`${base} border border-white/40 text-white`}>Lihat info acara dan rute</Link>
      <a href="https://www.instagram.com/kuwerafunrun/" target="_blank" rel="noopener noreferrer" className={`${base} border border-white/40 text-white`}>
        Instagram @kuwerafunrun
      </a>
    </div>
  );
}
