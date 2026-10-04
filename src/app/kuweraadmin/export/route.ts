import { prisma } from "@/lib/db";
import { FINANCE, allowed, getAdmin, logAdmin } from "@/lib/admin-auth";
import { registrantWhere, STATUS_LABEL } from "@/lib/admin-data";

// Unduh data peserta (CSV untuk Excel). Khusus superadmin dan admin keuangan karena memuat NIK dan alamat.
export async function GET(req: Request) {
  const admin = await getAdmin();
  if (!admin || !allowed(admin.role, FINANCE)) return new Response("Tidak diizinkan", { status: 403 });
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const status = url.searchParams.get("status") ?? "";
  const rows = await prisma.order.findMany({
    where: { ...registrantWhere(q, status), isTest: false }, // data uji tidak ikut diekspor
    orderBy: { createdAt: "asc" },
    include: { participants: { orderBy: { position: "asc" }, include: { ticket: true } } },
  });

  // Sel yang diawali = + - @ bisa dijalankan Excel sebagai rumus; diberi tanda kutip tunggal di depan.
  const cell = (v: unknown) => {
    let s = v === null || v === undefined ? "" : v instanceof Date ? v.toISOString() : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const header = [
    "Nomor order", "Peserta ke", "Jumlah tiket", "Status", "Didaftarkan", "Lunas", "Nama lengkap", "Nama depan", "Nama belakang", "NIK", "Email", "HP",
    "Tanggal lahir", "Jenis kelamin", "Golongan darah", "Alamat", "Kota/kabupaten", "Provinsi", "Kode pos", "Ukuran jersey",
    "Kontak darurat", "HP kontak darurat", "Komunitas", "Metode bayar", "Subtotal order", "Diskon", "Kode promo", "Biaya layanan",
    "Total", "Kode tiket", "Race pack diambil", "Dicatat oleh",
  ];
  // Satu baris per peserta; kolom harga dan total milik order, jadi hanya diisi di baris peserta 1.
  const lines = rows.flatMap((o) => o.participants.map((p) => {
    const first = p.position === 1;
    return [
      o.id, p.position, o.quantity, STATUS_LABEL[o.status], o.createdAt, o.paidAt, p?.fullName, p?.firstName, p?.lastName, p?.idNumber, p?.email, p?.phone,
      p?.birthDate.toISOString().slice(0, 10), p?.gender, p?.bloodType, p?.address, p?.city, p?.province, p?.postalCode, p?.jerseySize,
      p?.emergencyName, p?.emergencyPhone, p?.community, o.paymentMethod,
      first ? o.subtotal : null, first ? o.discount : null, o.promoCode, first ? o.fee : null, first ? o.total : null,
      p.ticket?.code, p.ticket?.racepackCollectedAt, p.ticket?.collectedBy,
    ].map(cell).join(",");
  }));
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
