import { prisma } from "@/lib/db";
import { download } from "@/lib/admin-files";
import { ORDER_ID_RE, getRefund, validRefundKey } from "@/lib/refund";
import { rateLimit } from "@/lib/rate-limit";

// Bukti transfer refund untuk peserta, dibuka dari halaman status dengan kunci tautan pribadinya.
export async function GET(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const tidakAda = new Response("Tidak ditemukan", { status: 404 });
  const cfg = await getRefund();
  const { orderId } = await params;
  if (!cfg || !(await rateLimit("refund", 120, 600))) return tidakAda;
  if (!ORDER_ID_RE.test(orderId) || !validRefundKey(cfg, orderId, new URL(req.url).searchParams.get("k"))) return tidakAda;
  const r = await prisma.refundRequest.findUnique({ where: { orderId }, select: { status: true, proofData: true, proofMime: true, proofName: true } });
  if (!r || r.status !== "SELESAI" || !r.proofData || !r.proofMime) return tidakAda;
  return download(r.proofData, r.proofMime, r.proofName ?? `bukti-refund-${orderId}`, true);
}
