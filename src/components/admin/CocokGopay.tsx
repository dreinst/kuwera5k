"use client";

import Link from "next/link";
import { useActionState } from "react";
import { cocokGopayAction, type CocokState } from "@/app/kuweraadmin/cocok-actions";
import { formatRupiah } from "@/lib/registration";

const kotak = "rounded-[20px] border border-glass-border bg-card p-6";
const orderLink = (id: string) => <Link href={`/kuweraadmin/peserta/${id}`} className="text-brand-yellow underline">{id}</Link>;

export default function CocokGopay() {
  const [state, action, pending] = useActionState<CocokState, FormData>(cocokGopayAction, null);
  const h = state?.hasil;
  const beres = h && h.tanpaOrder.length === 0 && h.tanpaUang.length === 0;

  return (
    <div className="space-y-6">
      <section className={kotak}>
        <h2 className="font-display text-xl text-white uppercase">Unggah laporan</h2>
        <p className="mt-1 text-sm text-white/75">
          Di GoBiz buka Laporan, pilih Transaksi GoPay, atur rentang tanggal, lalu unduh. Berkas ZIP atau CSV-nya unggah di sini. Berkas tidak disimpan.
          Uang masuk yang nominalnya sama dengan tepat satu order yang belum lunas langsung disetujui, lalu e-ticket dan QR dikirim ke email pemesan.
        </p>
        <form action={action} className="mt-4 flex flex-wrap items-center gap-4">
          <input type="file" name="berkas" required accept=".zip,.csv" className="text-sm text-white/85 file:mr-3 file:rounded-full file:border-0 file:bg-white/15 file:px-4 file:py-2 file:text-white" />
          <button disabled={pending} className="rounded-full bg-brand-yellow px-6 py-2 text-sm font-semibold text-green-deep disabled:opacity-60">
            {pending ? "Mencocokkan..." : "Cocokkan"}
          </button>
          {state?.error && <p className="text-sm text-brand-yellow">{state.error}</p>}
        </form>
      </section>

      {h && (
        <>
          <section className={kotak}>
            <h2 className="font-display text-xl text-white uppercase">{beres ? "Semua cocok" : "Ada yang perlu dicek"}</h2>
            <p className="mt-1 text-sm text-white/75">Laporan {h.periode}.</p>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Transaksi sukses", `${h.jumlah} transaksi, ${formatRupiah(h.bruto)}`],
                ["Potongan MDR", formatRupiah(h.mdr)],
                ["Cocok dengan order lunas", `${h.cocok} pembayaran`],
                ["Di luar rentang laporan", `${h.luarPeriode} pembayaran`],
              ].map(([label, nilai]) => (
                <div key={label}><dt className="text-xs text-white/65 uppercase">{label}</dt><dd className="mt-1 font-semibold text-white">{nilai}</dd></div>
              ))}
            </dl>
            {h.dilewati > 0 && <p className="mt-3 text-sm text-white/75">{h.dilewati} baris dilewati karena statusnya tidak sukses.</p>}
          </section>

          {h.disetujui.length > 0 && (
            <section className={kotak}>
              <h2 className="font-display text-xl text-white uppercase">Baru disetujui ({h.disetujui.length})</h2>
              <p className="mt-1 text-sm text-white/75">Uangnya ada di laporan, jadi order ini ditandai lunas. E-ticket dan QR dikirim ke email pemesan dalam sekitar satu menit.</p>
              <ul className="mt-4 space-y-2 text-sm text-white/85">
                {h.disetujui.map((o) => <li key={o.orderId}>{orderLink(o.orderId)} <span className="font-semibold text-white">{formatRupiah(o.nominal)}</span></li>)}
              </ul>
            </section>
          )}

          <section className={kotak}>
            <h2 className="font-display text-xl text-white uppercase">Uang masuk tanpa order lunas ({h.tanpaOrder.length})</h2>
            <p className="mt-1 text-sm text-white/75">Sudah masuk GoPay tetapi tidak bisa disetujui otomatis: tidak ada order dengan nominal ini, atau ada lebih dari satu. Kalau ada order di kolom kanan, buka ordernya lalu tandai lunas.</p>
            {h.tanpaOrder.length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="text-xs text-white/65 uppercase">
                    <tr><th className="py-2 pr-3">Waktu (WIB)</th><th className="py-2 pr-3">Nominal</th><th className="py-2 pr-3">No. Ref</th><th className="py-2">Order dengan nominal sama</th></tr>
                  </thead>
                  <tbody>
                    {h.tanpaOrder.map((x) => (
                      <tr key={x.waktu + x.ref} className="border-t border-white/10">
                        <td className="py-2 pr-3 text-white/85">{x.waktu}</td>
                        <td className="py-2 pr-3 font-semibold text-white">{formatRupiah(x.nominal)}</td>
                        <td className="py-2 pr-3 text-white/75">{x.ref}</td>
                        <td className="py-2 text-white/85">
                          {x.kandidat.length === 0 ? "Tidak ada" : x.kandidat.map((k) => <span key={k} className="mr-3">{orderLink(k.split(" ")[0])} {k.slice(k.indexOf(" "))}</span>)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className={kotak}>
            <h2 className="font-display text-xl text-white uppercase">Order lunas tanpa uang di laporan ({h.tanpaUang.length})</h2>
            <p className="mt-1 text-sm text-white/75">Sudah ditandai lunas, tetapi nominalnya tidak ada di laporan ini. Cek bukti bayarnya.</p>
            {h.tanpaUang.length > 0 && (
              <ul className="mt-4 space-y-2 text-sm text-white/85">
                {h.tanpaUang.map((o) => (
                  <li key={o.orderId + o.nominal}>{orderLink(o.orderId)} {o.nama} <span className="font-semibold text-white">{formatRupiah(o.nominal)}</span>{o.uji && " (data uji)"}</li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
