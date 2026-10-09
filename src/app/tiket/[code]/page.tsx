import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Navbar from "@/components/sections/Navbar";
import Footer from "@/components/sections/Footer";
import TicketConfetti from "@/components/registration/TicketConfetti";
import PurchasePixel from "@/components/registration/PurchasePixel";
import { prisma } from "@/lib/db";
import { eventData } from "@/lib/event-data";
import { waLink, waText } from "@/lib/whatsapp";
import { maskEmail } from "@/lib/registration";
import { isRealGateway } from "@/lib/orders";
import { rateLimit } from "@/lib/rate-limit";
import { refundAktif } from "@/lib/refund";

export const dynamic = "force-dynamic";

// Berisi data pribadi peserta: jangan diindeks mesin pencari dan jangan tampilkan nama di pratinjau tautan.
export const metadata: Metadata = { title: "E-ticket", robots: { index: false, follow: false } };

export default async function TiketPage({ params }: { params: Promise<{ code: string }> }) {
  if (!(await rateLimit("tiket", 120, 600))) notFound(); // batasi tebak-tebakan kode tiket
  const { code } = await params;
  // Alamat bisa nomor order (semua tiket dalam pembelian) atau kode satu tiket ({nomor order}-{urutan}).
  const single = await prisma.ticket.findUnique({ where: { code }, select: { orderId: true } });
  const order = await prisma.order.findUnique({
    where: { id: single?.orderId ?? code },
    include: {
      category: true, payments: true,
      participants: { orderBy: { position: "asc" }, include: { ticket: true } },
    },
  });
  // Acara dibatalkan: tiket tidak berlaku lagi. Halaman ini bisa dibuka siapa pun yang memegang kode tiket, jadi
  // yang ditampilkan hanya arah ke /refund, bukan tautan refund pribadi pemesan.
  const batal = await refundAktif();
  if (batal && (order?.status === "PAID" || order?.status === "REFUNDED")) {
    return (
      <div className="relative flex flex-1 flex-col">
        <Navbar />
        <main className="relative mx-auto w-full max-w-2xl flex-1 px-6 pt-28 pb-24">
          <p className="text-xs font-semibold tracking-wide text-gold uppercase">E-ticket</p>
          <h1 className="font-display mt-2 text-4xl text-white uppercase">Acara <span className="text-brand-yellow">dibatalkan</span></h1>
          <p className="mt-3 text-white/80">
            Mohon maaf, KUWERA Fun Run 5K 2026 batal diselenggarakan, jadi tiket order {order.id} tidak berlaku lagi.{" "}
            {order.status === "REFUNDED" ? "Uang pendaftaran order ini sudah kami kembalikan." : "Uang pendaftarannya kami kembalikan 100%, termasuk kode unik."}
          </p>
          {order.status === "PAID" && (
            <Link href="/refund" className="mt-6 inline-block rounded-full bg-brand-yellow px-6 py-2.5 text-sm font-semibold text-green-deep">Ajukan refund</Link>
          )}
        </main>
        <Footer />
      </div>
    );
  }
  if (!order || order.status !== "PAID") notFound();
  const tickets = order.participants
    .filter((p) => p.ticket && (!single || p.ticket.code === code))
    .map((p) => ({ p, ticket: p.ticket! }));
  if (!tickets.length) notFound();
  const buyer = order.participants[0];
  // Tiket dari simulasi (mock) atau Midtrans sandbox bukan tiket resmi.
  const isMock = !order.payments.some((pay) => isRealGateway(pay.gateway));

  return (
    <div className="relative flex flex-1 flex-col">
      <Navbar />
      <TicketConfetti />
      {!isMock && (
        <PurchasePixel orderId={order.id} value={order.total} category={order.category.name} paidAt={(order.paidAt ?? order.updatedAt).toISOString()} />
      )}
      <main className="relative mx-auto w-full max-w-2xl flex-1 px-6 pt-28 pb-24">
        <p className="text-xs font-semibold tracking-wide text-gold uppercase">E-ticket</p>
        <h1 className="font-display mt-2 text-4xl text-white uppercase">
          Sampai jumpa di <span className="text-brand-yellow">garis start</span>
        </h1>
        <p className="mt-3 text-white/70">
          Pembayaran sudah kami terima, terima kasih! Halaman ini boleh kamu simpan, QR-nya nanti ditunjukkan saat mengambil race pack.
          {tickets.length > 1 && ` Ada ${tickets.length} tiket, masing-masing punya QR sendiri.`}
        </p>

        {tickets.map(({ p, ticket }) => (
        <div key={ticket.id} className="mt-8 overflow-hidden rounded-[20px] bg-cream text-green-deep">
          <div className="flex items-center justify-between px-6 py-4" style={{ background: "linear-gradient(90deg, #0B4A2C, #1C6B06)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- logo SVG statis */}
            <img src="/brand/kuwera-logo-light.svg" alt="KUWERA Fun Run" width={2400} height={853} className="h-8 w-auto" />
            <span className="rounded-full bg-brand-yellow px-3 py-1 text-xs font-semibold text-green-deep">{order.quantity > 1 ? `Tiket ${p.position} dari ${order.quantity}` : order.category.name}</span>
          </div>
          <div className="grid gap-6 p-6 sm:grid-cols-[auto_1fr] sm:p-8">
            <div className="mx-auto w-44 rounded-2xl bg-white p-3 shadow-sm" dangerouslySetInnerHTML={{ __html: ticket.qrSvg }} />
            <div>
              <p className="text-xs font-semibold tracking-wide text-green-deep/60 uppercase">Kode tiket</p>
              <p className="font-display text-3xl">{ticket.code}</p>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div><dt className="text-green-deep/60">Nama</dt><dd className="font-semibold">{p.fullName}</dd></div>
                <div><dt className="text-green-deep/60">Jersey</dt><dd className="font-semibold">{p.jerseySize}</dd></div>
                <div><dt className="text-green-deep/60">Start</dt><dd className="font-semibold">{eventData.dateLabel}, {eventData.timeLabel}</dd></div>
                <div><dt className="text-green-deep/60">Titik start</dt><dd className="font-semibold">{eventData.startPoint}</dd></div>
              </dl>
            </div>
          </div>
          <div className="border-t border-dashed border-green-deep/20 px-6 py-5 text-sm sm:px-8">
            <p><span className="font-semibold">Ambil race pack:</span> {eventData.racePackDates} di {eventData.racePackPlace}. {eventData.racePackHours} Jangan lupa bawa KTP atau KIA asli dan QR ini, ya.</p>
            <p className="mt-2 text-green-deep/80">Pertanyaan lain ada di <Link href="/#faq" className="underline">FAQ</Link> atau <a href={waLink(waText.tiket(ticket.code))} target="_blank" rel="noopener noreferrer" className="underline">WhatsApp panitia</a>.</p>
          </div>
          {isMock && (
            <div className="bg-brand-yellow px-6 py-2 text-center text-xs font-semibold text-green-deep">Tiket simulasi (pratinjau), bukan tiket resmi</div>
          )}
        </div>
        ))}

        <p className="mt-6 text-sm text-white/75">Salinan e-ticket akan dikirim ke {maskEmail(buyer.email)} begitu pengiriman email aktif.</p>
      </main>
      <Footer />
    </div>
  );
}
