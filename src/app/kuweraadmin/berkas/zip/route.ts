import { zipSync } from "fflate";
import { prisma } from "@/lib/db";
import { FINANCE, allowed, getAdmin, logAdmin } from "@/lib/admin-auth";
import { download, qrFileName, qrPng } from "@/lib/admin-files";

// Unduh semua sekaligus (ZIP): ?jenis=qr untuk QR registrasi ulang semua tiket, ?jenis=bukti untuk semua bukti bayar.
// Khusus superadmin dan admin keuangan, sama seperti ekspor CSV.
export async function GET(req: Request) {
  const admin = await getAdmin();
  if (!admin || !allowed(admin.role, FINANCE)) return new Response("Tidak diizinkan", { status: 403 });
  const jenis = new URL(req.url).searchParams.get("jenis") === "bukti" ? "bukti" : "qr";
  const files: Record<string, Uint8Array> = {};
  if (jenis === "qr") {
    const tickets = await prisma.ticket.findMany({ orderBy: { createdAt: "asc" }, include: { participant: { select: { fullName: true } } } });
    for (const t of tickets) files[qrFileName(t.code, t.participant?.fullName ?? "")] = await qrPng(t.code);
  } else {
    const proofs = await prisma.paymentProof.findMany({ orderBy: { createdAt: "asc" } });
    for (const p of proofs) files[`${p.orderId}/${p.fileName}`] = p.data;
  }
  await logAdmin(admin.username, `unduh_zip_${jenis}`, `${Object.keys(files).length} file`);
  const date = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });
  return download(zipSync(files, { level: 0 }), "application/zip", `${jenis === "qr" ? "qr-registrasi-ulang" : "bukti-bayar"}-kuwera-${date}.zip`);
}
