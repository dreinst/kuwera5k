import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { paymentMode } from "@/lib/orders";
import { createSnapToken } from "@/lib/midtrans";
import type { PaymentMethodId } from "@/lib/registration";

// Buat token Snap untuk order PENDING; popup Snap dikunci ke metode yang dipilih peserta.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (paymentMode() !== "midtrans") return NextResponse.json({ error: "Pembayaran Midtrans tidak aktif" }, { status: 403 });
  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { id }, include: { participant: true, category: true, ticket: true } });
  if (!order || !order.participant) return NextResponse.json({ error: "Order tidak ditemukan" }, { status: 404 });
  if (order.status === "PAID" && order.ticket) return NextResponse.json({ paid: true, code: order.ticket.code });
  if (order.status !== "PENDING" || !order.expiresAt || order.expiresAt < new Date() || !order.paymentMethod) {
    return NextResponse.json({ error: "Order sudah kedaluwarsa, silakan daftar ulang" }, { status: 410 });
  }
  const origin = req.headers.get("origin") ?? `https://${req.headers.get("host") ?? "kuwera5k.vercel.app"}`;
  try {
    const snap = await createSnapToken({
      id: order.id, subtotal: order.subtotal, discount: order.discount, fee: order.fee, total: order.total,
      categoryName: order.category.name, paymentMethod: order.paymentMethod as PaymentMethodId, expiresAt: order.expiresAt,
      participant: { fullName: order.participant.fullName, email: order.participant.email, phone: order.participant.phone },
      finishUrl: `${origin}/bayar/${order.id}`,
    });
    return NextResponse.json(snap);
  } catch (e) {
    console.error("snap token gagal", e);
    return NextResponse.json({ error: "Gagal membuka pembayaran, coba lagi sebentar" }, { status: 502 });
  }
}
