import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FINANCE, SCAN, SUPER, allowed, requireAdmin } from "@/lib/admin-auth";
import { fmtDateTime } from "@/lib/admin-data";
import { prisma } from "@/lib/db";
import { PAYMENT_METHODS, formatRupiah } from "@/lib/registration";
import { StatusBadge } from "@/components/admin/Badges";
import MidtransPanel from "@/components/admin/MidtransPanel";
import RacepackButton from "@/components/admin/RacepackButton";
import ManualPayPanel from "@/components/admin/ManualPayPanel";
import { MANUAL_GATEWAY, expireStaleOrders } from "@/lib/orders";

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
  const admin = await requireAdmin(FINANCE);
  const { id } = await params;
  await expireStaleOrders();
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      participants: { orderBy: { position: "asc" }, include: { ticket: true } },
      payments: { orderBy: { receivedAt: "desc" } }, category: { select: { name: true } },
      proofs: { orderBy: { createdAt: "asc" }, select: { id: true, fileName: true, mimeType: true, createdAt: true, note: true } },
    },
  });
  if (!order) notFound();
  const buyer = order.participants[0];
  // Order bayar manual: QRIS tanpa Snap, belum ada pembayaran Midtrans.
  const manualOrder = order.uniqueCode > 0 || order.source === "kudam" || order.payments.some((x) => x.gateway === MANUAL_GATEWAY);
  const verifiedBy = (order.payments.find((x) => x.gateway === MANUAL_GATEWAY)?.rawPayload as { verifiedBy?: string } | undefined)?.verifiedBy;
  const method = PAYMENT_METHODS.find((m) => m.id === order.paymentMethod)?.label ?? order.paymentMethod;
  const usesMidtrans = !!order.snapToken || order.payments.some((x) => x.gateway.startsWith("midtrans"));

  return (
    <div className="space-y-6">
      <Link href="/kuweraadmin/peserta" className="text-sm text-brand-yellow hover:underline">Kembali ke daftar peserta</Link>
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="font-display text-4xl text-white uppercase">{buyer?.fullName ?? order.id}</h1>
        <StatusBadge status={order.status} test={order.isTest} />
      </div>
      <p className="font-mono text-white/80">{order.id} &middot; {order.category.name} &middot; {order.quantity} tiket</p>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          {order.participants.map((p) => (
            <Section key={p.id} title={order.quantity > 1 ? `Peserta ${p.position}${p.position === 1 ? " (pemesan)" : ""}` : "Data peserta"}>
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
              <div className="mt-5 border-t border-white/10 pt-4">
                <p className="text-xs font-semibold tracking-wide text-gold uppercase">Race pack</p>
                {p.ticket ? (
                  <>
                    <figure className="mt-3 w-44">
                      <a href={`/kuweraadmin/berkas/qr/${p.ticket.code}`} target="_blank" rel="noopener noreferrer" className="block rounded-xl bg-white p-2">
                        {/* eslint-disable-next-line @next/next/no-img-element -- PNG dari route admin */}
                        <img src={`/kuweraadmin/berkas/qr/${p.ticket.code}`} alt={`QR registrasi ulang ${p.ticket.code}`} width={600} height={600} className="h-auto w-full" />
                      </a>
                      <figcaption className="mt-2 text-xs text-white/75">
                        <span className="block font-semibold text-white">QR registrasi ulang</span>
                        <a href={`/kuweraadmin/berkas/qr/${p.ticket.code}?unduh=1`} className="mt-1 inline-block rounded-full border border-brand-yellow px-4 py-1.5 text-sm font-semibold text-brand-yellow">Unduh QR</a>
                      </figcaption>
                    </figure>
                    <p className="mt-3 text-white/85">
                      Kode tiket <span className="font-mono text-white">{p.ticket.code}</span>
                      {p.ticket.racepackCollectedAt
                        ? <> &middot; diambil {fmtDateTime(p.ticket.racepackCollectedAt)} (dicatat {p.ticket.collectedBy})</>
                        : <> &middot; belum diambil</>}
                    </p>
                    {allowed(admin.role, SCAN) && (
                      <div className="mt-3">
                        <RacepackButton ticketCode={p.ticket.code} collected={!!p.ticket.racepackCollectedAt} canUndo={allowed(admin.role, SUPER)} />
                      </div>
                    )}
                  </>
                ) : <p className="mt-2 text-white/75">Tiket terbit setelah pembayaran lunas.</p>}
              </div>
            </Section>
          ))}
        </div>

        <div className="space-y-6">
          <Section title="Pembayaran">
            <dl className="grid gap-4 sm:grid-cols-2">
              <Item k="Metode" v={method} />
              <Item k="Harga tiket" v={`${formatRupiah(order.subtotal)}${order.quantity > 1 ? ` (${order.quantity} tiket)` : ""}`} />
              {order.uniqueCode > 0 && <Item k="Kode unik" v={formatRupiah(order.uniqueCode)} />}
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

          {(manualOrder || order.proofs.length > 0) && (
            <Section title="Bukti bayar">
              {order.proofs.length === 0 ? (
                <p className="text-white/75">Belum ada bukti bayar yang diunggah pemesan.</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {order.proofs.map((f) => (
                    <figure key={f.id}>
                      {f.mimeType.startsWith("image/") ? (
                        <a href={`/kuweraadmin/berkas/bukti/${f.id}`} target="_blank" rel="noopener noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element -- gambar dari database lewat route admin */}
                          <img src={`/kuweraadmin/berkas/bukti/${f.id}`} alt={`Bukti bayar ${order.id}`} className="max-h-80 w-full rounded-lg bg-white/5 object-contain" />
                        </a>
                      ) : <p className="text-sm text-white/80">{f.fileName}</p>}
                      <figcaption className="mt-2 text-xs text-white/75">
                        {f.note && <span className="mb-1 block text-sm font-semibold text-white">{f.note}</span>}
                        <span className="block">{fmtDateTime(f.createdAt)}</span>
                        <a href={`/kuweraadmin/berkas/bukti/${f.id}?unduh=1`} className="mt-1 inline-block rounded-full border border-brand-yellow px-4 py-1.5 text-sm font-semibold text-brand-yellow">Unduh bukti</a>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              )}
            </Section>
          )}

          {manualOrder ? (
            <Section title="Konfirmasi bayar QRIS">
              {order.status === "PAID" ? (
                <p className="text-white/85">Sudah lunas, dikonfirmasi oleh {verifiedBy ?? "admin"}.</p>
              ) : order.status === "PENDING" || order.status === "EXPIRED" ? (
                <ManualPayPanel orderId={order.id} total={order.total} />
              ) : (
                <p className="text-white/75">Menunggu admin mengecek pembayaran di GoPay Merchant.</p>
              )}
            </Section>
          ) : (
            <Section title="Verifikasi Midtrans">
              {usesMidtrans ? (
                <MidtransPanel orderId={order.id} canSync={order.status === "PENDING" || order.status === "FAILED"} />
              ) : (
                <p className="text-white/75">Order ini belum pernah membuka pembayaran Midtrans{order.payments.length ? " (dibayar lewat simulasi)" : ""}.</p>
              )}
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}
