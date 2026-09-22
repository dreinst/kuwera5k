// Data awal pendaftaran (dummy sampai panitia konfirmasi). Aman dijalankan berulang.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

// Satu kategori, harga Rp125.000 (keputusan Donny 2026-09-22). Baris "Early Bird 5K" lama
// diganti nama supaya order yang sudah ada tetap terhubung; "Reguler 5K" dinonaktifkan.
const main = { name: "Pendaftaran 5K", price: 125000, quota: 1000, isActive: true,
  saleStart: new Date("2026-09-01T00:00:00+07:00"), saleEnd: new Date("2026-12-12T23:59:59+07:00") };
const old = await prisma.category.findFirst({ where: { name: { in: ["Early Bird 5K", "Pendaftaran 5K"] } } });
if (old) await prisma.category.update({ where: { id: old.id }, data: main });
else await prisma.category.create({ data: main });
await prisma.category.updateMany({ where: { name: "Reguler 5K" }, data: { isActive: false } });

await prisma.promoCode.upsert({
  where: { code: "KUWERA10" },
  update: {},
  create: { code: "KUWERA10", discountType: "percent", discountValue: 10, quota: 100, validFrom: new Date("2026-09-01T00:00:00+07:00"), validUntil: new Date("2026-12-12T23:59:59+07:00") },
});

await prisma.setting.upsert({
  where: { key: "registration" },
  update: {},
  create: {
    key: "registration",
    value: {
      holdMinutes: 30,
      quotaTotal: 1000,
      fees: { qris: 1500, bca_va: 4500, bni_va: 4500, bri_va: 4500, mandiri_va: 4500, permata_va: 4500, cimb_va: 4500, gopay: 4000, shopeepay: 4000, credit_card: 7500 },
    },
  },
});

console.log("seed selesai:", await prisma.category.count(), "kategori,", await prisma.promoCode.count(), "promo");
await prisma.$disconnect();
