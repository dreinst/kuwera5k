import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { markOrderPaid, paymentMode } from "@/lib/orders";

// Pembayaran tiruan untuk pratinjau; hanya aktif kalau PAYMENT_MODE=mock. Webhook Midtrans
// memakai markOrderPaid yang sama setelah tanda tangan diverifikasi.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (paymentMode() !== "mock") return NextResponse.json({ error: "Simulasi pembayaran tidak aktif" }, { status: 403 });
  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { id }, include: { ticket: true } });
  if (!order) return NextResponse.json({ error: "Order tidak ditemukan" }, { status: 404 });
  if (order.status === "PAID" && order.ticket) return NextResponse.json({ code: order.ticket.code });
  if (order.status !== "PENDING" || !order.expiresAt || order.expiresAt < new Date()) {
    return NextResponse.json({ error: "Order sudah kedaluwarsa, silakan daftar ulang" }, { status: 410 });
  }
  const code = await markOrderPaid(id, { gateway: "mock", gatewayRef: `MOCK-${Date.now()}`, method: order.paymentMethod, amount: order.total, rawPayload: { mock: true } });
  return NextResponse.json({ code });
}
