import { prisma } from "@/lib/db";
import { getAdmin } from "@/lib/admin-auth";
import { download } from "@/lib/admin-files";

// Bukti bayar satu file. ?unduh=1 untuk mengunduh, tanpa itu tampil di browser (dipakai sebagai gambar pratinjau).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getAdmin())) return new Response("Tidak ditemukan", { status: 404 });
  const { id } = await params;
  const proof = await prisma.paymentProof.findUnique({ where: { id } });
  if (!proof) return new Response("Tidak ditemukan", { status: 404 });
  const inline = !new URL(req.url).searchParams.has("unduh");
  return download(proof.data, proof.mimeType, `bukti-${proof.orderId}-${proof.fileName}`, inline);
}
