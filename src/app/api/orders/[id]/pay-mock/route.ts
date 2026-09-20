import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { paymentMode } from "@/lib/orders";

// Pembayaran tiruan untuk pratinjau. Nanti diganti webhook Midtrans yang melakukan hal yang sama
// setelah signature diverifikasi. Hanya aktif kalau PAYMENT_MODE=mock.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (paymentMode() !== "mock") return NextResponse.json({ error: "Simulasi pembayaran tidak aktif" }, { status: 403 });
  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { id }, include: { ticket: true } });
  if (!order) return NextResponse.json({ error: "Order tidak ditemukan" }, { status: 404 });
  if (order.status === "PAID" && order.ticket) return NextResponse.json({ code: order.ticket.code });
  if (order.status !== "PENDING" || !order.expiresAt || order.expiresAt < new Date()) {
    return NextResponse.json({ error: "Order sudah kedaluwarsa, silakan daftar ulang" }, { status: 410 });
  }

  const code = order.id;
  const qrSvg = await QRCode.toString(code, { type: "svg", margin: 1, color: { dark: "#0B4A2C", light: "#FFFFFF" } });
  await prisma.$transaction([
    prisma.order.update({ where: { id }, data: { status: "PAID", paidAt: new Date() } }),
    prisma.payment.create({
      data: { orderId: id, gateway: "mock", gatewayRef: `MOCK-${Date.now()}`, method: order.paymentMethod ?? "mock", amount: order.total, rawPayload: { mock: true } },
    }),
    prisma.ticket.create({ data: { orderId: id, code, qrSvg } }),
  ]);
  return NextResponse.json({ code });
}
