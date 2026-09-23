import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { fmtDateTime } from "@/lib/admin-data";
import { prisma } from "@/lib/db";
import { PAYMENT_METHODS, formatRupiah } from "@/lib/registration";
import { StatusBadge } from "@/components/admin/Badges";
import MidtransPanel from "@/components/admin/MidtransPanel";
import RacepackButton from "@/components/admin/RacepackButton";

export const metadata: Metadata = { title: "Detail peserta" };
export const dynamic = "force-dynamic";

function Item({ k, v, mono = false }: { k: string; v: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-white/65">{k}</dt>
      <dd className={`mt-0.5 text-white ${mono ? "font-mono" : ""}`}>{v || "-"}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[20px] border border-glass-border bg-card p-6">
      <h2 className="font-display text-xl text-white uppercase">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function PesertaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: { participant: true, ticket: true, payments: { orderBy: { receivedAt: "desc" } }, category: { select: { name: true } } },
  });
  if (!order) notFound();
  const p = order.participant;
  const method = PAYMENT_METHODS.find((m) => m.id === order.paymentMethod)?.label ?? order.paymentMethod;
  const usesMidtrans = !!order.snapToken || order.payments.some((x) => x.gateway.startsWith("midtrans"));

  return (
    <div className="space-y-6">
      <Link href="/admin/peserta" className="text-sm text-brand-yellow hover:underline">Kembali ke daftar peserta</Link>
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="font-display text-4xl text-white uppercase">{p?.fullName ?? order.id}</h1>
        <StatusBadge status={order.status} />
      </div>
      <p className="font-mono text-white/80">{order.id} &middot; {order.category.name}</p>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Data peserta">
          {p ? (
            <dl className="grid gap-4 sm:grid-cols-2">
              <Item k="Nama depan" v={p.firstName ?? p.fullName} />
              <Item k="Nama belakang" v={p.lastName} />
              <Item k="Nomor identitas (NIK)" v={p.idNumber} mono />
              <Item k="Tanggal lahir" v={p.birthDate.toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "long", year: "numeric" })} />
              <Item k="Jenis kelamin" v={p.gender === "L" ? "Laki-laki" : "Perempuan"} />
              <Item k="Golongan darah" v={p.bloodType} />
              <Item k="Email" v={p.email} />
              <Item k="Nomor HP" v={p.phone} />
              <div className="sm:col-span-2"><Item k="Alamat" v={[p.address, p.city, p.province, p.postalCode].filter(Boolean).join(", ")} /></div>
              <Item k="Kontak darurat" v={`${p.emergencyName} (${p.emergencyPhone})`} />
              <Item k="Ukuran jersey" v={p.jerseySize} />
              <Item k="Komunitas" v={p.community} />
            </dl>
          ) : <p className="text-white/70">Data peserta tidak ada.</p>}
        </Section>

        <div className="space-y-6">
          <Section title="Pembayaran">
            <dl className="grid gap-4 sm:grid-cols-2">
              <Item k="Metode" v={method} />
              <Item k="Harga tiket" v={formatRupiah(order.subtotal)} />
              <Item k="Diskon" v={order.discount ? `${formatRupiah(order.discount)} (${order.promoCode})` : "-"} />
              <Item k="Biaya layanan" v={formatRupiah(order.fee)} />
              <Item k="Total" v={formatRupiah(order.total)} />
              <Item k="Didaftarkan" v={fmtDateTime(order.createdAt)} />
              <Item k="Batas bayar" v={fmtDateTime(order.expiresAt)} />
              <Item k="Lunas" v={fmtDateTime(order.paidAt)} />
            </dl>
            {order.payments.length > 0 && (
              <div className="mt-5 border-t border-white/10 pt-4 text-sm">
                <p className="text-xs font-semibold tracking-wide text-gold uppercase">Catatan pembayaran</p>
                {order.payments.map((x) => (
                  <p key={x.id} className="mt-2 text-white/85">
                    {fmtDateTime(x.receivedAt)} &middot; {x.gateway} &middot; {x.method} &middot; {formatRupiah(x.amount)}
                    {x.gatewayRef && <span className="block font-mono text-xs text-white/65">ID transaksi {x.gatewayRef}</span>}
                  </p>
                ))}
              </div>
            )}
          </Section>

          <Section title="Verifikasi Midtrans">
            {usesMidtrans ? (
              <MidtransPanel orderId={order.id} canSync={order.status === "PENDING" || order.status === "FAILED"} />
            ) : (
              <p className="text-white/75">Order ini belum pernah membuka pembayaran Midtrans{order.payments.length ? " (dibayar lewat simulasi)" : ""}.</p>
            )}
          </Section>

          <Section title="Race pack">
            {order.ticket ? (
              <>
                <p className="text-white/85">
                  Kode tiket <span className="font-mono text-white">{order.ticket.code}</span>
                  {order.ticket.racepackCollectedAt
                    ? <> &middot; diambil {fmtDateTime(order.ticket.racepackCollectedAt)} (dicatat {order.ticket.collectedBy})</>
                    : <> &middot; belum diambil</>}
                </p>
                <p className="mt-2 text-sm text-white/70">Cocokkan nama dan NIK di atas dengan KTP atau KIA asli sebelum menandai.</p>
                <div className="mt-4">
                  <RacepackButton orderId={order.id} collected={!!order.ticket.racepackCollectedAt} canUndo={admin.role === "admin"} />
                </div>
              </>
            ) : <p className="text-white/75">Tiket terbit setelah pembayaran lunas.</p>}
          </Section>
        </div>
      </div>
    </div>
  );
}
