"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PAYMENT_METHODS, formatRupiah } from "@/lib/registration";
import { waLink, waText } from "@/lib/whatsapp";
import { trackPixel } from "@/lib/meta-pixel";
import { useNow } from "@/lib/use-now";

type Order = {
  id: string; status: string; total: number; subtotal: number; discount: number; fee: number;
  expiresAt: string | null; paymentMethod: string | null; category: string; name: string; email: string;
  hasSnap: boolean;
};

// Setelah timer habis, order yang sudah membuka Snap masih dicek ke Midtrans selama ini sebelum
// dinyatakan habis, karena pembayaran di detik terakhir bisa baru dikonfirmasi sesudahnya.
const GRACE_MS = 3 * 60_000;

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

export default function PaymentWaiting({ order, paymentMode, snap, trackCheckout }: { order: Order; paymentMode: "mock" | "off" | "midtrans"; snap?: SnapConfig; trackCheckout: boolean }) {
  const router = useRouter();
  // Waktu diisi di klien saja supaya HTML server dan klien sama (hindari hydration mismatch).
  const now = useNow();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [snapNote, setSnapNote] = useState("");
  const [serverStatus, setServerStatus] = useState(order.status);
  const [snapOpened, setSnapOpened] = useState(false);
  const expiresAt = order.expiresAt ? new Date(order.expiresAt).getTime() : null;
  const remaining = expiresAt && now ? Math.max(0, expiresAt - now) : 0;
  const timeUp = expiresAt !== null && now !== null && remaining === 0;
  const failed = serverStatus === "FAILED";
  const canBePaidLate = paymentMode === "midtrans" && (order.hasSnap || snapOpened);
  const checking = serverStatus === "PENDING" && timeUp && canBePaidLate && now !== null && expiresAt !== null && now < expiresAt + GRACE_MS;
  const expired = serverStatus === "EXPIRED" || failed || (serverStatus === "PENDING" && timeUp && !checking);
  const method = PAYMENT_METHODS.find((m) => m.id === order.paymentMethod)?.label ?? order.paymentMethod ?? "-";
  const live = useRef({ checking, canBePaidLate });
  useEffect(() => {
    live.current = { checking, canBePaidLate };
  }, [checking, canBePaidLate]);

  // Polling status: begitu webhook Midtrans menandai PAID, langsung ke e-ticket. Tiap 30 detik (dan
  // terus-menerus saat masa cek setelah timer habis) server diminta mengecek langsung ke Midtrans.
  useEffect(() => {
    if (expired) return;
    let tick = 0;
    const t = setInterval(async () => {
      tick++;
      const { checking: inGrace, canBePaidLate: hasSnap } = live.current;
      const sync = hasSnap && (inGrace || tick % 6 === 0);
      try {
        const res = await fetch(`/api/orders/${order.id}${sync ? "?sync=1" : ""}`, { cache: "no-store" });
        const data = await res.json();
        if (data.status === "PAID" && data.ticketCode) router.replace(`/tiket/${data.ticketCode}`);
        else if (data.status === "FAILED") setServerStatus("FAILED");
        else if (data.status === "EXPIRED" && data.final) setServerStatus("EXPIRED");
      } catch {}
    }, 5000);
    return () => clearInterval(t);
  }, [order.id, expired, router]);

  // Tab yang dibekukan browser (misal saat peserta pindah ke aplikasi bank) bisa melewatkan seluruh masa
  // cek. Begitu halaman menyatakan habis, cek sekali lagi ke Midtrans sebelum menyerah.
  useEffect(() => {
    if (!expired || serverStatus !== "PENDING" || !canBePaidLate) return;
    let cancelled = false;
    fetch(`/api/orders/${order.id}?sync=1`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.status === "PAID" && data.ticketCode) router.replace(`/tiket/${data.ticketCode}`);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [expired, serverStatus, canBePaidLate, order.id, router]);

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
      // Sekali per order: saat Snap pertama kali dibuka, bukan setiap klik Bayar.
      if (trackCheckout && !snapOpened && !order.hasSnap) trackPixel("AddPaymentInfo", { value: order.total, currency: "IDR", payment_method: order.paymentMethod ?? "" }, `${order.id}-pay`);
      setSnapOpened(true);
      await loadSnap(snap);
      window.snap?.pay(data.token, {
        onSuccess: () => setSnapNote("Pembayaran diterima, menunggu konfirmasi dari Midtrans..."),
        onPending: () => setSnapNote("Instruksi pembayaran sudah dibuat. Halaman ini otomatis pindah ke e-ticket begitu pembayaran masuk."),
        onError: () => setError("Pembayaran gagal di Midtrans, coba metode lain atau ulangi."),
        onClose: () => setSnapNote("Jendela pembayaran ditutup. Tekan tombol Bayar lagi untuk melihat instruksinya selama timer masih berjalan."),
      });
    } catch {
      setError("Tidak bisa memuat halaman pembayaran Midtrans, periksa koneksi lalu coba lagi");
    } finally {
      setBusy(false);
    }
  };

  // Sebelum jam klien terisi, tampilkan spasi selebar angka (bukan tanda pisah) supaya layout tidak bergeser.
  const blank = "\u2007\u2007";
  const mm = now === null ? blank : String(Math.floor(remaining / 60000)).padStart(2, "0");
  const ss = now === null ? blank : String(Math.floor((remaining % 60000) / 1000)).padStart(2, "0");

  return (
    <div>
      <p className="text-xs font-semibold tracking-wide text-gold uppercase">Pembayaran</p>
      <h1 className="font-display mt-2 text-4xl text-white uppercase">
        {failed ? "Pembayaran gagal" : expired ? "Waktu bayar habis" : checking ? "Mengecek pembayaran" : "Selesaikan pembayaran"}
      </h1>
      <p className="mt-3 text-white/70">
        {failed
          ? "Midtrans menolak pembayaran untuk order ini, jadi kuotanya dilepas. Silakan daftar ulang dan pilih metode lain."
          : expired
            ? "Kuota untuk order ini sudah dilepas. Silakan daftar ulang, datamu tidak tersimpan di order yang kedaluwarsa."
            : checking
              ? "Waktu bayar sudah habis. Kami sedang memastikan ke Midtrans apakah pembayaranmu sudah masuk, biasanya tidak sampai tiga menit. Jangan tutup halaman ini."
              : `Order ${order.id} menahan kuota kamu sampai timer di bawah habis.`}
      </p>
      {expired && !failed && canBePaidLate && (
        <p className="mt-2 text-white/70">
          Sudah membayar tapi halaman ini tidak berubah? <a href={waLink(waText.sudahBayar(order.id))} target="_blank" rel="noopener noreferrer" className="text-brand-yellow underline">Hubungi panitia lewat WhatsApp</a>, nomor order sudah otomatis ada di pesannya.
        </p>
      )}

      <div className="mt-8 rounded-[20px] border border-glass-border bg-card p-6 sm:p-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-white/75">Nomor order</p>
            <p className="font-display text-2xl text-brand-yellow">{order.id}</p>
          </div>
          {!expired && !checking && (
            <div className="text-right">
              <p className="text-sm text-white/75">Sisa waktu</p>
              <p className="font-display text-3xl text-white tabular-nums">{mm}:{ss}</p>
            </div>
          )}
        </div>

        <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-white/75">Peserta</dt><dd className="font-medium text-white">{order.name}</dd></div>
          <div><dt className="text-white/75">Kategori</dt><dd className="font-medium text-white">{order.category}</dd></div>
          <div><dt className="text-white/75">Metode</dt><dd className="font-medium text-white">{method}</dd></div>
          <div><dt className="text-white/75">Email e-ticket</dt><dd className="font-medium text-white">{order.email}</dd></div>
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

        {!expired && !checking && paymentMode === "mock" && (
          <div className="mt-6 rounded-2xl border border-dashed border-brand-yellow/50 p-4">
            <p className="text-sm text-white/80">Mode pratinjau. Di sini nanti popup Midtrans terbuka dengan metode {method}. Untuk sekarang, simulasikan hasilnya:</p>
            <button type="button" onClick={simulate} disabled={busy} className="mt-3 w-full rounded-full bg-brand-yellow px-6 py-3 text-sm font-semibold text-green-deep disabled:opacity-60">
              {busy ? "Memproses..." : "Simulasikan pembayaran berhasil"}
            </button>
          </div>
        )}
        {!expired && !checking && paymentMode === "off" && (
          <p className="mt-6 text-sm text-white/70">Pembayaran online belum aktif. Order ini akan kedaluwarsa otomatis.</p>
        )}
        {!expired && !checking && paymentMode === "midtrans" && (
          <div className="mt-6">
            <button type="button" onClick={openSnap} disabled={busy} className="w-full rounded-full bg-brand-yellow px-6 py-3 text-sm font-semibold text-green-deep disabled:opacity-60">
              {busy ? "Membuka pembayaran..." : `Bayar ${formatRupiah(order.total)} dengan ${method}`}
            </button>
            {snapNote && <p className="mt-3 text-sm text-white/80">{snapNote}</p>}
            <p className="mt-3 text-xs text-white/75">Pembayaran diproses Midtrans. Setelah lunas, e-ticket muncul otomatis di halaman ini.</p>
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
