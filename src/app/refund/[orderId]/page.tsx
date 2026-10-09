import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Navbar from "@/components/sections/Navbar";
import Footer from "@/components/sections/Footer";
import RefundForm from "@/components/refund/RefundForm";
import { prisma } from "@/lib/db";
import { priceLines } from "@/lib/manual-payment";
import { rateLimit } from "@/lib/rate-limit";
import { formatRupiah, maskEmail } from "@/lib/registration";
import { ORDER_ID_RE, REFUND_PROSES, getRefund, refundAmount, tglPanjang, validRefundKey, type RefundMethod } from "@/lib/refund";
import { waLink, waText } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

// Berisi data pribadi peserta dan hanya terbuka dengan kunci di tautannya: jangan diindeks, dan jangan kirim alamat
// lengkapnya (termasuk kunci) ke situs lain lewat header Referer.
export const metadata: Metadata = { title: "Refund pesananmu", robots: { index: false, follow: false }, referrer: "no-referrer" };

const samar = (nomor: string) => `${"•".repeat(Math.max(0, nomor.length - 4))}${nomor.slice(-4)}`;

export default async function RefundOrderPage({ params, searchParams }: { params: Promise<{ orderId: string }>; searchParams: Promise<{ k?: string | string[] }> }) {
  const cfg = await getRefund();
  if (!cfg || !(await rateLimit("refund", 120, 600))) notFound(); // batasi tebak-tebakan kunci
  const { orderId } = await params;
  const k = (await searchParams).k;
  if (typeof k !== "string" || !ORDER_ID_RE.test(orderId) || !validRefundKey(cfg, orderId, k)) notFound();
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      participants: { orderBy: { position: "asc" }, include: { ticket: { select: { code: true, qrSvg: true } } } },
      refund: { omit: { proofData: true } },
    },
  });
  const buyer = order?.participants[0];
  if (!order || !buyer || (order.status !== "PAID" && order.status !== "REFUNDED")) notFound();

  const r = order.refund;
  const amount = r?.status === "SELESAI" ? r.amount : refundAmount(cfg, order);
  const total = formatRupiah(amount);
  const lines = priceLines(order);
  if (amount !== order.total) lines.push(["Potongan saat pembayaran", `−${formatRupiah(order.total - amount)}`]);
  const rekening = r && `${r.provider} ${samar(r.accountNumber)} atas nama ${r.accountName}`;
  const tiket = order.participants.filter((p) => p.ticket).map((p) => ({ code: p.ticket!.code, nama: p.fullName }));
  // Nomor rekening lama tidak diisikan ulang ke formulir: yang mengganti rekening mengetiknya dari awal.
  const awal = r ? { method: r.method as RefundMethod, provider: r.provider, accountNumber: "", accountName: r.accountName } : undefined;

  return (
    <div className="relative flex flex-1 flex-col">
      <Navbar />
      <main className="relative mx-auto w-full max-w-2xl flex-1 px-6 pt-28 pb-24">
        <p className="text-xs font-semibold tracking-wide text-gold uppercase">Pengembalian dana</p>
        <h1 className="font-display mt-2 text-4xl text-white uppercase">
          Refund order <span className="text-brand-yellow">{order.id}</span>
        </h1>
        <p className="mt-3 text-white/80">
          Halo Kak {buyer.firstName ?? buyer.fullName}, mohon maaf KUWERA Fun Run 5K batal diselenggarakan. Uang pendaftaranmu kami kembalikan penuh, termasuk kode uniknya.
        </p>

        <section className="mt-8 rounded-[20px] border border-glass-border bg-card p-6">
          <h2 className="font-display text-xl text-white uppercase">Pesananmu</h2>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            <div><dt className="text-white/65">Nomor order</dt><dd className="mt-0.5 font-mono text-white">{order.id}</dd></div>
            <div><dt className="text-white/65">Dibayar</dt><dd className="mt-0.5 text-white">{order.paidAt ? tglPanjang(order.paidAt) : "-"}</dd></div>
            <div><dt className="text-white/65">Pemesan</dt><dd className="mt-0.5 text-white">{buyer.fullName}</dd></div>
            <div><dt className="text-white/65">Email</dt><dd className="mt-0.5 text-white">{maskEmail(order.buyerEmail)}</dd></div>
          </dl>
          <div className="mt-5 border-t border-white/10 pt-4">
            <p className="text-xs font-semibold tracking-wide text-gold uppercase">Tiket</p>
            <ul className="mt-3 space-y-4 text-sm">
              {order.participants.map((p) => (
                <li key={p.id} className="flex items-center gap-4 text-white">
                  {p.ticket && <div className="w-24 shrink-0 rounded-xl bg-white p-1.5" role="img" aria-label={`QR tiket ${p.ticket.code}`} dangerouslySetInnerHTML={{ __html: p.ticket.qrSvg }} />}
                  <dl className="grid gap-1">
                    <div><dt className="sr-only">Kode tiket</dt><dd className="font-mono font-semibold">{p.ticket?.code ?? "-"}</dd></div>
                    <div><dt className="sr-only">Nama</dt><dd>{p.fullName}</dd></div>
                    <div><dt className="sr-only">Jersey</dt><dd className="text-white/65">Jersey {p.jerseySize}</dd></div>
                  </dl>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-5 border-t border-white/10 pt-4">
            <p className="text-xs font-semibold tracking-wide text-gold uppercase">Rincian nominal</p>
            <dl className="mt-2 space-y-1.5 text-sm">
              {lines.map(([label, nilai]) => (
                <div key={label} className="flex justify-between gap-4"><dt className="text-white/75">{label}</dt><dd className="text-white">{nilai}</dd></div>
              ))}
            </dl>
            <div className="mt-4 flex items-baseline justify-between gap-4 rounded-xl bg-brand-yellow px-4 py-3 text-green-deep">
              <span className="text-sm font-semibold">Total dikembalikan</span>
              <span className="font-display text-3xl">{total}</span>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-[20px] border border-glass-border bg-card p-6">
          {r?.status === "SELESAI" ? (
            <>
              <h2 className="font-display text-xl text-white uppercase">Dana sudah kami transfer</h2>
              <p className="mt-2 text-white/85">
                {total} sudah kami kirim ke {rekening}{r.transferredAt ? ` pada ${tglPanjang(r.transferredAt)}` : ""}. Tiket di order ini sudah tidak berlaku. Terima kasih atas pengertiannya, semoga kita bertemu di acara berikutnya.
              </p>
              {r.proofMime && (
                <a href={`/api/refund/${order.id}/bukti?k=${k}`} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block rounded-full border border-brand-yellow px-5 py-2 text-sm font-semibold text-brand-yellow">Lihat bukti transfer</a>
              )}
            </>
          ) : r?.status === "DIAJUKAN" ? (
            <>
              <h2 className="font-display text-xl text-white uppercase">Pengajuanmu sudah kami terima</h2>
              <p className="mt-2 text-white/85">
                {total} akan kami transfer ke {rekening}, {REFUND_PROSES} sejak pengajuan ini masuk. Begitu dana terkirim, bukti transfernya kami kirim ke emailmu dan tampil di halaman ini.
              </p>
              {r.dataNote && <p className="mt-3 text-sm whitespace-pre-line text-white/75">Koreksi data yang kamu kirim:{"\n"}{r.dataNote}</p>}
              <details className="mt-5 border-t border-white/10 pt-4">
                <summary className="cursor-pointer text-sm font-semibold text-brand-yellow">Ubah data rekening</summary>
                <div className="mt-4"><RefundForm orderId={order.id} k={k} total={total} tiket={tiket} awal={awal} tombol="Simpan rekening baru" /></div>
              </details>
            </>
          ) : (
            <>
              <h2 className="font-display text-xl text-white uppercase">{r ? "Data rekening perlu diperbaiki" : "Ajukan refund"}</h2>
              {r ? (
                <p className="mt-2 rounded-xl border border-brand-yellow/40 bg-brand-yellow/10 px-4 py-3 text-sm text-brand-yellow">Catatan panitia: {r.note ?? "Mohon periksa lagi data rekeningnya."}</p>
              ) : (
                <p className="mt-2 text-sm text-white/75">Isi rekening tujuannya, lalu dana kami transfer {REFUND_PROSES}. Biaya transfer kami yang tanggung.</p>
              )}
              <div className="mt-5"><RefundForm orderId={order.id} k={k} total={total} tiket={tiket} awal={awal} tombol={r ? "Kirim perbaikan" : "Ajukan refund"} /></div>
            </>
          )}
        </section>

        <p className="mt-6 text-sm text-white/75">
          Ada yang ingin ditanyakan? Panitia siap membantu lewat <a href={waLink(`${waText.refund}${order.id}`)} target="_blank" rel="noopener noreferrer" className="underline">WhatsApp</a>.
        </p>
      </main>
      <Footer />
    </div>
  );
}
