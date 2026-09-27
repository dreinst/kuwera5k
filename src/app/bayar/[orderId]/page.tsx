import type { Metadata } from "next";
import type { OrderStatus } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import Navbar from "@/components/sections/Navbar";
import Footer from "@/components/sections/Footer";
import PaymentWaiting from "@/components/registration/PaymentWaiting";
import { prisma } from "@/lib/db";
import { needsSync, paymentMode, syncOrderWithMidtrans, trackCheckout } from "@/lib/orders";
import { midtrans } from "@/lib/midtrans";
import { maskEmail } from "@/lib/registration";
import { confirmText, priceLines, qrisSvgFor } from "@/lib/manual-payment";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Berisi data pribadi peserta: jangan diindeks mesin pencari dan jangan tampilkan nama di pratinjau tautan.
export const metadata: Metadata = { title: "Pembayaran", robots: { index: false, follow: false } };

export default async function BayarPage({ params }: { params: Promise<{ orderId: string }> }) {
  if (!(await rateLimit("bayar", 120, 600))) notFound(); // batasi tebak-tebakan nomor order
  const { orderId } = await params;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { category: true, participants: { orderBy: { position: "asc" } } },
  });
  const buyer = order?.participants[0];
  if (!order || !buyer) notFound();
  if (order.status === "PAID") redirect(`/tiket/${order.id}`);
  const mode = paymentMode();
  const manual = mode === "manual" && order.status === "PENDING"
    ? { qrSvg: await qrisSvgFor(order.total), waText: confirmText(order), lines: priceLines(order) }
    : null;

  // Peserta yang kembali ke halaman ini (misal setelah notifikasi Midtrans gagal) langsung dicek ulang.
  // syncOrderWithMidtrans tidak melempar error dan fetch ke Midtrans punya batas waktu, jadi halaman
  // tetap tampil dengan status dari database kalau Midtrans atau database sedang bermasalah.
  let status: OrderStatus = order.status;
  if (needsSync(order)) {
    const r = await syncOrderWithMidtrans(order);
    if (r.status === "PAID" && r.code) redirect(`/tiket/${r.code}`);
    status = r.status;
  }

  return (
    <div className="relative flex flex-1 flex-col">
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
            name: buyer.fullName,
            email: maskEmail(buyer.email),
            hasSnap: !!order.snapToken,
            quantity: order.quantity,
          }}
          manual={manual}
          paymentMode={mode}
          trackCheckout={trackCheckout()}
          snap={{ clientKey: midtrans.clientKey, scriptUrl: midtrans.snapJs }}
        />
      </main>
      <Footer />
    </div>
  );
}
