// Data awal pendaftaran (dummy sampai panitia konfirmasi). Aman dijalankan berulang.
import "dotenv/config";
import tls from "node:tls";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// TLS sama dengan src/lib/db.ts: DB_SSL_CA (CA) dan DB_SSL_SERVERNAME (nama di sertifikat) kalau lewat IP.
const dbSsl = () => {
  const ca = process.env.DB_SSL_CA?.replace(/\\n/g, "\n").trim();
  if (!ca) return undefined;
  const name = process.env.DB_SSL_SERVERNAME;
  return { ca, rejectUnauthorized: true, ...(name ? { checkServerIdentity: (_h, cert) => tls.checkServerIdentity(name, cert) } : {}) };
};
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: dbSsl() }) });

// Satu kategori, harga Rp125.000 (keputusan Donny 2026-09-22). Acara Sabtu 24 Oktober 2026 pukul 06.00,
// jadi penjualan ditutup H-1 minggu (Sabtu 17 Oktober 23.59 WIB) karena ukuran jersey harus dikirim ke vendor,
// atau lebih awal kalau kuota 1.500 penuh. Baris "Early Bird 5K" lama
// diganti nama supaya order yang sudah ada tetap terhubung; "Reguler 5K" dinonaktifkan.
const main = { name: "Pendaftaran 5K", price: 125000, quota: 1500, isActive: true,
  saleStart: new Date("2026-09-01T00:00:00+07:00"), saleEnd: new Date("2026-10-17T23:59:59+07:00") };
const old = await prisma.category.findFirst({ where: { name: { in: ["Early Bird 5K", "Pendaftaran 5K"] } } });
if (old) await prisma.category.update({ where: { id: old.id }, data: main });
else await prisma.category.create({ data: main });
await prisma.category.updateMany({ where: { name: "Reguler 5K" }, data: { isActive: false } });

await prisma.promoCode.upsert({
  where: { code: "KUWERA10" },
  update: {},
  create: { code: "KUWERA10", discountType: "percent", discountValue: 10, quota: 100, validFrom: new Date("2026-09-01T00:00:00+07:00"), validUntil: new Date("2026-10-17T23:59:59+07:00") },
});

await prisma.setting.upsert({
  where: { key: "registration" },
  update: {},
  create: {
    key: "registration",
    value: {
      holdMinutes: 30,
      quotaTotal: 1500,
      fees: { qris: 1500, bca_va: 4500, bni_va: 4500, bri_va: 4500, mandiri_va: 4500, permata_va: 4500, cimb_va: 4500, gopay: 4000, shopeepay: 4000, credit_card: 7500 },
    },
  },
});

console.log("seed selesai:", await prisma.category.count(), "kategori,", await prisma.promoCode.count(), "promo");
await prisma.$disconnect();
