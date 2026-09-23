"use client";

import { usePathname } from "next/navigation";
import { WA_ICON_PATH, waLink, waText } from "@/lib/whatsapp";

// Tombol WhatsApp melayang di kanan bawah semua halaman. Isi pesan mengikuti halaman yang sedang
// dibuka, termasuk nomor order atau kode tiket kalau ada di alamat.
function messageFor(path: string) {
  const bayar = path.match(/^\/bayar\/([^/]+)/);
  if (bayar) return waText.bayar(decodeURIComponent(bayar[1]));
  const tiket = path.match(/^\/tiket\/([^/]+)/);
  if (tiket) return waText.tiket(decodeURIComponent(tiket[1]));
  if (path.startsWith("/daftar")) return waText.daftar;
  return waText.umum;
}

export default function WhatsAppButton() {
  const path = usePathname() ?? "/";
  if (path.startsWith("/admin")) return null; // halaman admin tidak butuh tombol chat peserta
  return (
    <a
      href={waLink(messageFor(path))}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat panitia lewat WhatsApp"
      className="fixed right-4 bottom-4 z-40 flex items-center gap-2 rounded-full bg-[#25D366] p-3.5 text-white shadow-lg shadow-black/30 ring-1 ring-white/30 transition-transform hover:scale-105 sm:right-6 sm:bottom-6 sm:px-5"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0" fill="currentColor" aria-hidden>
        <path d={WA_ICON_PATH} />
      </svg>
      <span className="hidden text-sm font-semibold text-green-deep sm:inline">Chat panitia</span>
    </a>
  );
}
