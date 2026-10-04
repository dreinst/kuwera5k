"use server";

import { prisma } from "@/lib/db";
import { SUPER, allowed, getAdmin, logAdmin } from "@/lib/admin-auth";
import { revalidatePath } from "next/cache";
import { MANUAL_GATEWAY, markOrderPaid } from "@/lib/orders";
import { bacaBerkas, bacaLaporan, cocokkan, type HasilCocok } from "@/lib/cocok-gopay";

export type CocokState = { error?: string; hasil?: HasilCocok } | null;

// Laporan tidak disimpan: dibaca, dicocokkan, lalu hasilnya dikembalikan ke halaman. Uang masuk yang nominalnya sama
// dengan tepat satu order web yang belum lunas langsung ditandai lunas; e-ticket dan QR dikirim kuwera-email-tiket di VPS.
export async function cocokGopayAction(_prev: CocokState, form: FormData): Promise<CocokState> {
  const admin = await getAdmin();
  if (!admin || !allowed(admin.role, SUPER)) return { error: "Hanya superadmin yang bisa mencocokkan laporan GoPay" };
  const berkas = form.get("berkas");
  if (!(berkas instanceof File) || berkas.size === 0) return { error: "Pilih berkas laporan dari GoBiz (ZIP atau CSV)" };
  if (berkas.size > 900_000) return { error: "Berkas terlalu besar. Unduh laporan dengan rentang tanggal yang lebih pendek." };
  let laporan;
  try {
    laporan = bacaLaporan(bacaBerkas(berkas.name, new Uint8Array(await berkas.arrayBuffer())));
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Berkas tidak bisa dibaca" };
  }
  if (laporan.tx.length === 0) return { error: "Laporan tidak berisi transaksi yang sukses" };

  const [bayar, lain] = await Promise.all([
    prisma.payment.findMany({
      where: { gateway: MANUAL_GATEWAY, order: { status: "PAID" } },
      select: { amount: true, receivedAt: true, order: { select: { id: true, isTest: true, createdAt: true, participants: { select: { fullName: true }, orderBy: { position: "asc" }, take: 1 } } } },
    }),
    prisma.order.findMany({ where: { status: { not: "PAID" } }, select: { id: true, status: true, total: true, uniqueCode: true, isTest: true, createdAt: true } }),
  ]);
  const hasil = cocokkan(
    laporan.tx, laporan.dilewati,
    bayar.map((p) => ({ orderId: p.order.id, nama: p.order.participants[0]?.fullName ?? "", nominal: p.amount, diterima: p.receivedAt.getTime(), dibuat: p.order.createdAt.getTime(), uji: p.order.isTest })),
    lain,
  );
  for (const x of [...hasil.tanpaOrder]) {
    // Hanya bila tidak ada keraguan: satu order saja dengan nominal itu, punya kode unik, dan dibuat sebelum uangnya masuk.
    const calon = lain.filter((o) => o.total === x.nominal);
    const o = calon[0];
    if (calon.length !== 1 || hasil.disetujui.some((d) => d.orderId === o.id) || o.uniqueCode <= 0 || o.isTest || o.createdAt.getTime() > x.t || (o.status !== "PENDING" && o.status !== "EXPIRED")) continue;
    await markOrderPaid(o.id, {
      gateway: MANUAL_GATEWAY, gatewayRef: x.ref || null, method: "qris", amount: o.total,
      rawPayload: { verifiedBy: admin.username, via: "laporan-gopay", waktuGopay: x.waktu, verifiedAt: new Date().toISOString(), previousStatus: o.status },
    });
    await logAdmin(admin.username, "tandai_lunas_laporan", `${o.id} Rp${o.total} ref ${x.ref}`);
    hasil.tanpaOrder.splice(hasil.tanpaOrder.indexOf(x), 1);
    hasil.disetujui.push({ orderId: o.id, nominal: o.total });
    hasil.cocok++;
  }
  if (hasil.disetujui.length) revalidatePath("/kuweraadmin", "layout");
  await logAdmin(admin.username, "cocok_gopay", `${hasil.jumlah} transaksi, ${hasil.disetujui.length} disetujui, ${hasil.tanpaOrder.length} tanpa order, ${hasil.tanpaUang.length} tanpa uang`);
  return { hasil };
}
