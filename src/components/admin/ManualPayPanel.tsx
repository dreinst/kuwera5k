"use client";

import { useState, useTransition } from "react";
import { markManualPaidAction } from "@/app/kuweraadmin/actions";
import { formatRupiah } from "@/lib/registration";

// Tandai lunas untuk bayar manual QRIS. Admin wajib mengetik ulang nominal yang terlihat di riwayat
// GoPay Merchant, supaya tombol tidak ditekan sebelum uangnya benar-benar dicek.
export default function ManualPayPanel({ orderId, total }: { orderId: string; total: number }) {
  const [typed, setTyped] = useState("");
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  const amount = Number(typed.replace(/\D/g, ""));
  const matches = amount === total;
  const run = () => start(async () => {
    const r = await markManualPaidAction(orderId, amount);
    setMessage(r.error ?? r.ok ?? "");
  });
  return (
    <div>
      <p className="text-sm text-white/85">
        Buka riwayat transaksi di aplikasi GoPay Merchant. Cari uang masuk sebesar <span className="font-semibold text-brand-yellow">{formatRupiah(total)}</span> (nominal harus persis sama, termasuk 3 digit terakhir).
      </p>
      <label className="mt-4 block text-sm text-white/80">Ketik nominal yang masuk</label>
      <input
        inputMode="numeric" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={String(total)}
        className="mt-2 w-full rounded-xl border border-glass-border bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-brand-yellow focus:outline-none"
      />
      {typed && !matches && <p className="mt-2 text-sm text-yellow-lime">Belum sama dengan total order {formatRupiah(total)}.</p>}
      <button type="button" onClick={run} disabled={pending || !matches} className="mt-4 rounded-full bg-brand-yellow px-5 py-2 text-sm font-semibold text-green-deep disabled:opacity-50">
        {pending ? "Menyimpan..." : "Tandai lunas dan terbitkan tiket"}
      </button>
      {message && <p className="mt-3 text-sm text-brand-yellow">{message}</p>}
    </div>
  );
}
