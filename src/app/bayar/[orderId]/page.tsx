import { notFound, redirect } from "next/navigation";
import Navbar from "@/components/sections/Navbar";
import Footer from "@/components/sections/Footer";
import PaymentWaiting from "@/components/registration/PaymentWaiting";
import { prisma } from "@/lib/db";
import { needsSync, paymentMode, syncOrderWithMidtrans } from "@/lib/orders";
import { midtrans } from "@/lib/midtrans";
import JerseyTexture from "@/components/JerseyTexture";

export const dynamic = "force-dynamic";

export default async function BayarPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { category: true, participant: true, ticket: true },
  });
  if (!order || !order.participant) notFound();
  if (order.status === "PAID" && order.ticket) redirect(`/tiket/${order.ticket.code}`);

  // Peserta yang kembali ke halaman ini (misal setelah notifikasi Midtrans gagal) langsung dicek ulang.
  // syncOrderWithMidtrans tidak melempar error dan fetch ke Midtrans punya batas waktu, jadi halaman
  // tetap tampil dengan status dari database kalau Midtrans atau database sedang bermasalah.
  let status = order.status;
  if (needsSync(order)) {
    const r = await syncOrderWithMidtrans(order);
    if (r.status === "PAID" && r.code) redirect(`/tiket/${r.code}`);
    status = r.status;
  }

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-green-deep">
      <JerseyTexture dots="right" />
      <Navbar />
      <main className="relative mx-auto w-full max-w-2xl flex-1 px-6 pt-28 pb-24">
        <PaymentWaiting
          order={{
            id: order.id,
            status,
            total: order.total,
            subtotal: order.subtotal,
            discount: order.discount,
            fee: order.fee,
            expiresAt: order.expiresAt?.toISOString() ?? null,
            paymentMethod: order.paymentMethod,
            category: order.category.name,
            name: order.participant.fullName,
            email: order.participant.email,
            hasSnap: !!order.snapToken,
          }}
          paymentMode={paymentMode()}
          snap={{ clientKey: midtrans.clientKey, scriptUrl: midtrans.snapJs }}
        />
      </main>
      <Footer />
    </div>
  );
}
