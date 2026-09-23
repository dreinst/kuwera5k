"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { verifyAllAction } from "@/app/admin/actions";
import type { MidtransCheck } from "@/lib/admin-shared";
import { VERDICT, VerdictBadge } from "@/components/admin/Badges";

export default function VerifyAll() {
  const [results, setResults] = useState<MidtransCheck[] | null>(null);
  const [error, setError] = useState("");
  const [onlyProblems, setOnlyProblems] = useState(true);
  const [pending, start] = useTransition();

  const run = () => start(async () => {
    setError("");
    const r = await verifyAllAction();
    if (r.error) setError(r.error); else setResults(r.results ?? []);
  });

  const summary = useMemo(() => {
    const s: Partial<Record<MidtransCheck["verdict"], number>> = {};
    for (const r of results ?? []) s[r.verdict] = (s[r.verdict] ?? 0) + 1;
    return s;
  }, [results]);
  const shown = (results ?? []).filter((r) => !onlyProblems || r.verdict === "tidak_cocok" || r.verdict === "error");

  return (
    <div>
      <button type="button" onClick={run} disabled={pending} className="rounded-full bg-brand-yellow px-6 py-3 text-sm font-semibold text-green-deep disabled:opacity-60">
        {pending ? "Mencocokkan dengan Midtrans..." : "Mulai verifikasi semua order"}
      </button>
      {error && <p className="mt-3 text-sm text-brand-yellow">{error}</p>}
      {results && (
        <div className="mt-6">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(VERDICT) as MidtransCheck["verdict"][]).map((v) => (
              <span key={v} className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-sm text-white/85"><VerdictBadge verdict={v} /> {summary[v] ?? 0}</span>
            ))}
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm text-white/80">
            <input type="checkbox" checked={onlyProblems} onChange={(e) => setOnlyProblems(e.target.checked)} className="accent-brand-yellow" />
            Tampilkan yang bermasalah saja
          </label>
          {shown.length === 0 ? (
            <p className="mt-4 text-white/80">{results.length === 0 ? "Belum ada order yang terhubung ke Midtrans." : "Tidak ada yang bermasalah. Semua order cocok dengan Midtrans."}</p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-2xl border border-glass-border">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-white/5 text-xs text-white/70 uppercase">
                  <tr><th className="px-4 py-3">Order</th><th className="px-4 py-3">Hasil</th><th className="px-4 py-3">Keterangan</th></tr>
                </thead>
                <tbody>
                  {shown.map((r) => (
                    <tr key={r.orderId} className="border-t border-white/10">
                      <td className="px-4 py-3 font-mono"><Link href={`/admin/peserta/${r.orderId}`} className="text-brand-yellow hover:underline">{r.orderId}</Link></td>
                      <td className="px-4 py-3"><VerdictBadge verdict={r.verdict} /></td>
                      <td className="px-4 py-3 text-white/85">{r.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
