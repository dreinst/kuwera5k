import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { SUPER, allowed, getAdmin, logAdmin } from "@/lib/admin-auth";
import { download } from "@/lib/admin-files";
import { JENIS, MAKS_BYTE, stempelWib } from "@/lib/berkas-gambar";

export const runtime = "nodejs";

// Bukti transfer refund (khusus superadmin). GET menampilkan buktinya; POST mengunggah bukti dan sekaligus menandai
// refund selesai: tanpa bukti transfer, pengajuan tidak bisa ditutup. Order ikut berubah menjadi REFUNDED, lalu skrip
// kuwera-email-tiket di VPS mengirim bukti itu ke email pemesan.
export async function GET(_req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const admin = await getAdmin();
  if (!admin || !allowed(admin.role, SUPER)) return new Response("Tidak ditemukan", { status: 404 });
  const { orderId } = await params;
  const r = await prisma.refundRequest.findUnique({ where: { orderId }, select: { proofData: true, proofMime: true, proofName: true } });
  if (!r?.proofData || !r.proofMime) return new Response("Tidak ditemukan", { status: 404 });
  return download(r.proofData, r.proofMime, r.proofName ?? `bukti-refund-${orderId}`, true);
}

const gagal = (error: string, status = 400) => Response.json({ error }, { status });

export async function POST(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const admin = await getAdmin();
  if (!admin || !allowed(admin.role, SUPER)) return gagal("Hanya superadmin yang bisa menandai refund selesai", 403);
  const { orderId } = await params;
  const file = (await req.formData().catch(() => null))?.get("bukti");
  if (!(file instanceof File) || file.size === 0) return gagal("Pilih gambar bukti transfernya dulu");
  const jenis = JENIS[file.type];
  if (!jenis) return gagal("Bukti transfer perlu berupa gambar JPG, PNG, atau WebP");
  if (file.size > MAKS_BYTE) return gagal("Ukuran gambarnya lebih dari 4 MB");
  const data = Buffer.from(await file.arrayBuffer());
  if (!jenis.cocok(data)) return gagal("File ini tidak terbaca sebagai gambar");

  const hasil = await prisma.$transaction(async (tx) => {
    // Hanya pengajuan berstatus Diajukan yang bisa ditutup; yang sedang diminta perbaikan menunggu rekening baru dulu.
    const r = await tx.refundRequest.updateMany({
      where: { orderId, status: "DIAJUKAN", verified: true, order: { status: "PAID" } },
      data: { status: "SELESAI", transferredAt: new Date(), processedBy: admin.username, proofName: `${stempelWib()}-refund-${orderId}.${jenis.ext}`, proofMime: file.type, proofData: data },
    });
    if (r.count !== 1) return null;
    await tx.order.update({ where: { id: orderId }, data: { status: "REFUNDED" } });
    return tx.refundRequest.findUnique({ where: { orderId }, select: { amount: true } });
  });
  if (!hasil) return gagal("Pengajuan ini tidak sedang menunggu transfer atau belum terverifikasi. Muat ulang halaman.", 409);
  await logAdmin(admin.username, "refund_selesai", `${orderId} Rp${hasil.amount}`);
  revalidatePath("/kuweraadmin/refund");
  return Response.json({ ok: true });
}
