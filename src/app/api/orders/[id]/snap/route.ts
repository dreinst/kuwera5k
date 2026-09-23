import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { paymentMode } from "@/lib/orders";
import { createSnapToken } from "@/lib/midtrans";
import type { PaymentMethodId } from "@/lib/registration";

// Token Snap untuk order PENDING; popup dikunci ke metode yang dipilih peserta. Token pertama disimpan
// dan dipakai lagi setiap kali tombol Bayar ditekan, karena setelah peserta memilih metode Midtrans
// menolak token baru untuk order_id yang sama ("order_id sudah digunakan").
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (paymentMode() !== "midtrans") return NextResponse.json({ error: "Pembayaran Midtrans tidak aktif" }, { status: 403 });
  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { id }, include: { participant: true, category: true, ticket: true } });
  if (!order || !order.participant) return NextResponse.json({ error: "Order tidak ditemukan" }, { status: 404 });
  if (order.status === "PAID" && order.ticket) return NextResponse.json({ paid: true, code: order.ticket.code });
  const now = new Date();
  if (order.status !== "PENDING" || !order.expiresAt || order.expiresAt <= now || !order.paymentMethod) {
    return NextResponse.json({ error: "Order sudah kedaluwarsa, silakan daftar ulang" }, { status: 410 });
  }
  if (order.snapToken) return NextResponse.json({ token: order.snapToken, redirectUrl: order.snapRedirectUrl });
  if (order.expiresAt.getTime() - now.getTime() < 60_000) {
    return NextResponse.json({ error: "Sisa waktu kurang dari 1 menit, tidak cukup untuk membayar. Tunggu order ini habis lalu daftar ulang." }, { status: 410 });
  }

  const origin = req.headers.get("origin") ?? `https://${req.headers.get("host") ?? "kuwera5k.vercel.app"}`;
  try {
    const snap = await createSnapToken({
      id: order.id, subtotal: order.subtotal, discount: order.discount, fee: order.fee, total: order.total,
      categoryName: order.category.name, paymentMethod: order.paymentMethod as PaymentMethodId, expiresAt: order.expiresAt,
      participant: { fullName: order.participant.fullName, email: order.participant.email, phone: order.participant.phone },
      finishUrl: `${origin}/bayar/${order.id}`,
    });
    const saved = await prisma.order.updateMany({
      where: { id: order.id, snapToken: null },
      data: { snapToken: snap.token, snapRedirectUrl: snap.redirectUrl },
    });
    if (saved.count === 0) {
      // Klik ganda: permintaan lain sudah menyimpan token lebih dulu, pakai yang itu.
      const current = await prisma.order.findUnique({ where: { id: order.id }, select: { snapToken: true, snapRedirectUrl: true } });
      if (current?.snapToken) return NextResponse.json({ token: current.snapToken, redirectUrl: current.snapRedirectUrl });
    }
    return NextResponse.json(snap);
  } catch (e) {
    console.error("snap token gagal", e);
    return NextResponse.json({ error: "Gagal membuka pembayaran, coba lagi sebentar" }, { status: 502 });
  }
}
