import type { Metadata } from "next";
import Link from "next/link";
import { SUPER, requireAdmin } from "@/lib/admin-auth";
import { fmtDateTime } from "@/lib/admin-data";
import { prisma } from "@/lib/db";
import { formatRupiah } from "@/lib/registration";
import { REFUND_STATUS_LABEL, getRefund, refundAmount, refundBatas, refundLink, tglPanjang, type RefundStatus } from "@/lib/refund";
import RefundAksi, { SalinTautan } from "@/components/admin/RefundAksi";

export const metadata: Metadata = { title: "Refund" };
export const dynamic = "force-dynamic";

// Urutan tampil: yang menunggu transfer paling atas (pengajuan terlama dulu), lalu perbaikan, belum mengajukan, selesai.
const URUTAN = ["DIAJUKAN", "PERLU_PERBAIKAN", "BELUM", "SELESAI"] as const;
type Kelompok = (typeof URUTAN)[number];
const LABEL: Record<Kelompok, string> = { ...REFUND_STATUS_LABEL, DIAJUKAN: "Menunggu transfer", BELUM: "Belum mengajukan" };
const CLS: Record<Kelompok, string> = {
  DIAJUKAN: "bg-brand-yellow text-green-deep", PERLU_PERBAIKAN: "bg-red-500/25 text-red-100", BELUM: "bg-white/15 text-white", SELESAI: "bg-gold/25 text-cream",
};

export default async function RefundAdminPage() {
  await requireAdmin(SUPER);
  const cfg = await getRefund();
  if (!cfg) {
    return (
      <div>
        <h1 className="font-display text-4xl text-white uppercase">Refund</h1>
        <p className="mt-3 max-w-2xl text-white/80">Halaman refund belum dinyalakan. Jalankan tools/sql/2026-10-09-refund-setting.sql saat pembatalan diumumkan.</p>
      </div>
    );
  }
  const orders = await prisma.order.findMany({
    where: { status: { in: ["PAID", "REFUNDED"] } },
    include: {
      participants: { orderBy: { position: "asc" }, select: { fullName: true, phone: true, ticket: { select: { code: true } } } },
      refund: { omit: { proofData: true } },
    },
    orderBy: { paidAt: "asc" },
  });
  const rows = orders
    .map((o) => {
      const kelompok: Kelompok = (o.refund?.status as RefundStatus | undefined) ?? "BELUM";
      return { o, kelompok, nominal: o.refund?.status === "SELESAI" ? o.refund.amount : refundAmount(cfg, o) };
    })
    .sort((a, b) => URUTAN.indexOf(a.kelompok) - URUTAN.indexOf(b.kelompok)
      || (a.o.refund?.submittedAt.getTime() ?? 0) - (b.o.refund?.submittedAt.getTime() ?? 0));
  const asli = rows.filter((x) => !x.o.isTest);
  const batas = refundBatas(cfg);

  return (
    <div>
      <h1 className="font-display text-4xl text-white uppercase">Refund <span className="text-brand-yellow">pembatalan</span></h1>
      <p className="mt-3 max-w-2xl text-white/80">
        Dana dikembalikan 100% dari saldo GoPay, termasuk kode unik. Transfer sesuai rekening di tiap pengajuan, lalu unggah bukti transfernya.
        Bukti itu dikirim ke email pemesan dan order berubah menjadi Refund.{batas ? ` Pengajuan dibuka sampai ${tglPanjang(batas)}.` : ""}
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {URUTAN.map((k) => {
          const grup = asli.filter((x) => x.kelompok === k);
          return (
            <div key={k} className="rounded-[20px] border border-glass-border bg-card p-5">
              <p className="text-xs font-semibold tracking-wide text-white/75 uppercase">{LABEL[k]}</p>
              <p className="font-display mt-1 text-3xl text-white">{formatRupiah(grup.reduce((n, x) => n + x.nominal, 0))}</p>
              <p className="mt-1 text-sm text-white/75">{grup.length} order</p>
            </div>
          );
        })}
      </div>

      <div className="mt-6 space-y-4">
        {rows.map(({ o, kelompok, nominal }) => {
          const r = o.refund;
          return (
            <section key={o.id} className="rounded-[20px] border border-glass-border bg-card p-6">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="font-display text-xl text-white uppercase">{o.participants[0]?.fullName ?? o.id}</h2>
                <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${CLS[kelompok]}`}>{LABEL[kelompok]}</span>
                {o.isTest && <span className="inline-block rounded-full border border-gold px-3 py-1 text-xs font-semibold text-gold">UJI</span>}
                <span className="font-display ml-auto text-2xl text-brand-yellow">{formatRupiah(nominal)}</span>
              </div>
              <p className="mt-2 text-sm text-white/80">
                <Link href={`/kuweraadmin/peserta/${o.id}`} className="font-mono text-brand-yellow hover:underline">{o.id}</Link>
                {" "}&middot; {[`dibayar ${fmtDateTime(o.paidAt)}`, o.buyerPhone, o.buyerEmail].filter(Boolean).join(" \u00b7 ")}
              </p>
              <p className="mt-1 font-mono text-xs text-white/65">{o.participants.map((p) => p.ticket?.code).filter(Boolean).join(", ")}</p>
              {nominal !== o.total && <p className="mt-1 text-sm text-yellow-lime">Total order {formatRupiah(o.total)}, yang dibayar pemesan {formatRupiah(nominal)}.</p>}

              {r && (
                <dl className="mt-4 grid gap-4 border-t border-white/10 pt-4 text-sm sm:grid-cols-3">
                  <div><dt className="text-xs text-white/65">{r.method === "ewallet" ? "Dompet digital" : "Bank"}</dt><dd className="mt-0.5 text-white">{r.provider}</dd></div>
                  <div><dt className="text-xs text-white/65">Nomor</dt><dd className="mt-0.5 font-mono text-lg text-white select-all">{r.accountNumber}</dd></div>
                  <div><dt className="text-xs text-white/65">Atas nama</dt><dd className="mt-0.5 text-white">{r.accountName}</dd></div>
                </dl>
              )}
              <div className="mt-4">
                {kelompok === "BELUM" && <SalinTautan link={refundLink(cfg, o.id)} />}
                {kelompok === "DIAJUKAN" && (
                  <>
                    <p className="mb-4 text-sm text-white/75">Diajukan {fmtDateTime(r!.submittedAt)}{r!.updatedAt.getTime() - r!.submittedAt.getTime() > 60_000 ? `, rekening diperbarui ${fmtDateTime(r!.updatedAt)}` : ""}.</p>
                    <RefundAksi orderId={o.id} nominal={formatRupiah(nominal)} />
                  </>
                )}
                {kelompok === "PERLU_PERBAIKAN" && (
                  <div className="space-y-3 text-sm text-white/85">
                    <p>Menunggu pemesan memperbaiki rekening. Alasan: {r!.note}</p>
                    <SalinTautan link={refundLink(cfg, o.id)} />
                  </div>
                )}
                {kelompok === "SELESAI" && (
                  <p className="text-sm text-white/85">
                    Ditransfer {fmtDateTime(r!.transferredAt)} oleh {r!.processedBy}.{" "}
                    <a href={`/kuweraadmin/berkas/refund/${o.id}`} target="_blank" rel="noopener noreferrer" className="text-brand-yellow underline">Lihat bukti transfer</a>
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
