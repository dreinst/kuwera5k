import { notFound } from "next/navigation";
import Navbar from "@/components/sections/Navbar";
import Footer from "@/components/sections/Footer";
import TicketConfetti from "@/components/registration/TicketConfetti";
import { prisma } from "@/lib/db";
import { eventData } from "@/lib/event-data";

export const dynamic = "force-dynamic";

export default async function TiketPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const ticket = await prisma.ticket.findUnique({
    where: { code },
    include: { order: { include: { participant: true, category: true, payments: true } } },
  });
  if (!ticket || !ticket.order.participant) notFound();
  const { order } = ticket;
  const p = ticket.order.participant!;
  const isMock = order.payments.some((pay) => pay.gateway === "mock");

  return (
    <div className="flex flex-1 flex-col bg-green-deep">
      <Navbar />
      <TicketConfetti />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 pt-28 pb-24">
        <p className="text-xs font-semibold tracking-wide text-gold uppercase">E-ticket</p>
        <h1 className="font-display mt-2 text-4xl text-white uppercase">
          Sampai jumpa di <span className="text-brand-yellow">garis start</span>
        </h1>
        <p className="mt-3 text-white/70">Pembayaran diterima. Simpan halaman ini, tunjukkan QR-nya saat ambil race pack.</p>

        <div className="mt-8 overflow-hidden rounded-[20px] bg-cream text-green-deep">
          <div className="flex items-center justify-between px-6 py-4" style={{ background: "linear-gradient(90deg, #0B4A2C, #1C6B06)" }}>
            <span className="font-display text-xl tracking-wide text-white">KUWERA<span className="text-brand-yellow">5K</span></span>
            <span className="rounded-full bg-brand-yellow px-3 py-1 text-xs font-semibold text-green-deep">{order.category.name}</span>
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
                <div><dt className="text-green-deep/60">Lokasi</dt><dd className="font-semibold">{eventData.startPoint}</dd></div>
              </dl>
            </div>
          </div>
          <div className="border-t border-dashed border-green-deep/20 px-6 py-5 text-sm sm:px-8">
            <p><span className="font-semibold">Ambil race pack:</span> {eventData.racePackLabel}, {eventData.racePackPlace}. Bawa KTP asli dan tunjukkan QR ini.</p>
            <p className="mt-2 text-green-deep/70">Pertanyaan lain ada di <a href="/#faq" className="underline">FAQ</a> atau <a href={eventData.whatsappPanitia} className="underline">WhatsApp panitia</a>.</p>
          </div>
          {isMock && (
            <div className="bg-brand-yellow px-6 py-2 text-center text-xs font-semibold text-green-deep">Tiket simulasi (pratinjau), bukan tiket resmi</div>
          )}
        </div>

        <p className="mt-6 text-sm text-white/60">Salinan e-ticket akan dikirim ke {p.email} begitu pengiriman email aktif.</p>
      </main>
      <Footer />
    </div>
  );
}
