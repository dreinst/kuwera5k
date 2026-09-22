"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PAYMENT_METHODS, formatRupiah } from "@/lib/registration";

type Order = {
  id: string; status: string; total: number; subtotal: number; discount: number; fee: number;
  expiresAt: string | null; paymentMethod: string | null; category: string; name: string; email: string;
};

type SnapConfig = { clientKey: string; scriptUrl: string };
declare global {
  interface Window {
    snap?: { pay: (token: string, cb: { onSuccess?: () => void; onPending?: () => void; onError?: () => void; onClose?: () => void }) => void };
  }
}

function loadSnap({ clientKey, scriptUrl }: SnapConfig) {
  return new Promise<void>((resolve, reject) => {
    if (window.snap) return resolve();
    const el = document.createElement("script");
    el.src = scriptUrl; el.setAttribute("data-client-key", clientKey); el.async = true;
    el.onload = () => resolve(); el.onerror = () => reject(new Error("snap.js gagal dimuat"));
    document.body.appendChild(el);
  });
}

export default function PaymentWaiting({ order, paymentMode, snap }: { order: Order; paymentMode: "mock" | "off" | "midtrans"; snap?: SnapConfig }) {
  const router = useRouter();
  // Waktu diisi di klien saja supaya HTML server dan klien sama (hindari hydration mismatch).
  const [now, setNow] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [snapNote, setSnapNote] = useState("");
  const expiresAt = order.expiresAt ? new Date(order.expiresAt).getTime() : null;
  const remaining = expiresAt && now ? Math.max(0, expiresAt - now) : 0;
  const expired = order.status === "EXPIRED" || (order.status === "PENDING" && expiresAt !== null && now !== null && remaining === 0);
  const method = PAYMENT_METHODS.find((m) => m.id === order.paymentMethod)?.label ?? order.paymentMethod ?? "-";

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Polling status: begitu webhook (nanti Midtrans) menandai PAID, langsung ke e-ticket.
  useEffect(() => {
    if (expired) return;
    const t = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/${order.id}`, { cache: "no-store" });
        const data = await res.json();
        if (data.status === "PAID" && data.ticketCode) router.replace(`/tiket/${data.ticketCode}`);
      } catch {}
    }, 5000);
    return () => clearInterval(t);
  }, [order.id, expired, router]);

  const simulate = async () => {
    setBusy(true); setError("");
    try {
      const res = await fetch(`/api/orders/${order.id}/pay-mock`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Gagal"); return; }
      router.replace(`/tiket/${data.code}`);
    } finally {
      setBusy(false);
    }
  };

  const openSnap = async () => {
    if (!snap) return;
    setBusy(true); setError(""); setSnapNote("");
    try {
      const res = await fetch(`/api/orders/${order.id}/snap`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Gagal membuka pembayaran"); return; }
      if (data.paid && data.code) { router.replace(`/tiket/${data.code}`); return; }
      await loadSnap(snap);
      window.snap?.pay(data.token, {
        onSuccess: () => setSnapNote("Pembayaran diterima, menunggu konfirmasi dari Midtrans..."),
        onPending: () => setSnapNote("Instruksi pembayaran sudah dibuat. Halaman ini otomatis pindah ke e-ticket begitu pembayaran masuk."),
        onError: () => setError("Pembayaran gagal di Midtrans, coba metode lain atau ulangi."),
        onClose: () => setSnapNote("Jendela pembayaran ditutup. Kamu bisa membukanya lagi selama timer masih berjalan."),
      });
    } catch {
      setError("Tidak bisa memuat halaman pembayaran Midtrans, periksa koneksi lalu coba lagi");
    } finally {
      setBusy(false);
    }
  };

  const mm = now === null ? "--" : String(Math.floor(remaining / 60000)).padStart(2, "0");
  const ss = now === null ? "--" : String(Math.floor((remaining % 60000) / 1000)).padStart(2, "0");

  return (
    <div>
      <p className="text-xs font-semibold tracking-wide text-gold uppercase">Pembayaran</p>
      <h1 className="font-display mt-2 text-4xl text-white uppercase">
        {expired ? "Waktu bayar habis" : "Selesaikan pembayaran"}
      </h1>
      <p className="mt-3 text-white/70">
        {expired
          ? "Kuota untuk order ini sudah dilepas. Silakan daftar ulang, datamu tidak tersimpan di order yang kedaluwarsa."
          : `Order ${order.id} menahan kuota kamu sampai timer di bawah habis.`}
      </p>

      <div className="mt-8 rounded-[20px] border border-glass-border bg-glass p-6 backdrop-blur-md sm:p-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-white/60">Nomor order</p>
            <p className="font-display text-2xl text-brand-yellow">{order.id}</p>
          </div>
          {!expired && (
            <div className="text-right">
              <p className="text-sm text-white/60">Sisa waktu</p>
              <p className="font-display text-3xl text-white tabular-nums">{mm}:{ss}</p>
            </div>
          )}
        </div>

        <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-white/60">Peserta</dt><dd className="font-medium text-white">{order.name}</dd></div>
          <div><dt className="text-white/60">Kategori</dt><dd className="font-medium text-white">{order.category}</dd></div>
          <div><dt className="text-white/60">Metode</dt><dd className="font-medium text-white">{method}</dd></div>
          <div><dt className="text-white/60">Email e-ticket</dt><dd className="font-medium text-white">{order.email}</dd></div>
        </dl>

        <div className="mt-6 rounded-2xl bg-white/5 p-4 text-sm">
          <div className="flex justify-between py-1"><span className="text-white/70">Harga tiket</span><span className="text-white">{formatRupiah(order.subtotal)}</span></div>
          {order.discount > 0 && <div className="flex justify-between py-1"><span className="text-white/70">Diskon</span><span className="text-white">{"\u2212"}{formatRupiah(order.discount)}</span></div>}
          <div className="flex justify-between py-1"><span className="text-white/70">Biaya layanan</span><span className="text-white">{formatRupiah(order.fee)}</span></div>
          <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-3">
            <span className="font-semibold text-white">Total</span>
            <span className="font-display text-2xl text-brand-yellow">{formatRupiah(order.total)}</span>
          </div>
        </div>

        {!expired && paymentMode === "mock" && (
          <div className="mt-6 rounded-2xl border border-dashed border-brand-yellow/50 p-4">
            <p className="text-sm text-white/80">Mode pratinjau. Di sini nanti popup Midtrans terbuka dengan metode {method}. Untuk sekarang, simulasikan hasilnya:</p>
            <button type="button" onClick={simulate} disabled={busy} className="mt-3 w-full rounded-full bg-brand-yellow px-6 py-3 text-sm font-semibold text-green-deep disabled:opacity-60">
              {busy ? "Memproses..." : "Simulasikan pembayaran berhasil"}
            </button>
          </div>
        )}
        {!expired && paymentMode === "off" && (
          <p className="mt-6 text-sm text-white/70">Pembayaran online belum aktif. Order ini akan kedaluwarsa otomatis.</p>
        )}
        {!expired && paymentMode === "midtrans" && (
          <div className="mt-6">
            <button type="button" onClick={openSnap} disabled={busy} className="w-full rounded-full bg-brand-yellow px-6 py-3 text-sm font-semibold text-green-deep disabled:opacity-60">
              {busy ? "Membuka pembayaran..." : `Bayar ${formatRupiah(order.total)} dengan ${method}`}
            </button>
            {snapNote && <p className="mt-3 text-sm text-white/80">{snapNote}</p>}
            <p className="mt-3 text-xs text-white/60">Pembayaran diproses Midtrans. Setelah lunas, e-ticket muncul otomatis di halaman ini.</p>
          </div>
        )}
        {error && <p className="mt-4 text-sm text-yellow-lime">{error}</p>}
        {expired && (
          <a href="/daftar" className="mt-6 inline-flex rounded-full bg-brand-yellow px-6 py-3 text-sm font-semibold text-green-deep">Daftar ulang &rarr;</a>
        )}
      </div>
    </div>
  );
}
