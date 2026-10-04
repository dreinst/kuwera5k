"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { lookupTicketAction, racepackAction, searchTicketsAction, type RegTicket } from "@/app/kuweraadmin/actions";

// Reg ulang race pack seperti checkin Pet Blessing: kamera belakang membaca QR tiket (BarcodeDetector bawaan browser,
// cadangan jsQR), hasil tampil di lembar bawah, dan pemindaian berhenti sampai petugas menekan "Lanjut scan berikutnya".
// Bedanya: race pack baru tercatat setelah petugas mencocokkan KTP/KIA lalu menekan "Serahkan race pack".

type Detector = { detect: (src: HTMLCanvasElement) => Promise<{ rawValue: string }[]> };
type Tone = "ok" | "warn" | "err";

function feedback(tone: Tone) {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = tone === "ok" ? 880 : tone === "warn" ? 520 : 300;
    gain.gain.value = 0.2;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (tone === "ok" ? 0.15 : tone === "warn" ? 0.22 : 0.3));
    osc.onended = () => ctx.close();
  } catch { /* browser tanpa Web Audio */ }
  navigator.vibrate?.(tone === "ok" ? 120 : [80, 60, 80]);
}

const fmt = (iso: string) => new Date(iso).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function RegUlangScanner() {
  const router = useRouter();
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const paused = useRef(false);
  const [camError, setCamError] = useState("");
  const [result, setResult] = useState<{ ticket?: RegTicket; error?: string; done?: string } | null>(null);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<RegTicket[]>([]);
  const [pending, start] = useTransition();

  const open = useCallback((r: { ticket?: RegTicket; error?: string }) => {
    paused.current = true;
    setResult(r);
    feedback(!r.ticket ? "err" : !r.ticket.paid || r.ticket.collectedAt ? "warn" : "ok");
  }, []);

  const handleCode = useCallback(async (code: string) => {
    if (paused.current) return;
    paused.current = true;
    open(await lookupTicketAction(code));
  }, [open]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    let detector: Detector | null = null;
    let jsqr: ((d: Uint8ClampedArray, w: number, h: number) => { data: string } | null) | null = null;

    (async () => {
      const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
      if (BD) detector = new BD({ formats: ["qr_code"] });
      else jsqr = (await import("jsqr")).default;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
          .catch(() => navigator.mediaDevices.getUserMedia({ video: true, audio: false }));
      } catch {
        setCamError("Kamera belum bisa dibuka. Izinkan akses kamera di browser lalu muat ulang halaman ini, atau pakai pencarian manual di bawah.");
        return;
      }
      if (stopped || !video.current) return stream.getTracks().forEach((t) => t.stop());
      video.current.srcObject = stream;
      await video.current.play().catch(() => {});

      const tick = async () => {
        if (stopped) return;
        const v = video.current, c = canvas.current;
        if (!paused.current && v && c && v.readyState >= 2 && v.videoWidth) {
          c.width = v.videoWidth; c.height = v.videoHeight;
          const g = c.getContext("2d", { willReadFrequently: true })!;
          g.drawImage(v, 0, 0);
          let code: string | null = null;
          if (detector) {
            try { code = (await detector.detect(c))[0]?.rawValue ?? null; }
            catch { detector = null; jsqr = (await import("jsqr")).default; } // detektor bawaan gagal: pakai jsQR seterusnya
          }
          if (!code && jsqr) {
            code = jsqr(g.getImageData(0, 0, c.width, c.height).data, c.width, c.height)?.data ?? null;
            if (!code) { // kamera depan kadang mengirim gambar tercermin
              g.save(); g.scale(-1, 1); g.drawImage(v, -c.width, 0); g.restore();
              code = jsqr(g.getImageData(0, 0, c.width, c.height).data, c.width, c.height)?.data ?? null;
            }
          }
          if (code) await handleCode(code);
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    })();

    return () => { stopped = true; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); };
  }, [handleCode]);

  const hand = (t: RegTicket) => start(async () => {
    const r = await racepackAction(t.code);
    if (r.error) { setResult({ ticket: t, error: r.error }); feedback("err"); return; }
    setResult({ ticket: { ...t, collectedAt: new Date().toISOString() }, done: "Race pack sudah diserahkan" });
    feedback("ok");
    router.refresh();
  });

  const next = () => { setResult(null); paused.current = false; };

  const search = (q: string) => {
    setQuery(q);
    start(async () => setFound((await searchTicketsAction(q)).tickets ?? []));
  };

  const t = result?.ticket;
  const state = !result ? null : result.done ? "ok" : !t ? "err" : !t.paid ? "err" : t.collectedAt ? "warn" : "ready";

  return (
    <div className="space-y-6">
      <div className="relative mx-auto aspect-square w-full max-w-md overflow-hidden rounded-[20px] bg-black">
        <video ref={video} playsInline muted className="h-full w-full object-cover" />
        <div className="pointer-events-none absolute inset-[12%] rounded-2xl border-2 border-white/80" aria-hidden />
        {camError && <p className="absolute inset-0 flex items-center p-6 text-center text-sm text-white">{camError}</p>}
      </div>
      <canvas ref={canvas} className="hidden" />
      <p className="text-center text-sm text-white/75">Arahkan QR registrasi ulang peserta ke dalam bingkai.</p>

      <section className="rounded-[20px] border border-glass-border bg-card p-5">
        <h2 className="font-display text-xl text-white uppercase">Cari manual</h2>
        <p className="mt-1 text-sm text-white/70">Kalau QR tidak terbaca, cari nama, nomor HP, atau kode tiket.</p>
        <input value={query} onChange={(e) => search(e.target.value)} placeholder="Minimal 2 huruf"
          className="mt-3 w-full rounded-full border border-glass-border bg-green-deep/40 px-5 py-3 text-sm text-white placeholder:text-white/50 focus:border-brand-yellow focus:outline-none" />
        {query.trim().length >= 2 && (
          <ul className="mt-3 divide-y divide-white/10">
            {found.length === 0 && !pending && <li className="py-3 text-sm text-white/70">Tidak ada tiket lunas yang cocok.</li>}
            {found.map((x) => (
              <li key={x.code}>
                <button type="button" onClick={() => open({ ticket: x })} className="flex w-full items-center justify-between gap-3 py-3 text-left">
                  <span><span className="block font-semibold text-white">{x.name}</span><span className="font-mono text-xs text-white/70">{x.code}</span></span>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${x.collectedAt ? "bg-white/15 text-white/80" : "bg-brand-yellow text-green-deep"}`}>{x.collectedAt ? "Sudah ambil" : "Belum ambil"}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {result && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-[20px] bg-cream p-6 text-green-deep shadow-2xl">
            <p className={`text-xs font-bold tracking-widest uppercase ${state === "ok" || state === "ready" ? "text-green-700" : state === "warn" ? "text-amber-700" : "text-red-700"}`}>
              {state === "ok" ? "✓ Berhasil" : state === "ready" ? "✓ Tiket valid" : state === "warn" ? "! Sudah ambil race pack" : "✕ Tidak valid"}
            </p>
            {t ? (
              <>
                <p className="font-display mt-1 text-3xl uppercase">{t.name}</p>
                <p className="font-mono text-sm">{t.code}</p>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div><dt className="text-green-deep/60">Jersey</dt><dd className="text-2xl font-bold">{t.jersey}</dd></div>
                  <div><dt className="text-green-deep/60">Jenis kelamin</dt><dd className="font-semibold">{t.gender}</dd></div>
                  <div className="col-span-2"><dt className="text-green-deep/60">NIK (cocokkan dengan KTP/KIA)</dt><dd className="font-mono font-semibold">{t.nik}</dd></div>
                  {t.community && <div className="col-span-2"><dt className="text-green-deep/60">Komunitas</dt><dd className="font-semibold">{t.community}</dd></div>}
                </dl>
                {!t.paid && <p className="mt-4 rounded-xl bg-red-100 px-4 py-3 text-sm font-semibold text-red-800">Order ini belum lunas, race pack belum bisa diserahkan.</p>}
                {t.collectedAt && <p className="mt-4 rounded-xl bg-amber-100 px-4 py-3 text-sm font-semibold text-amber-900">{result.done ?? `Sudah diambil ${fmt(t.collectedAt)}${t.collectedBy ? `, dicatat ${t.collectedBy}` : ""}.`}</p>}
                {result.error && <p className="mt-4 rounded-xl bg-red-100 px-4 py-3 text-sm font-semibold text-red-800">{result.error}</p>}
              </>
            ) : <p className="mt-2 text-lg font-semibold">{result.error}</p>}
            <div className="mt-6 grid gap-3">
              {state === "ready" && (
                <button type="button" onClick={() => hand(t!)} disabled={pending} className="rounded-full bg-green-deep px-6 py-3 font-semibold text-white disabled:opacity-60">
                  {pending ? "Menyimpan..." : "Serahkan race pack"}
                </button>
              )}
              <button type="button" onClick={next} className="rounded-full border border-green-deep/30 px-6 py-3 font-semibold">Lanjut scan berikutnya</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
