"use client";

import { useEffect, useRef, useState } from "react";
import { waLink } from "@/lib/whatsapp";

// Cloudflare Turnstile ("bukan robot") di langkah pembayaran. Tanpa NEXT_PUBLIC_TURNSTILE_SITE_KEY tidak tampil.
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
const SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global {
  interface Window { turnstile?: TurnstileApi }
}

function loadScript() {
  return new Promise<void>((resolve, reject) => {
    if (window.turnstile) return resolve();
    let el = document.querySelector<HTMLScriptElement>(`script[src="${SRC}"]`);
    if (!el) {
      el = document.createElement("script");
      el.src = SRC; el.async = true;
      document.head.appendChild(el);
    }
    const tag = el;
    tag.addEventListener("load", () => resolve());
    // Skrip yang gagal dimuat dibuang supaya "Coba lagi" memuatnya dari awal.
    tag.addEventListener("error", () => { tag.remove(); reject(new Error("Turnstile gagal dimuat")); });
  });
}

// onToken harus stabil (misalnya setter dari useState). resetSignal dinaikkan setelah submit ditolak,
// karena token Turnstile hanya berlaku sekali.
export default function Turnstile({ onToken, resetSignal }: { onToken: (token: string) => void; resetSignal: number }) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  // Tombol bayar baru aktif setelah ada token. Kalau kotak verifikasi tidak muncul (browser dalam aplikasi, pemblokir
  // iklan, koneksi lambat), pendaftar perlu tahu sebabnya dan punya jalan keluar, bukan hanya tombol yang redup.
  const [selesai, setSelesai] = useState(false);
  const [macet, setMacet] = useState(false);
  const [percobaan, setPercobaan] = useState(0);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    let cancelled = false;
    const lapor = (token: string) => { setSelesai(!!token); if (token) setMacet(false); onToken(token); };
    const tunggu = setTimeout(() => setMacet(true), 12000);
    loadScript()
      .then(() => {
        if (cancelled || !box.current || !window.turnstile) return;
        widget.current = window.turnstile.render(box.current, {
          sitekey: TURNSTILE_SITE_KEY,
          action: "daftar",
          theme: "dark",
          language: "id",
          callback: (token: string) => lapor(token),
          "expired-callback": () => lapor(""),
          "error-callback": () => { lapor(""); setMacet(true); },
        });
      })
      .catch(() => { lapor(""); setMacet(true); });
    return () => {
      cancelled = true;
      clearTimeout(tunggu);
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = null;
    };
  }, [onToken, percobaan]);

  useEffect(() => {
    if (resetSignal && widget.current) {
      window.turnstile?.reset(widget.current);
      setSelesai(false);
      onToken("");
    }
  }, [resetSignal, onToken]);

  if (!TURNSTILE_SITE_KEY) return null;
  return (
    <div className="mt-5">
      <div ref={box} className="min-h-[65px]" />
      {!selesai && (macet ? (
        <div className="mt-2 rounded-xl border border-brand-yellow/40 bg-brand-yellow/10 px-4 py-3 text-xs text-brand-yellow">
          <p>Verifikasi bukan robot belum muncul, jadi tombol pembayaran belum bisa ditekan. Biasanya karena halaman dibuka dari dalam aplikasi Instagram atau WhatsApp, koneksi sedang lambat, atau ada pemblokir iklan. Coba buka halaman ini langsung di Chrome atau Safari, ya.</p>
          <p className="mt-2">
            <button type="button" onClick={() => { setMacet(false); setPercobaan((n) => n + 1); }} className="font-semibold underline">Coba lagi</button>
            {" atau "}
            <a href={waLink("Halo kak, verifikasi bukan robot di halaman pendaftaran KUWERA 5K tidak muncul. Mohon dibantu daftarnya, ya.")} target="_blank" rel="noopener noreferrer" className="font-semibold underline">minta bantuan lewat WhatsApp</a>
          </p>
        </div>
      ) : (
        <p className="mt-2 text-xs text-white/75">Tombol pembayaran aktif setelah verifikasi bukan robot di atas selesai.</p>
      ))}
    </div>
  );
}
