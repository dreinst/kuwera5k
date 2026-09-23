"use client";

import { useState, useTransition } from "react";
import { checkMidtransAction, syncMidtransAction } from "@/app/admin/actions";
import type { MidtransCheck } from "@/lib/admin-shared";
import { VerdictBadge } from "@/components/admin/Badges";

// Cek status order langsung ke Midtrans; order yang belum final bisa disinkronkan dengan status resmi Midtrans.
export default function MidtransPanel({ orderId, canSync }: { orderId: string; canSync: boolean }) {
  const [result, setResult] = useState<MidtransCheck | null>(null);
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();

  const check = () => start(async () => {
    setMessage("");
    const r = await checkMidtransAction(orderId);
    if ("error" in r) { setResult(null); setMessage(r.error); } else setResult(r);
  });
  const sync = () => start(async () => {
    const r = await syncMidtransAction(orderId);
    setMessage(r.error ?? r.ok ?? "");
  });

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={check} disabled={pending} className="rounded-full bg-brand-yellow px-5 py-2 text-sm font-semibold text-green-deep disabled:opacity-60">
          {pending ? "Menghubungi Midtrans..." : "Cek ke Midtrans"}
        </button>
        {canSync && (
          <button type="button" onClick={sync} disabled={pending} className="rounded-full border border-brand-yellow px-5 py-2 text-sm font-semibold text-brand-yellow disabled:opacity-60">
            Sinkronkan status
          </button>
        )}
      </div>
      {message && <p className="mt-3 text-sm text-brand-yellow">{message}</p>}
      {result && (
        <div className="mt-4 rounded-2xl bg-white/5 p-4 text-sm">
          <div className="flex flex-wrap items-center gap-3"><VerdictBadge verdict={result.verdict} /><span className="text-white/85">{result.note}</span></div>
          {result.live && (
            <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {Object.entries(result.live).filter(([, v]) => v).map(([k, v]) => (
                <div key={k}><dt className="text-xs text-white/65">{k}</dt><dd className="font-mono text-white">{String(v)}</dd></div>
              ))}
            </dl>
          )}
        </div>
      )}
    </div>
  );
}
