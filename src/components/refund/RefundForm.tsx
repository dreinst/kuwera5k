"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { inputCls } from "@/components/admin/LoginForm";
import { REFUND_METHODS, REFUND_PROVIDERS, type RefundMethod } from "@/lib/refund-shared";

type Awal = { method: RefundMethod; provider: string; accountNumber: string; accountName: string };

// Formulir rekening tujuan refund. Nominal tidak ada di sini: server yang menghitungnya dari order.
export default function RefundForm({ orderId, k, total, awal, tombol = "Ajukan refund" }: { orderId: string; k: string; total: string; awal?: Awal; tombol?: string }) {
  const router = useRouter();
  const [method, setMethod] = useState<RefundMethod>(awal?.method ?? "bank");
  const [provider, setProvider] = useState(awal?.provider ?? "");
  const [accountNumber, setAccountNumber] = useState(awal?.accountNumber ?? "");
  const [accountNumber2, setAccountNumber2] = useState("");
  const [accountName, setAccountName] = useState(awal?.accountName ?? "");
  const [setuju, setSetuju] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const dompet = method === "ewallet";

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(""); setFields({});
    try {
      const res = await fetch(`/api/refund/${orderId}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ k, method, provider, accountNumber, accountNumber2, accountName, setuju }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; fields?: Record<string, string> };
      if (res.ok) { router.refresh(); return; }
      setError(data.error ?? "Belum berhasil tersimpan. Mohon coba lagi sebentar lagi, ya.");
      setFields(data.fields ?? {});
    } catch {
      setError("Koneksi terputus. Mohon coba lagi, ya.");
    }
    setBusy(false);
  }

  const salah = (f: string) => fields[f] && <span className="text-xs font-normal text-brand-yellow">{fields[f]}</span>;
  return (
    <form onSubmit={kirim} className="grid gap-4">
      <fieldset className="grid gap-2 text-sm font-medium text-white">
        <legend className="mb-2">Dana dikembalikan ke</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(Object.keys(REFUND_METHODS) as RefundMethod[]).map((m) => (
            <label key={m} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 ${method === m ? "border-brand-yellow bg-brand-yellow/10" : "border-glass-border bg-white/5"}`}>
              <input type="radio" name="method" checked={method === m} onChange={() => { setMethod(m); setProvider(""); }} className="accent-brand-yellow" />
              {REFUND_METHODS[m]}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="grid gap-2 text-sm font-medium text-white">
        {dompet ? "Dompet digital" : "Nama bank"}
        <select value={provider} onChange={(e) => setProvider(e.target.value)} required className={`${inputCls} [&>option]:text-green-deep`}>
          <option value="">Pilih {dompet ? "dompet digital" : "bank"}</option>
          {REFUND_PROVIDERS[method].map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        {salah("provider")}
      </label>
      <label className="grid gap-2 text-sm font-medium text-white">
        {dompet ? "Nomor HP yang terdaftar di dompet" : "Nomor rekening"}
        <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} required inputMode="numeric" autoComplete="off" className={`${inputCls} font-mono`} />
        {salah("accountNumber")}
      </label>
      <label className="grid gap-2 text-sm font-medium text-white">
        Ketik ulang nomornya
        <input value={accountNumber2} onChange={(e) => setAccountNumber2(e.target.value)} required inputMode="numeric" autoComplete="off" onPaste={(e) => e.preventDefault()} className={`${inputCls} font-mono`} />
        {salah("accountNumber2")}
      </label>
      <label className="grid gap-2 text-sm font-medium text-white">
        Nama pemilik {dompet ? "akun" : "rekening"}
        <input value={accountName} onChange={(e) => setAccountName(e.target.value)} required maxLength={80} autoComplete="off" placeholder={dompet ? "Sesuai nama di aplikasi" : "Sesuai buku tabungan"} className={inputCls} />
        {salah("accountName")}
      </label>
      <label className="flex items-start gap-3 text-sm text-white/85">
        <input type="checkbox" checked={setuju} onChange={(e) => setSetuju(e.target.checked)} className="mt-1 accent-brand-yellow" />
        <span>Data rekening di atas sudah benar. Saya mengerti setelah dana {total} saya terima, tiket di order ini tidak berlaku lagi.</span>
      </label>
      {error && <p className="rounded-xl border border-brand-yellow/40 bg-brand-yellow/10 px-4 py-3 text-sm text-brand-yellow">{error}</p>}
      <button type="submit" disabled={busy || !setuju} className="rounded-full bg-brand-yellow py-3 text-sm font-semibold text-green-deep disabled:opacity-60">
        {busy ? "Menyimpan..." : tombol}
      </button>
    </form>
  );
}
