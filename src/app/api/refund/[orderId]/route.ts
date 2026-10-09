import { prisma } from "@/lib/db";
import { ORDER_ID_RE, getRefund, refundAmount, refundSchema, validRefundKey } from "@/lib/refund";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { issuesToMap } from "@/lib/registration";

export const runtime = "nodejs";

const gagal = (error: string, status = 400) => Response.json({ error }, { status });

// Simpan pengajuan refund dari halaman pribadi peserta. Nominal selalu dihitung di sini dari order, bukan dari kiriman
// browser. Data rekening masih boleh diganti selama dana belum ditransfer; mengirim ulang mengembalikan status ke Diajukan.
export async function POST(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const cfg = await getRefund();
  if (!cfg) return gagal("Tidak tersedia", 404);
  if (!(await rateLimit("refund-ajukan", 20, 600))) return tooMany();
  const { orderId } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!ORDER_ID_RE.test(orderId) || !validRefundKey(cfg, orderId, body?.k)) return gagal("Tautan refund ini tidak berlaku. Mohon buka lagi dari email atau chat panitia, ya.", 404);
  const parsed = refundSchema.safeParse(body);
  if (!parsed.success) {
    const fields = issuesToMap(parsed.error.issues);
    return Response.json({ error: Object.values(fields)[0] ?? "Ada isian yang perlu dicek lagi.", fields }, { status: 400 });
  }
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true, total: true, status: true } });
  if (order?.status === "REFUNDED") return gagal("Dana order ini sudah kami kembalikan.", 409);
  if (!order || order.status !== "PAID") return gagal("Order tidak ditemukan", 404);

  const { method, provider, accountNumber, accountName } = parsed.data;
  const data = { amount: refundAmount(cfg, order), method, provider, accountNumber, accountName, status: "DIAJUKAN", note: null };
  // updateMany bersyarat supaya kiriman ulang tidak menimpa pengajuan yang baru saja ditandai selesai oleh admin.
  const diubah = await prisma.refundRequest.updateMany({ where: { orderId, status: { not: "SELESAI" } }, data });
  if (diubah.count === 0) {
    const dibuat = await prisma.refundRequest.create({ data: { orderId, ...data } }).catch(() => null);
    if (!dibuat) return gagal("Dana order ini sudah kami kembalikan.", 409);
  }
  return Response.json({ ok: true });
}
