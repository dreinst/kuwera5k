import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { markOrderPaid } from "@/lib/orders";
import { fetchTransactionStatus, mapTransactionStatus, verifySignature, type MidtransNotification } from "@/lib/midtrans";

// Notifikasi pembayaran Midtrans (Settings > Configuration > Payment Notification URL).
// Kebenaran bayar hanya dari sini: tanda tangan SHA-512 diverifikasi, status dicek ulang ke API,
// dan penandaan lunas idempoten (PRD bagian 6).
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as MidtransNotification | null;
  if (!body?.order_id || !body.signature_key) return NextResponse.json({ error: "payload tidak lengkap" }, { status: 400 });
  if (!verifySignature(body)) return NextResponse.json({ error: "signature tidak valid" }, { status: 403 });

  const order = await prisma.order.findUnique({ where: { id: body.order_id } });
  if (!order) return NextResponse.json({ error: "order tidak dikenal" }, { status: 404 });

  const live = await fetchTransactionStatus(body.order_id);
  const status = live?.transaction_status ?? body.transaction_status;
  const fraud = live?.fraud_status ?? body.fraud_status;
  const gross = Math.round(Number(live?.gross_amount ?? body.gross_amount));
  const mapped = mapTransactionStatus(status, fraud);

  if (mapped === "PAID") {
    if (gross !== order.total) {
      console.error(`nominal webhook ${gross} != order ${order.total} (${order.id})`);
      return NextResponse.json({ error: "nominal tidak cocok" }, { status: 409 });
    }
    const code = await markOrderPaid(order.id, {
      gateway: "midtrans", gatewayRef: (live?.transaction_id ?? body.transaction_id) ?? null,
      method: (live?.payment_type ?? body.payment_type) ?? order.paymentMethod, amount: gross, rawPayload: live ?? body,
    });
    return NextResponse.json({ ok: true, code });
  }
  if (mapped === "EXPIRED" || mapped === "FAILED") {
    if (order.status === "PENDING") await prisma.order.update({ where: { id: order.id }, data: { status: mapped } });
    return NextResponse.json({ ok: true, status: mapped });
  }
  return NextResponse.json({ ok: true, status });
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "midtrans webhook" });
}
