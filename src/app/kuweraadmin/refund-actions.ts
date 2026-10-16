"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { SUPER, allowed, getAdmin, logAdmin } from "@/lib/admin-auth";
import { REFUND_PROVIDERS, getRefund, refundAmount, type RefundMethod } from "@/lib/refund";

// Pemesan yang tidak mengisi tautan refund mengirim rekeningnya lewat WhatsApp; superadmin mengisikannya di sini.
// Hasilnya sama dengan pengajuan dari tautan (Diajukan, terverifikasi), lalu ditutup lewat unggah bukti transfer.
export async function refundManualAction(orderId: string, isi: { method: string; provider: string; accountNumber: string; accountName: string }): Promise<{ ok?: string; error?: string }> {
  const admin = await getAdmin();
  if (!admin || !allowed(admin.role, SUPER)) return { error: "Hanya superadmin yang bisa memproses refund" };
  const cfg = await getRefund();
  if (!cfg) return { error: "Refund belum dinyalakan" };
  const method = isi.method as RefundMethod;
  const accountNumber = isi.accountNumber.replace(/[\s.-]/g, "");
  const accountName = isi.accountName.trim().slice(0, 80);
  if (!REFUND_PROVIDERS[method]?.includes(isi.provider)) return { error: "Pilih bank atau dompet digitalnya" };
  if (!/^\d{8,20}$/.test(accountNumber)) return { error: "Nomor berisi 8 sampai 20 angka" };
  if (accountName.length < 3) return { error: "Isi nama pemilik rekening" };
  const order = await prisma.order.findFirst({ where: { id: orderId, status: "PAID" }, select: { id: true, total: true } });
  if (!order) return { error: "Order ini tidak sedang menunggu refund. Muat ulang halaman." };
  const data = { amount: refundAmount(cfg, order), method, provider: isi.provider, accountNumber, accountName, verified: true, status: "DIAJUKAN", note: null };
  const diubah = await prisma.refundRequest.updateMany({ where: { orderId, status: { not: "SELESAI" } }, data });
  if (!diubah.count && !(await prisma.refundRequest.create({ data: { orderId, ...data } }).catch(() => null))) return { error: "Refund order ini sudah selesai" };
  await logAdmin(admin.username, "refund_manual", `${orderId} ${isi.provider} ${accountNumber} ${accountName}`);
  revalidatePath("/kuweraadmin/refund");
  return { ok: "Tersimpan. Setelah ditransfer, unggah bukti transfernya di kartu ini." };
}

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
