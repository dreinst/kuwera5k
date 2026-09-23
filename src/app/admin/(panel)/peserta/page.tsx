import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { PAGE_SIZE, STATUS_LABEL, fmtDateTime, listRegistrants, maskNik } from "@/lib/admin-data";
import { formatRupiah } from "@/lib/registration";
import AutoRefresh from "@/components/admin/AutoRefresh";
import { StatusBadge } from "@/components/admin/Badges";

export const metadata: Metadata = { title: "Peserta" };
export const dynamic = "force-dynamic";

type Search = { q?: string; status?: string; page?: string };

export default async function PesertaPage({ searchParams }: { searchParams: Promise<Search> }) {
  const admin = await requireAdmin();
  const { q = "", status = "", page: pageRaw = "1" } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageRaw, 10) || 1);
  const { total, rows } = await listRegistrants(q, status, page);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const link = (p: number) => `/admin/peserta?${new URLSearchParams({ ...(q ? { q } : {}), ...(status ? { status } : {}), page: String(p) })}`;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-4xl text-white uppercase">Data <span className="text-brand-yellow">peserta</span></h1>
        <AutoRefresh />
      </div>

      <form className="mt-6 flex flex-wrap gap-3" action="/admin/peserta">
        <input
          name="q" defaultValue={q} placeholder="Cari nama, email, HP, NIK, atau nomor order"
          className="min-w-[260px] flex-1 rounded-full border border-glass-border bg-card px-5 py-3 text-sm text-white placeholder:text-white/60 focus:border-brand-yellow focus:outline-none"
        />
        <select name="status" defaultValue={status} className="rounded-full border border-glass-border bg-card px-5 py-3 text-sm text-white [&>option]:bg-green-deep">
          <option value="">Semua status</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button type="submit" className="rounded-full bg-brand-yellow px-6 py-3 text-sm font-semibold text-green-deep">Cari</button>
        {admin.role === "admin" && (
          <a href={`/admin/export?${new URLSearchParams({ ...(q ? { q } : {}), ...(status ? { status } : {}) })}`} className="rounded-full border border-brand-yellow px-6 py-3 text-sm font-semibold text-brand-yellow">
            Unduh CSV
          </a>
        )}
      </form>

      <p className="mt-4 text-sm text-white/75">{total.toLocaleString("id-ID")} order ditemukan</p>

      <div className="mt-3 overflow-x-auto rounded-[20px] border border-glass-border bg-card">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-white/5 text-xs text-white/70 uppercase">
            <tr>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Peserta</th>
              <th className="px-4 py-3">NIK</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Jersey</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Daftar</th>
              <th className="px-4 py-3">Race pack</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-white/70">Belum ada data yang cocok.</td></tr>
            )}
            {rows.map((o) => (
              <tr key={o.id} className="border-t border-white/10 hover:bg-white/5">
                <td className="px-4 py-3 font-mono"><Link href={`/admin/peserta/${o.id}`} className="text-brand-yellow hover:underline">{o.id}</Link></td>
                <td className="px-4 py-3">
                  <p className="font-medium text-white">{o.participant?.fullName ?? "-"}</p>
                  <p className="text-xs text-white/70">{o.buyerEmail} &middot; {o.buyerPhone}</p>
                </td>
                <td className="px-4 py-3 font-mono text-white/85">{maskNik(o.participant?.idNumber)}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={o.status} />
                  {o.payments.some((p) => p.gateway !== "midtrans") && o.status === "PAID" && <p className="mt-1 text-[10px] text-gold uppercase">{o.payments[0]?.gateway}</p>}
                </td>
                <td className="px-4 py-3 text-white">{o.participant?.jerseySize ?? "-"}</td>
                <td className="px-4 py-3 text-white">{formatRupiah(o.total)}</td>
                <td className="px-4 py-3 text-white/80">{fmtDateTime(o.createdAt)}</td>
                <td className="px-4 py-3 text-white/85">{o.ticket?.racepackCollectedAt ? "Sudah" : o.status === "PAID" ? "Belum" : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          {page > 1 ? <Link href={link(page - 1)} className="text-brand-yellow hover:underline">Sebelumnya</Link> : <span />}
          <span className="text-white/75">Halaman {page} dari {pages}</span>
          {page < pages ? <Link href={link(page + 1)} className="text-brand-yellow hover:underline">Berikutnya</Link> : <span />}
        </div>
      )}
    </div>
  );
}
