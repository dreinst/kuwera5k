import type { Metadata } from "next";
import Link from "next/link";
import { FINANCE, requireAdmin } from "@/lib/admin-auth";
import { dashboardStats, fmtDateTime } from "@/lib/admin-data";
import { formatRupiah } from "@/lib/registration";
import { StatusBadge } from "@/components/admin/Badges";
import GopayRincian from "@/components/admin/GopayRincian";
import { gopayRincian } from "@/lib/gopay-rincian";

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
    <section className="flex flex-col rounded-[20px] border border-glass-border bg-card p-6">
      <h2 className="font-display text-xl text-white uppercase">{title}</h2>
      <div className="mt-4 flex flex-1 flex-col">{children}</div>
    </section>
  );
}

export default async function DashboardPage() {
  const admin = await requireAdmin(FINANCE);
  // Semua angka GoPay (total masuk, kode unik, penarikan, rincian) hanya untuk superadmin; admin keuangan cukup pendapatan tiket.
  const superadmin = admin.role === "superadmin";
  const [s, rincian] = await Promise.all([dashboardStats(), superadmin ? gopayRincian() : null]);
  const maxDaily = Math.max(1, ...s.daily.map((d) => d.count));
  const maxJersey = Math.max(1, ...s.jersey.map((j) => j.count));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-wide text-gold uppercase">KUWERA Fun Run 5K</p>
          <h1 className="font-display mt-1 text-4xl text-white uppercase">Dashboard <span className="text-brand-yellow">pendaftar</span></h1>
        </div>
        {superadmin && <div className="text-right">
          <p className="text-sm text-white/85">
            Payment gateway:{" "}
            {s.mode.payment === "manual" ? (
              <span className="font-semibold text-yellow-lime">GoPay Merchant (QRIS dinamis)</span>
            ) : s.mode.payment === "midtrans" ? (
              <span className={`font-semibold ${s.mode.production ? "text-yellow-lime" : "text-brand-yellow"}`}>Midtrans {s.mode.production ? "Production" : "Sandbox"}</span>
            ) : (
              <span className="font-semibold text-brand-yellow">{s.mode.payment === "mock" ? "simulasi" : "nonaktif"}</span>
            )}
          </p>
        </div>}
      </div>

      <div className={`grid gap-4 sm:grid-cols-2 ${superadmin ? "lg:grid-cols-4" : "lg:grid-cols-5"}`}>
        <Stat accent label="Peserta lunas" value={s.paid.toLocaleString("id-ID")} note={`Sisa kuota ${s.remaining.toLocaleString("id-ID")} dari ${s.quotaTotal.toLocaleString("id-ID")}`} />
        <Stat label="Menunggu bayar" value={s.activePending.toLocaleString("id-ID")} note="Masih dalam batas waktu bayar" />
        <Stat label="Kedaluwarsa / gagal" value={(s.expired + s.failed + s.staleOrders).toLocaleString("id-ID")} note={`${s.expired} kedaluwarsa, ${s.failed} gagal`} />
        <Stat label="Race pack diambil" value={s.collected.toLocaleString("id-ID")} note={`dari ${s.paid.toLocaleString("id-ID")} peserta lunas`} />
        {!superadmin && <Stat label="Pendapatan tiket" value={formatRupiah(s.revenueTicket)} note="Harga tiket, tanpa kode unik" />}
      </div>

      {superadmin && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Pendapatan tiket" value={formatRupiah(s.revenueTicket)} note="Harga tiket, tanpa kode unik" />
        {superadmin && <Stat label="Kode unik terkumpul" value={formatRupiah(s.uniqueCodes)} note="Untuk menutup potongan tarik GoPay" />}
        {superadmin && <Stat label="Total masuk GoPay" value={formatRupiah(s.revenueTotal)} note="Sesuai nominal di GoPay Merchant" />}
        {superadmin && <Stat label="Sudah ditarik" value={formatRupiah(s.penarikan.masuk)}
          note={s.penarikan.saldo ? `Potongan tarik ${formatRupiah(s.penarikan.potongan)}, saldo belum ditarik ${formatRupiah(s.revenueTotal - s.penarikan.saldo)}` : "Belum ada penarikan tercatat"} />}
      </div>}

      {rincian && <GopayRincian d={rincian} />}

      <Card title="Peserta per harga tiket">
        <div className="flex h-3 overflow-hidden rounded-full bg-white/10">
          {s.priceTiers.map((t, i) => (
            <div key={`${t.kudam}-${t.price}`} className={i % 2 ? "bg-white" : "bg-brand-yellow"} style={{ width: `${(t.tiket / Math.max(1, s.paid)) * 100}%` }} />
          ))}
        </div>
        <div className={`mt-4 grid gap-4 ${s.priceTiers.length > 2 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
          {s.priceTiers.length === 0 ? <p className="text-white/70">Belum ada peserta lunas.</p> : s.priceTiers.map((t, i) => (
            <div key={`${t.kudam}-${t.price}`} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-white/75 uppercase">
                <span className={`h-2.5 w-2.5 rounded-full ${i % 2 ? "bg-white" : "bg-brand-yellow"}`} />{t.label} &middot; {formatRupiah(t.price)}
              </p>
              <p className="mt-1 text-white/85"><span className="font-display text-4xl text-white">{t.tiket}</span> peserta</p>
              <p className="text-sm text-white/70">{t.transaksi} transaksi, {Math.round((t.tiket / Math.max(1, s.paid)) * 100)}% dari peserta lunas</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Pendaftar lunas 14 hari terakhir">
          {/* Grafik mengisi sisa tinggi kartu (sejajar dengan kartu jersey di sebelahnya). */}
          <div className="flex min-h-40 flex-1 gap-1.5">
            {s.daily.map((d) => (
              <div key={d.key} className="flex flex-1 flex-col items-center gap-1" title={`${d.label}: ${d.count}`}>
                <span className="text-[10px] text-white/80">{d.count || "\u00a0"}</span>
                <div className="relative w-full flex-1">
                  <div className="absolute inset-x-0 bottom-0 rounded-t-md bg-brand-yellow" style={{ height: `${(d.count / maxDaily) * 100}%`, minHeight: d.count ? 4 : 1 }} />
                </div>
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
          <div className="space-y-4">
            {([["Laki-laki", s.gender.L], ["Perempuan", s.gender.P]] as const).map(([label, n]) => {
              const pct = Math.round((n / Math.max(1, s.gender.L + s.gender.P)) * 100);
              return (
                <div key={label}>
                  <div className="flex items-baseline justify-between text-white/85">
                    <span>{label}</span>
                    <span><span className="font-display text-2xl text-brand-yellow">{n}</span> <span className="text-sm text-white/65">{pct}%</span></span>
                  </div>
                  <div className="mt-1 h-3 rounded-full bg-white/10"><div className="h-3 rounded-full bg-brand-yellow" style={{ width: `${pct}%` }} /></div>
                </div>
              );
            })}
          </div>
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
                    <td className="py-2 pr-4 font-mono"><Link href={`/kuweraadmin/peserta/${o.id}`} className="text-brand-yellow hover:underline">{o.id}</Link></td>
                    <td className="py-2 pr-4 text-white">{o.participants[0]?.fullName ?? "-"}{o.quantity > 1 ? ` +${o.quantity - 1}` : ""}</td>
                    <td className="py-2 pr-4"><StatusBadge status={o.status} test={o.isTest} /></td>
                    <td className="py-2 text-white/75">{fmtDateTime(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Link href="/kuweraadmin/peserta" className="mt-4 inline-block text-sm font-semibold text-brand-yellow hover:underline">Lihat semua peserta</Link>
      </Card>
    </div>
  );
}
