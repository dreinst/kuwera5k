"use client";

import { useEffect, useRef } from "react";

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
    el.addEventListener("load", () => resolve());
    el.addEventListener("error", () => reject(new Error("Turnstile gagal dimuat")));
  });
}

// onToken harus stabil (misalnya setter dari useState). resetSignal dinaikkan setelah submit ditolak,
// karena token Turnstile hanya berlaku sekali.
export default function Turnstile({ onToken, resetSignal }: { onToken: (token: string) => void; resetSignal: number }) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !box.current || !window.turnstile) return;
        widget.current = window.turnstile.render(box.current, {
          sitekey: TURNSTILE_SITE_KEY,
          action: "daftar",
          theme: "dark",
          language: "id",
          callback: (token: string) => onToken(token),
          "expired-callback": () => onToken(""),
          "error-callback": () => onToken(""),
        });
      })
      .catch(() => onToken(""));
    return () => {
      cancelled = true;
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = null;
    };
  }, [onToken]);

  useEffect(() => {
    if (resetSignal && widget.current) {
      window.turnstile?.reset(widget.current);
      onToken("");
    }
  }, [resetSignal, onToken]);

  if (!TURNSTILE_SITE_KEY) return null;
  return <div ref={box} className="mt-5 min-h-[65px]" />;
}
