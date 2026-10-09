import { prisma } from "@/lib/db";
import { ORDER_ID_RE, VERIF_JENDELA_DETIK, VERIF_MAKS, getRefund, refundAmount, refundSchema, validRefundKey } from "@/lib/refund";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { issuesToMap, normalizePhone } from "@/lib/registration";

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
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true, total: true, status: true, buyerPhone: true, buyerEmail: true, tickets: { select: { code: true }, orderBy: { code: "asc" } } } });
  if (order?.status === "REFUNDED") return gagal("Dana order ini sudah kami kembalikan.", 409);
  if (!order || order.status !== "PAID") return gagal("Order tidak ditemukan", 404);

  // Verifikasi berlapis: selain memegang tautan pribadi, pengaju harus tahu nomor WhatsApp dan email pemesan persis
  // seperti di pendaftaran. Salah lima kali dalam 24 jam mengunci order itu (apa pun IP-nya), lalu hanya admin yang
  // bisa membantu. Pesannya tidak menyebut bagian mana yang salah.
  const kunciSalah = `refund-salah:${orderId}`;
  const salah = await prisma.rateLimit.findUnique({ where: { key: kunciSalah } });
  if (salah && salah.count >= VERIF_MAKS && salah.windowStart.getTime() > Date.now() - VERIF_JENDELA_DETIK * 1000) {
    return gagal("Verifikasi order ini sudah beberapa kali tidak cocok, jadi pengajuannya kami kunci dulu selama 24 jam. Mohon hubungi panitia lewat WhatsApp supaya kami bantu, ya.", 429);
  }
  if (normalizePhone(parsed.data.phone) !== normalizePhone(order.buyerPhone) || parsed.data.email !== order.buyerEmail.trim().toLowerCase()) {
    await rateLimit("refund-salah", VERIF_MAKS, VERIF_JENDELA_DETIK, orderId);
    return Response.json({ error: "Nomor WhatsApp atau email belum sama dengan data pendaftaran order ini. Mohon isi persis seperti saat mendaftar, ya.", fields: { verifikasi: "Belum cocok dengan data pendaftaran." } }, { status: 403 });
  }

  const { method, provider, accountNumber, accountName, koreksi = {} } = parsed.data;
  // Koreksi hanya diterima untuk kode tiket milik order ini.
  const dataNote = order.tickets.filter((t) => koreksi[t.code]).map((t) => `${t.code}: ${koreksi[t.code]}`).join("\n") || null;
  const data = { amount: refundAmount(cfg, order), method, provider, accountNumber, accountName, dataNote, verified: true, status: "DIAJUKAN", note: null };
  // updateMany bersyarat supaya kiriman ulang tidak menimpa pengajuan yang baru saja ditandai selesai oleh admin.
  const diubah = await prisma.refundRequest.updateMany({ where: { orderId, status: { not: "SELESAI" } }, data });
  if (diubah.count === 0) {
    const dibuat = await prisma.refundRequest.create({ data: { orderId, ...data } }).catch(() => null);
    if (!dibuat) return gagal("Dana order ini sudah kami kembalikan.", 409);
  }
  return Response.json({ ok: true });
}
