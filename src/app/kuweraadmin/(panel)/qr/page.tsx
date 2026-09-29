import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { fmtDateTime } from "@/lib/admin-data";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "QR & bukti bayar" };
export const dynamic = "force-dynamic";

// Database QR registrasi ulang dan bukti bayar, seperti halaman QR Pet Blessing: lihat, unduh satu per satu, atau unduh
// semua sekaligus (ZIP). Gambar dimuat dari /kuweraadmin/berkas, jadi halaman ini tidak memuat data gambar sendiri.
export default async function QrPage() {
  const admin = await requireAdmin();
  const orders = await prisma.order.findMany({
    where: { OR: [{ status: "PAID" }, { proofs: { some: {} } }] },
    orderBy: { createdAt: "desc" },
    include: {
      participants: { orderBy: { position: "asc" }, include: { ticket: { select: { code: true } } } },
      proofs: { orderBy: { createdAt: "asc" }, select: { id: true, fileName: true, mimeType: true, createdAt: true } },
    },
  });
  const tickets = orders.reduce((n, o) => n + o.participants.filter((p) => p.ticket).length, 0);
  const proofs = orders.reduce((n, o) => n + o.proofs.length, 0);

  return (
    <div>
      <h1 className="font-display text-4xl text-white uppercase">QR &amp; <span className="text-brand-yellow">bukti bayar</span></h1>
      <p className="mt-3 text-sm text-white/75">
        {tickets.toLocaleString("id-ID")} QR registrasi ulang dan {proofs.toLocaleString("id-ID")} bukti bayar dari {orders.length.toLocaleString("id-ID")} order.
      </p>
      {admin.role === "admin" && (
        <div className="mt-5 flex flex-wrap gap-3">
          <a href="/kuweraadmin/berkas/zip?jenis=qr" className="rounded-full bg-brand-yellow px-6 py-3 text-sm font-semibold text-green-deep">Unduh semua QR (ZIP)</a>
          <a href="/kuweraadmin/berkas/zip?jenis=bukti" className="rounded-full border border-brand-yellow px-6 py-3 text-sm font-semibold text-brand-yellow">Unduh semua bukti bayar (ZIP)</a>
        </div>
      )}

      <div className="mt-6 space-y-5">
        {orders.length === 0 && <p className="rounded-[20px] border border-glass-border bg-card p-6 text-white/75">Belum ada order lunas atau bukti bayar.</p>}
        {orders.map((o) => (
          <section key={o.id} className="rounded-[20px] border border-glass-border bg-card p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <Link href={`/kuweraadmin/peserta/${o.id}`} className="font-mono text-brand-yellow hover:underline">{o.id}</Link>
              <p className="text-sm text-white/75">{o.participants[0]?.fullName} &middot; {o.status === "PAID" ? `lunas ${fmtDateTime(o.paidAt)}` : "belum lunas"}</p>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {o.participants.filter((p) => p.ticket).map((p) => (
                <figure key={p.id} className="rounded-2xl bg-white p-3 text-green-deep">
                  {/* eslint-disable-next-line @next/next/no-img-element -- PNG dari route admin, bukan aset statis */}
                  <img src={`/kuweraadmin/berkas/qr/${p.ticket!.code}`} alt={`QR ${p.ticket!.code}`} width={600} height={600} loading="lazy" className="h-auto w-full" />
                  <figcaption className="mt-2 text-xs">
                    <span className="block font-semibold">{p.fullName}</span>
                    <span className="block font-mono">{p.ticket!.code}</span>
                    <a href={`/kuweraadmin/berkas/qr/${p.ticket!.code}?unduh=1`} className="mt-1 inline-block font-semibold underline">Unduh QR</a>
                  </figcaption>
                </figure>
              ))}
              {o.proofs.map((f) => (
                <figure key={f.id} className="rounded-2xl border border-glass-border bg-white/5 p-3">
                  {f.mimeType.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element -- gambar dari database lewat route admin
                    <img src={`/kuweraadmin/berkas/bukti/${f.id}`} alt={`Bukti bayar ${o.id}`} loading="lazy" className="max-h-72 w-full rounded-lg object-contain" />
                  ) : (
                    <p className="py-10 text-center text-sm text-white/75">{f.fileName}</p>
                  )}
                  <figcaption className="mt-2 text-xs text-white/80">
                    <span className="block font-semibold text-white">Bukti bayar</span>
                    <span className="block">{fmtDateTime(f.createdAt)}</span>
                    <a href={`/kuweraadmin/berkas/bukti/${f.id}?unduh=1`} className="mt-1 inline-block font-semibold text-brand-yellow underline">Unduh bukti</a>
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
