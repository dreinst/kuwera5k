// Data awal pendaftaran (dummy sampai panitia konfirmasi). Aman dijalankan berulang.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const categories = [
  { name: "Early Bird 5K", price: 150000, quota: 1000, saleStart: "2026-09-01", saleEnd: "2026-11-15" },
  { name: "Reguler 5K", price: 200000, quota: 1000, saleStart: "2026-11-16", saleEnd: "2026-12-12" },
];
for (const c of categories) {
  const existing = await prisma.category.findFirst({ where: { name: c.name } });
  const data = { ...c, saleStart: new Date(`${c.saleStart}T00:00:00+07:00`), saleEnd: new Date(`${c.saleEnd}T23:59:59+07:00`), isActive: true };
  if (existing) await prisma.category.update({ where: { id: existing.id }, data });
  else await prisma.category.create({ data });
}

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
