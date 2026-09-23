import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { needsSync, syncOrderWithMidtrans, type SyncResult } from "@/lib/orders";
import { rateLimit, tooMany } from "@/lib/rate-limit";

// Status order untuk polling halaman /bayar. Dengan ?sync=1 order PENDING/FAILED yang pernah membuka
// Snap dicek ulang ke Midtrans, jadi pembayaran tetap terdeteksi walau notifikasinya telat atau gagal.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  // Cukup untuk polling /bayar tiap 5 detik, terlalu sedikit untuk menebak nomor order.
  if (!(await rateLimit("status", 300, 600))) return tooMany();
  const { id } = await params;
  const sync = new URL(req.url).searchParams.get("sync") === "1";
  const order = await prisma.order.findUnique({
    where: { id },
    select: { id: true, status: true, total: true, expiresAt: true, paymentMethod: true, snapToken: true, ticket: { select: { code: true } } },
  });
  if (!order) return NextResponse.json({ error: "Order tidak ditemukan" }, { status: 404 });

  const now = new Date();
  let status = order.status;
  let ticketCode = order.ticket?.code ?? null;
  let live: SyncResult["live"] | null = null;
  if (sync && needsSync(order)) {
    const r = await syncOrderWithMidtrans(order, now);
    status = r.status;
    live = r.live;
    if (r.code) ticketCode = r.code;
  }
  // PENDING yang lewat hold dilaporkan EXPIRED, kecuali Midtrans masih mencatatnya pending.
  // Field "final" memberi tahu klien bahwa status ini sudah pasti, bukan hitungan dari jam saja.
  const pastHold = !!order.expiresAt && order.expiresAt <= now;
  const shown = status === "PENDING" && pastHold && live !== "pending" && live !== "error" ? "EXPIRED" : status;
  const final = status !== "PENDING" || (shown === "EXPIRED" && (live !== null || !order.snapToken));
  return NextResponse.json({
    id: order.id,
    status: shown,
    total: order.total,
    expiresAt: order.expiresAt,
    paymentMethod: order.paymentMethod,
    ticketCode,
    final,
  });
}
