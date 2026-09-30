"use client";

import { useActionState, useTransition } from "react";
import { hapusPenarikanAction, tambahPenarikanAction, type FormState } from "@/app/kuweraadmin/actions";
import { inputCls } from "@/components/admin/LoginForm";
import { formatRupiah } from "@/lib/registration";
import type { Penarikan } from "@/lib/penarikan";

const tgl = (d: string) => new Date(`${d}T00:00:00+07:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });

export default function PenarikanManager({ list, sisaSaldo, hariIni }: { list: Penarikan[]; sisaSaldo: number; hariIni: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(tambahPenarikanAction, null);
  const [hapusPending, start] = useTransition();
  const hapus = (p: Penarikan) => {
    if (!window.confirm(`Hapus catatan penarikan ${tgl(p.tanggal)}?`)) return;
    start(async () => { const r = await hapusPenarikanAction(p.id); if (r?.error) window.alert(r.error); });
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[20px] border border-glass-border bg-card p-6">
        <h2 className="font-display text-xl text-white uppercase">Catat penarikan</h2>
        <p className="mt-1 text-sm text-white/75">Saldo GoPay yang belum ditarik sekarang {formatRupiah(sisaSaldo)}.</p>
        <form action={action} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="grid gap-1 text-sm text-white/85">Tanggal
            <input type="date" name="tanggal" required defaultValue={hariIni} className={inputCls} /></label>
          <label className="grid gap-1 text-sm text-white/85">Saldo yang ditarik (Rp)
            <input name="saldo" required inputMode="numeric" placeholder="misalnya 4178225" className={inputCls} /></label>
          <label className="grid gap-1 text-sm text-white/85">Masuk rekening (Rp)
            <input name="masuk" required inputMode="numeric" placeholder="setelah potongan GoPay" className={inputCls} /></label>
          <label className="grid gap-1 text-sm text-white/85">Catatan (boleh kosong)
            <input name="catatan" maxLength={120} className={inputCls} /></label>
          <div className="flex items-center gap-4 sm:col-span-2 lg:col-span-4">
            <button disabled={pending} className="rounded-full bg-brand-yellow px-6 py-2 text-sm font-semibold text-green-deep disabled:opacity-60">
              {pending ? "Menyimpan..." : "Simpan penarikan"}
            </button>
            {state?.error && <p className="text-sm text-brand-yellow">{state.error}</p>}
            {state?.ok && <p className="text-sm text-yellow-lime">{state.ok}</p>}
          </div>
        </form>
      </section>

      <section className="rounded-[20px] border border-glass-border bg-card p-6">
        <h2 className="font-display text-xl text-white uppercase">Riwayat penarikan</h2>
        {list.length === 0 ? <p className="mt-4 text-white/70">Belum ada penarikan tercatat.</p> : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs text-white/65 uppercase">
                <tr><th className="py-2 pr-3">Tanggal</th><th className="py-2 pr-3">Saldo ditarik</th><th className="py-2 pr-3">Masuk rekening</th>
                  <th className="py-2 pr-3">Potongan</th><th className="py-2 pr-3">Catatan</th><th className="py-2" /></tr>
              </thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id} className="border-t border-white/10">
                    <td className="py-2 pr-3 text-white">{tgl(p.tanggal)}</td>
                    <td className="py-2 pr-3 text-white/85">{formatRupiah(p.saldo)}</td>
                    <td className="py-2 pr-3 font-semibold text-white">{formatRupiah(p.masuk)}</td>
                    <td className="py-2 pr-3 text-brand-yellow">{formatRupiah(p.saldo - p.masuk)}</td>
                    <td className="py-2 pr-3 text-white/75">{p.catatan || "-"} <span className="text-white/50">({p.oleh})</span></td>
                    <td className="py-2 text-right">
                      <button type="button" disabled={hapusPending} onClick={() => hapus(p)} className="text-xs text-white/60 hover:text-brand-yellow">Hapus</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
