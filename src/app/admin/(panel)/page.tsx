import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { dashboardStats, fmtDateTime } from "@/lib/admin-data";
import { prisma } from "@/lib/db";
import { formatRupiah } from "@/lib/registration";
import AutoRefresh from "@/components/admin/AutoRefresh";
import { StatusBadge } from "@/components/admin/Badges";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

function Stat({ label, value, note, accent = false }: { label: string; value: string; note?: string; accent?: boolean }) {
  return (
    <div className={`rounded-[20px] p-5 ${accent ? "text-green-deep" : "border border-glass-border bg-card text-white"}`}
      style={accent ? { background: "linear-gradient(135deg, #F4E71D 0%, #C6DA2A 50%, #8DBF2A 100%)" } : undefined}>
      <p className={`text-xs font-semibold tracking-wide uppercase ${accent ? "text-green-deep" : "text-white/75"}`}>{label}</p>
      <p className="font-display mt-1 text-4xl">{value}</p>
      {note && <p className={`mt-1 text-sm ${accent ? "font-medium text-green-deep" : "text-white/75"}`}>{note}</p>}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[20px] border border-glass-border bg-card p-6">
      <h2 className="font-display text-xl text-white uppercase">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function DashboardPage() {
  const admin = await requireAdmin();
  const s = await dashboardStats();
  const logs = admin.role === "admin" ? await prisma.adminLog.findMany({ orderBy: { createdAt: "desc" }, take: 10 }) : [];
  const maxDaily = Math.max(1, ...s.daily.map((d) => d.count));
  const maxJersey = Math.max(1, ...s.jersey.map((j) => j.count));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-wide text-gold uppercase">KUWERA Fun Run 5K</p>
          <h1 className="font-display mt-1 text-4xl text-white uppercase">Dashboard <span className="text-brand-yellow">pendaftar</span></h1>
        </div>
        <div className="text-right">
          <p className="text-sm text-white/85">
            Midtrans: <span className={`font-semibold ${s.mode.production ? "text-yellow-lime" : "text-brand-yellow"}`}>{s.mode.production ? "Production" : "Sandbox"}</span>
            {" "}&middot; mode bayar <span className="font-semibold">{s.mode.payment}</span>
          </p>
          <AutoRefresh />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat accent label="Peserta lunas" value={s.paid.toLocaleString("id-ID")} note={`Sisa kuota ${s.remaining.toLocaleString("id-ID")} dari ${s.quotaTotal.toLocaleString("id-ID")}`} />
        <Stat label="Menunggu bayar" value={s.activePending.toLocaleString("id-ID")} note="Masih dalam batas waktu bayar" />
        <Stat label="Kedaluwarsa / gagal" value={(s.expired + s.failed + s.staleOrders).toLocaleString("id-ID")} note={`${s.expired} kedaluwarsa, ${s.failed} gagal`} />
        <Stat label="Race pack diambil" value={s.collected.toLocaleString("id-ID")} note={`dari ${s.paid.toLocaleString("id-ID")} peserta lunas`} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Pendapatan tiket" value={formatRupiah(s.revenueTicket)} note="Harga tiket dikurangi diskon" />
        <Stat label="Biaya layanan" value={formatRupiah(s.revenueFee)} note="Dibayar peserta, untuk Midtrans" />
        <Stat label="Total diterima" value={formatRupiah(s.revenueTotal)} note="Sesuai nominal di Midtrans" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Pendaftar lunas 14 hari terakhir">
          <div className="flex h-40 items-end gap-1.5">
            {s.daily.map((d) => (
              <div key={d.key} className="flex flex-1 flex-col items-center gap-1" title={`${d.label}: ${d.count}`}>
                <span className="text-[10px] text-white/80">{d.count || ""}</span>
                <div className="w-full rounded-t-md bg-brand-yellow" style={{ height: `${(d.count / maxDaily) * 100}%`, minHeight: d.count ? 4 : 1 }} />
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-white/65"><span>{s.daily[0].label}</span><span>{s.daily[13].label}</span></div>
        </Card>

        <Card title="Rekap ukuran jersey (lunas)">
          <div className="space-y-2">
            {s.jersey.map((j) => (
              <div key={j.size} className="flex items-center gap-3 text-sm">
                <span className="w-10 font-semibold text-white">{j.size}</span>
                <div className="h-3 flex-1 rounded-full bg-white/10">
                  <div className="h-3 rounded-full bg-brand-yellow" style={{ width: `${(j.count / maxJersey) * 100}%` }} />
                </div>
                <span className="w-10 text-right text-white/85">{j.count}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Jenis kelamin">
          <p className="text-white/85">Laki-laki <span className="font-display text-2xl text-brand-yellow">{s.gender.L}</span></p>
          <p className="mt-1 text-white/85">Perempuan <span className="font-display text-2xl text-brand-yellow">{s.gender.P}</span></p>
        </Card>
        <Card title="Golongan darah">
          {s.blood.length === 0 ? <p className="text-white/70">Belum ada data</p> : s.blood.map((b) => (
            <p key={b.type} className="text-white/85">{b.type}: <span className="font-semibold text-white">{b.count}</span></p>
          ))}
        </Card>
        <Card title="Kota terbanyak">
          {s.cities.length === 0 ? <p className="text-white/70">Belum ada data</p> : s.cities.map((c) => (
            <p key={c.city} className="text-white/85">{c.city}: <span className="font-semibold text-white">{c.count}</span></p>
          ))}
        </Card>
      </div>

      <Card title="Pendaftaran terbaru">
        {s.recent.length === 0 ? <p className="text-white/70">Belum ada pendaftaran.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <tbody>
                {s.recent.map((o) => (
                  <tr key={o.id} className="border-t border-white/10 first:border-0">
                    <td className="py-2 pr-4 font-mono"><Link href={`/admin/peserta/${o.id}`} className="text-brand-yellow hover:underline">{o.id}</Link></td>
                    <td className="py-2 pr-4 text-white">{o.participant?.fullName ?? "-"}</td>
                    <td className="py-2 pr-4"><StatusBadge status={o.status} /></td>
                    <td className="py-2 text-white/75">{fmtDateTime(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Link href="/admin/peserta" className="mt-4 inline-block text-sm font-semibold text-brand-yellow hover:underline">Lihat semua peserta</Link>
      </Card>

      {admin.role === "admin" && (
        <Card title="Aktivitas admin">
          {logs.length === 0 ? <p className="text-white/70">Belum ada aktivitas.</p> : (
            <ul className="space-y-1 text-sm">
              {logs.map((l) => (
                <li key={l.id} className="text-white/85">
                  <span className="text-white/65">{fmtDateTime(l.createdAt)}</span> &middot; <span className="font-semibold text-white">{l.username}</span> {l.action.replace(/_/g, " ")}{l.target ? ` (${l.target})` : ""}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
