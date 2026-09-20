import { notFound, redirect } from "next/navigation";
import Navbar from "@/components/sections/Navbar";
import Footer from "@/components/sections/Footer";
import PaymentWaiting from "@/components/registration/PaymentWaiting";
import { prisma } from "@/lib/db";
import { paymentMode } from "@/lib/orders";

export const dynamic = "force-dynamic";

export default async function BayarPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { category: true, participant: true, ticket: true },
  });
  if (!order || !order.participant) notFound();
  if (order.status === "PAID" && order.ticket) redirect(`/tiket/${order.ticket.code}`);

  return (
    <div className="flex flex-1 flex-col bg-green-deep">
      <Navbar />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 pt-28 pb-24">
        <PaymentWaiting
          order={{
            id: order.id,
            status: order.status,
            total: order.total,
            subtotal: order.subtotal,
            discount: order.discount,
            fee: order.fee,
            expiresAt: order.expiresAt?.toISOString() ?? null,
            paymentMethod: order.paymentMethod,
            category: order.category.name,
            name: order.participant.fullName,
            email: order.participant.email,
          }}
          paymentMode={paymentMode()}
        />
      </main>
      <Footer />
    </div>
  );
}
