import { prisma } from "@/lib/db";
import { ORDER_ID_RE, getRefund } from "@/lib/refund";
import { clientIpFromHeaders, rateLimit, tooMany } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";

export const runtime = "nodejs";

// Pemesan yang tidak memegang tautan refund pribadinya mengisi nomor order dan email saat daftar. Tautannya tidak
// ditampilkan di layar: order ditandai (refundLinkAt) lalu skrip kuwera-email-tiket di VPS mengirimkannya ke email
// terdaftar. Jawaban selalu sama, cocok atau tidak, supaya halaman ini tidak bisa dipakai menebak nomor order.
const JEDA_MENIT = 5; // satu order paling sering dikirimi tiap 5 menit

export async function POST(req: Request) {
  if (!(await getRefund())) return Response.json({ error: "Tidak tersedia" }, { status: 404 });
  if (!(await rateLimit("refund-cari", 8, 600))) return tooMany();
  const body = (await req.json().catch(() => null)) as { orderId?: unknown; email?: unknown; token?: unknown } | null;
  if (!(await verifyTurnstile(body?.token, await clientIpFromHeaders()))) {
    return Response.json({ error: "Verifikasi bukan robot belum berhasil. Mohon centang ulang kotaknya, ya." }, { status: 400 });
  }
  const orderId = String(body?.orderId ?? "").trim().toUpperCase();
  const email = String(body?.email ?? "").trim().toLowerCase();
  if (!ORDER_ID_RE.test(orderId)) return Response.json({ error: "Nomor order berbentuk KWR-2026-XXXXXX, bisa dilihat di email e-ticket." }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return Response.json({ error: "Mohon isi email yang kamu pakai saat mendaftar." }, { status: 400 });
  await prisma.order.updateMany({
    where: {
      id: orderId, status: { in: ["PAID", "REFUNDED"] }, buyerEmail: { equals: email, mode: "insensitive" },
      OR: [{ refundLinkAt: null }, { refundLinkAt: { lt: new Date(Date.now() - JEDA_MENIT * 60_000) } }],
    },
    data: { refundLinkAt: new Date() },
  });
  return Response.json({ ok: true });
}
