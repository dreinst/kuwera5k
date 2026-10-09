"use client";

import { useState } from "react";
import Turnstile, { TURNSTILE_SITE_KEY } from "@/components/registration/Turnstile";
import { inputCls } from "@/components/admin/LoginForm";

// Form cadangan di /refund untuk pemesan yang belum memegang tautan pribadinya: nomor order dan email saat daftar.
export default function CariRefund() {
  const [orderId, setOrderId] = useState("");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [reset, setReset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [terkirim, setTerkirim] = useState(false);

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/refund/cari", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId, email, token }) });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.ok) setTerkirim(true);
      else { setError(data.error ?? "Belum berhasil terkirim. Mohon coba lagi sebentar lagi, ya."); setReset((n) => n + 1); }
    } catch {
      setError("Koneksi terputus. Mohon coba lagi, ya.");
    }
    setBusy(false);
  }

  if (terkirim) {
    return (
      <p className="rounded-xl border border-brand-yellow/40 bg-brand-yellow/10 px-4 py-3 text-sm text-brand-yellow">
        Terima kasih. Kalau nomor order dan emailnya cocok, tautan refund kami kirim ke email itu dalam beberapa menit. Mohon cek juga folder spam atau promosi, ya.
      </p>
    );
  }
  return (
    <form onSubmit={kirim} className="grid gap-4">
      <label className="grid gap-2 text-sm font-medium text-white">
        Nomor order
        <input value={orderId} onChange={(e) => setOrderId(e.target.value.toUpperCase())} required placeholder="KWR-2026-XXXXXX" autoCapitalize="characters" className={`${inputCls} font-mono`} />
      </label>
      <label className="grid gap-2 text-sm font-medium text-white">
        Email saat mendaftar
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="nama@gmail.com" className={inputCls} />
      </label>
      <Turnstile onToken={setToken} resetSignal={reset} tombol="kirim" />
      {error && <p className="rounded-xl border border-brand-yellow/40 bg-brand-yellow/10 px-4 py-3 text-sm text-brand-yellow">{error}</p>}
      <button type="submit" disabled={busy || (!!TURNSTILE_SITE_KEY && !token)} className="rounded-full bg-brand-yellow py-3 text-sm font-semibold text-green-deep disabled:opacity-60">
        {busy ? "Mengirim..." : "Kirim tautan refund ke email saya"}
      </button>
    </form>
  );
}
