"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { SUPER, allowed, getAdmin, logAdmin } from "@/lib/admin-auth";

// Minta pemesan memperbaiki data rekening (misalnya nomor tidak dikenali bank). Alasannya tampil di halaman refund
// pemesan dan dikirim lewat email oleh skrip kuwera-email-tiket di VPS. Menandai selesai ada di route unggah bukti
// transfer (/kuweraadmin/berkas/refund/[orderId]), karena wajib disertai gambar buktinya.
export async function refundPerbaikanAction(orderId: string, alasan: string): Promise<{ ok?: string; error?: string }> {
  const admin = await getAdmin();
  if (!admin || !allowed(admin.role, SUPER)) return { error: "Hanya superadmin yang bisa memproses refund" };
  const note = alasan.trim().slice(0, 300);
  if (note.length < 5) return { error: "Tulis alasannya supaya pemesan tahu apa yang perlu diperbaiki" };
  const r = await prisma.refundRequest.updateMany({ where: { orderId, status: "DIAJUKAN" }, data: { status: "PERLU_PERBAIKAN", note } });
  if (!r.count) return { error: "Pengajuan ini tidak sedang menunggu transfer. Muat ulang halaman." };
  await logAdmin(admin.username, "refund_perbaikan", `${orderId} ${note}`);
  revalidatePath("/kuweraadmin/refund");
  return { ok: "Pemesan dikabari lewat email dalam sekitar satu menit" };
}
