"use client";

import { useState, useTransition } from "react";
import { cancelKudamAction, createKudamAction, markKudamPaidAction, type KudamRow } from "@/app/kuweraadmin/actions";
import { JERSEY_SIZES, formatRupiah } from "@/lib/registration";

type Member = { id: string; nama: string; wa: string; email: string; jersey: string; status: string; tiket: string | null; dibuat: string };

const inputCls = "w-full rounded-xl border border-glass-border bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-brand-yellow focus:outline-none";
const empty = (): KudamRow => ({ nama: "", wa: "", email: "", jersey: "" });

export default function KudamManager({ members, price }: { members: Member[]; price: number }) {
  const [rows, setRows] = useState<KudamRow[]>([empty(), empty(), empty()]);
  const [picked, setPicked] = useState<string[]>([]);
  const [typed, setTyped] = useState("");
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();

  const unpaid = members.filter((m) => m.status === "PENDING");
  const set = (i: number, k: keyof KudamRow, v: string) => setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const total = picked.length * price;

  const save = () => start(async () => {
    const r = await createKudamAction(rows);
    setMsg(r.error ?? r.ok ?? "");
    if (r.ok) setRows([empty(), empty(), empty()]);
  });
  const pay = () => start(async () => {
    const r = await markKudamPaidAction(picked, Number(typed.replace(/\D/g, "")));
    setMsg(r.error ?? r.ok ?? "");
    if (r.ok) { setPicked([]); setTyped(""); }
  });
  const cancel = (id: string, nama: string) => {
    if (!window.confirm(`Batalkan pendaftaran ${nama}?`)) return;
    start(async () => setMsg((await cancelKudamAction(id)).error ?? "Dibatalkan"));
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[20px] border border-glass-border bg-card p-6">
        <h2 className="font-display text-xl text-white uppercase">Tambah anggota</h2>
        <p className="mt-1 text-sm text-white/70">Isi nama, nomor WA, email, dan ukuran jersey. E-ticket dikirim ke email itu setelah lunas. Harga {formatRupiah(price)} per orang, bayar lewat QRIS statis tanpa kode unik.</p>
        <div className="mt-4 space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_8rem]">
              <input className={inputCls} placeholder={`Nama anggota ${i + 1}`} value={r.nama} onChange={(e) => set(i, "nama", e.target.value)} />
              <input className={inputCls} placeholder="Nomor WA, contoh 0812..." inputMode="tel" value={r.wa} onChange={(e) => set(i, "wa", e.target.value)} />
              <input className={inputCls} placeholder="Email, contoh nama@gmail.com" type="email" inputMode="email" autoComplete="off" value={r.email} onChange={(e) => set(i, "email", e.target.value)} />
              <select className={`${inputCls} [&>option]:bg-green-deep`} value={r.jersey} onChange={(e) => set(i, "jersey", e.target.value)}>
                <option value="">Jersey</option>
                {JERSEY_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" onClick={() => setRows((r) => [...r, empty()])} className="rounded-full border border-glass-border px-5 py-2 text-sm text-white/85">+ Tambah baris</button>
          <button type="button" onClick={save} disabled={pending} className="rounded-full bg-brand-yellow px-6 py-2 text-sm font-semibold text-green-deep disabled:opacity-60">
            {pending ? "Menyimpan..." : "Simpan anggota"}
          </button>
        </div>
      </section>

      {msg && <p className="rounded-xl border border-brand-yellow/40 bg-brand-yellow/10 px-4 py-3 text-sm text-brand-yellow">{msg}</p>}

      <section className="rounded-[20px] border border-glass-border bg-card p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-xl text-white uppercase">Daftar anggota Kudam</h2>
          <p className="text-sm text-white/80">
            {members.filter((m) => m.status === "PAID").length} lunas &middot; {unpaid.length} belum bayar
            {unpaid.length > 0 && <> (tagihan {formatRupiah(unpaid.length * price)})</>}
          </p>
        </div>
        {members.length === 0 ? <p className="mt-4 text-white/70">Belum ada anggota Kudam.</p> : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs text-white/65 uppercase">
                <tr>
                  <th className="py-2 pr-3">
                    <input type="checkbox" aria-label="Pilih semua yang belum bayar" checked={unpaid.length > 0 && picked.length === unpaid.length}
                      onChange={(e) => setPicked(e.target.checked ? unpaid.map((m) => m.id) : [])} />
                  </th>
                  <th className="py-2 pr-3">Nama</th><th className="py-2 pr-3">WA</th><th className="py-2 pr-3">Email</th><th className="py-2 pr-3">Jersey</th>
                  <th className="py-2 pr-3">Status</th><th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="border-t border-white/10">
                    <td className="py-2 pr-3">
                      {m.status === "PENDING" && (
                        <input type="checkbox" aria-label={`Pilih ${m.nama}`} checked={picked.includes(m.id)}
                          onChange={(e) => setPicked((p) => (e.target.checked ? [...p, m.id] : p.filter((x) => x !== m.id)))} />
                      )}
                    </td>
                    <td className="py-2 pr-3 font-semibold text-white"><a href={`/kuweraadmin/peserta/${m.id}`} className="hover:underline">{m.nama}</a></td>
                    <td className="py-2 pr-3 text-white/85">{m.wa}</td>
                    <td className="py-2 pr-3 text-white/85">{m.email || "(belum ada)"}</td>
                    <td className="py-2 pr-3 text-white/85">{m.jersey}</td>
                    <td className="py-2 pr-3">
                      {m.status === "PAID" ? <span className="font-semibold text-yellow-lime">Lunas{m.tiket ? ` · ${m.tiket}` : ""}</span>
                        : m.status === "PENDING" ? <span className="text-white/85">Belum bayar</span> : <span className="text-white/60">Dibatalkan</span>}
                    </td>
                    <td className="py-2 text-right">
                      {m.status === "PENDING" && <button type="button" onClick={() => cancel(m.id, m.nama)} className="text-xs text-white/60 hover:text-brand-yellow">Batalkan</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {picked.length > 0 && (
          <div className="mt-5 rounded-2xl border border-brand-yellow/40 bg-brand-yellow/5 p-4">
            <p className="text-sm text-white/85">
              {picked.length} anggota dipilih, total yang harus masuk <span className="font-semibold text-brand-yellow">{formatRupiah(total)}</span>.
              Cek uang masuk di GoPay Merchant, lalu ketik ulang totalnya untuk konfirmasi.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <input className={`${inputCls} max-w-xs`} inputMode="numeric" placeholder={String(total)} value={typed} onChange={(e) => setTyped(e.target.value)} />
              <button type="button" onClick={pay} disabled={pending || Number(typed.replace(/\D/g, "")) !== total}
                className="rounded-full bg-brand-yellow px-6 py-2 text-sm font-semibold text-green-deep disabled:opacity-50">
                Tandai lunas dan kirim e-ticket
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
