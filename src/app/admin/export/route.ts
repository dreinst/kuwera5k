import { prisma } from "@/lib/db";
import { getAdmin, logAdmin } from "@/lib/admin-auth";
import { registrantWhere, STATUS_LABEL } from "@/lib/admin-data";

// Unduh data peserta (CSV untuk Excel). Khusus peran admin karena memuat NIK dan alamat.
export async function GET(req: Request) {
  const admin = await getAdmin();
  if (!admin || admin.role !== "admin") return new Response("Tidak diizinkan", { status: 403 });
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const status = url.searchParams.get("status") ?? "";
  const rows = await prisma.order.findMany({
    where: registrantWhere(q, status),
    orderBy: { createdAt: "asc" },
    include: { participant: true, ticket: true },
  });

  // Sel yang diawali = + - @ bisa dijalankan Excel sebagai rumus; diberi tanda kutip tunggal di depan.
  const cell = (v: unknown) => {
    let s = v === null || v === undefined ? "" : v instanceof Date ? v.toISOString() : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const header = [
    "Nomor order", "Status", "Didaftarkan", "Lunas", "Nama lengkap", "Nama depan", "Nama belakang", "NIK", "Email", "HP",
    "Tanggal lahir", "Jenis kelamin", "Golongan darah", "Alamat", "Kota/kabupaten", "Provinsi", "Kode pos", "Ukuran jersey",
    "Kontak darurat", "HP kontak darurat", "Komunitas", "Metode bayar", "Harga tiket", "Diskon", "Kode promo", "Biaya layanan",
    "Total", "Kode tiket", "Race pack diambil", "Dicatat oleh",
  ];
  const lines = rows.map((o) => {
    const p = o.participant;
    return [
      o.id, STATUS_LABEL[o.status], o.createdAt, o.paidAt, p?.fullName, p?.firstName, p?.lastName, p?.idNumber, p?.email, p?.phone,
      p?.birthDate.toISOString().slice(0, 10), p?.gender, p?.bloodType, p?.address, p?.city, p?.province, p?.postalCode, p?.jerseySize,
      p?.emergencyName, p?.emergencyPhone, p?.community, o.paymentMethod, o.subtotal, o.discount, o.promoCode, o.fee,
      o.total, o.ticket?.code, o.ticket?.racepackCollectedAt, o.ticket?.collectedBy,
    ].map(cell).join(",");
  });
  await logAdmin(admin.username, "ekspor_csv", `${rows.length} baris`);
  const date = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  return new Response("﻿" + [header.map(cell).join(","), ...lines].join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="peserta-kuwera5k-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
