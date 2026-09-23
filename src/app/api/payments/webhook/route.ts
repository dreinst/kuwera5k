import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { applyLiveStatus } from "@/lib/orders";
import { fetchTransactionStatus, verifySignature, type MidtransNotification } from "@/lib/midtrans";

// Notifikasi pembayaran Midtrans (Settings > Payment > Notification URL).
// Kebenaran bayar hanya dari sini: tanda tangan SHA-512 diverifikasi, lalu status, nominal, dan
// metode diambil dari API status Midtrans, tidak pernah dari isi notifikasi (PRD bagian 6).
// Kalau status tidak bisa dicek atau terjadi error, jawab 503: Midtrans mengulang notifikasi
// beberapa kali dalam beberapa jam, sedangkan jawaban 500 hanya diulang sekali.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as MidtransNotification | null;
  if (!body?.order_id || !body.signature_key) return NextResponse.json({ error: "payload tidak lengkap" }, { status: 400 });
  if (!process.env.MIDTRANS_SERVER_KEY) {
    console.error("MIDTRANS_SERVER_KEY kosong, notifikasi tidak bisa diverifikasi");
    return NextResponse.json({ error: "server belum dikonfigurasi" }, { status: 503 });
  }
  if (!verifySignature(body)) return NextResponse.json({ error: "signature tidak valid" }, { status: 403 });

  try {
    const order = await prisma.order.findUnique({
      where: { id: body.order_id },
      select: { id: true, total: true, status: true, paymentMethod: true, expiresAt: true },
    });
    // Order yang tidak dikenal (misal transaksi uji dari dashboard) dijawab 200 supaya Midtrans
    // tidak mengulang notifikasinya; tidak ada yang diubah.
    if (!order) return NextResponse.json({ ok: false, reason: "order tidak dikenal" });

    const live = await fetchTransactionStatus(order.id);
    if (live.kind !== "found") {
      console.error(`status Midtrans ${order.id} tidak bisa dicek: ${live.kind === "error" ? live.detail : "tidak ditemukan"}`);
      return NextResponse.json({ error: "status belum bisa dicek" }, { status: 503 });
    }
    const r = await applyLiveStatus(order, live.data, new Date());
    if (r.mismatch) return NextResponse.json({ error: "nominal tidak cocok" }, { status: 409 });
    return NextResponse.json({ ok: true, status: r.status, ...(r.code ? { code: r.code } : {}) });
  } catch (e) {
    console.error("webhook Midtrans gagal diproses", e);
    return NextResponse.json({ error: "gagal diproses" }, { status: 503 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "midtrans webhook" });
}
