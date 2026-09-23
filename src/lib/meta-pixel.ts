// Meta Pixel (Facebook/Instagram Ads), sesuai rencana analitik di PRD bagian 8. Aktif hanya kalau
// NEXT_PUBLIC_META_PIXEL_ID diisi angka; tanpa itu semua panggilan di bawah tidak melakukan apa-apa.
const rawId = (process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "").trim();
export const META_PIXEL_ID = /^\d+$/.test(rawId) ? rawId : "";

type Fbq = {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[];
  push: Fbq;
  loaded: boolean;
  version: string;
};
declare global {
  interface Window { fbq?: Fbq; _fbq?: Fbq }
}

// Kode dasar resmi Meta dalam bentuk fungsi. Dipanggil oleh event pertama atau oleh <MetaPixel/>, mana yang
// lebih dulu, supaya event yang dipanggil saat halaman baru terbuka (ViewContent, Purchase) masuk antrean
// setelah init, tidak hilang. PageView saat pindah halaman dikirim fbevents.js sendiri lewat history.
export function ensureFbq(): Fbq | undefined {
  if (!META_PIXEL_ID || typeof window === "undefined") return;
  if (window.fbq) return window.fbq;
  const n = ((...args: unknown[]) => {
    if (n.callMethod) n.callMethod.call(n, ...args); else n.queue.push(args);
  }) as Fbq;
  n.push = n;
  n.loaded = true;
  n.version = "2.0";
  n.queue = [];
  window.fbq = n;
  if (!window._fbq) window._fbq = n;
  const s = document.createElement("script");
  s.async = true;
  s.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(s);
  // Tanpa setup otomatis (klik tombol, metadata halaman): yang terkirim hanya event di bawah.
  n("set", "autoConfig", false, META_PIXEL_ID);
  n("init", META_PIXEL_ID);
  n("track", "PageView");
  return n;
}

export function trackPixel(event: string, params?: Record<string, unknown>, eventId?: string) {
  const fbq = ensureFbq();
  if (!fbq) return;
  if (eventId) fbq("track", event, params ?? {}, { eventID: eventId });
  else fbq("track", event, params ?? {});
}
