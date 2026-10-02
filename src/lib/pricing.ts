import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

// Harga tiket dan status buka/tutup pendaftaran, diatur admin di /kuweraadmin/harga (tabel Setting, key "pricing").
// Harga promo (misalnya Early Bird) berlaku selama dinyalakan dan berada di jendela waktunya; di luar itu harga normal.
// Waktu disimpan sebagai ISO string; kosong = tanpa batas. Harga promo juga bisa dibatasi kuota tiket (promo.quota):
// setelah tiket berharga promo yang lunas atau masih menunggu bayar mencapai kuota, harga normal yang berlaku.
// promo.daily (jam WIB "HH:MM") membatasi promo ke jam tertentu tiap hari, misalnya Early Bird 09.00 sampai 10.00.
export type Pricing = {
  open: boolean; // saklar utama pendaftaran
  openAt: string | null; // kalau diisi, pendaftaran baru dibuka pada waktu ini
  promo: {
    enabled: boolean; label: string; price: number; start: string | null; end: string | null; quota: number | null;
    daily: { from: string; to: string } | null;
  };
  regular: { label: string; price: number };
  promoUsed?: number; // dihitung saat dibaca (tidak disimpan): tiket berharga promo yang lunas atau masih ditahan
};

export const DEFAULT_PRICING: Pricing = {
  open: true,
  openAt: null,
  promo: { enabled: false, label: "Early Bird", price: 125000, start: null, end: null, quota: null, daily: null },
  regular: { label: "Reguler", price: 150000 },
};

export async function getPricing(): Promise<Pricing> {
  const row = await prisma.setting.findUnique({ where: { key: "pricing" } });
  const v = (row?.value ?? {}) as Partial<Pricing>;
  const promo = { ...DEFAULT_PRICING.promo, ...(v.promo ?? {}) };
  return {
    open: v.open ?? DEFAULT_PRICING.open,
    openAt: v.openAt ?? null,
    promo,
    regular: { ...DEFAULT_PRICING.regular, ...(v.regular ?? {}) },
    promoUsed: promo.quota ? await promoUsed(promo.price) : 0,
  };
}

// Tiket yang sudah memakai harga promo: order lunas atau masih menunggu bayar (belum kedaluwarsa), tanpa data uji.
export async function promoUsed(price: number, now = new Date(), db: Prisma.TransactionClient | typeof prisma = prisma) {
  const [r] = await db.$queryRaw<{ n: number }[]>`
    SELECT coalesce(sum(quantity), 0)::int AS n FROM "Order"
     WHERE NOT "isTest" AND source = 'web' AND subtotal = ${price} * quantity
       AND (status = 'PAID' OR (status = 'PENDING' AND "expiresAt" > ${now}))`;
  return r?.n ?? 0;
}

// Sisa kuota harga promo (null = tanpa batas kuota).
export const promoLeft = (p: Pricing) => (p.promo.quota ? Math.max(0, p.promo.quota - (p.promoUsed ?? 0)) : null);

const WIB = 7 * 3600_000;
const menit = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
// Jam "HH:MM" WIB pada tanggal WIB yang sama dengan `day`.
const wibAt = (day: Date, hhmm: string) => {
  const d = new Date(day.getTime() + WIB);
  d.setUTCHours(0, menit(hhmm), 0, 0);
  return new Date(d.getTime() - WIB);
};

export function promoActive(p: Pricing, now = new Date()) {
  const { enabled, start, end, daily } = p.promo;
  const left = promoLeft(p);
  const inDaily = !daily || (now >= wibAt(now, daily.from) && now < wibAt(now, daily.to));
  return enabled && inDaily && (!start || now >= new Date(start)) && (!end || now < new Date(end)) && (left === null || left > 0);
}

// Kapan harga promo yang sedang berlaku berakhir (akhir jam harian hari ini atau promo.end, mana yang lebih dulu).
export function promoEndsAt(p: Pricing, now = new Date()) {
  if (!promoActive(p, now)) return null;
  const ends = [p.promo.end ? new Date(p.promo.end) : null, p.promo.daily ? wibAt(now, p.promo.daily.to) : null].filter((d): d is Date => !!d);
  return ends.length ? new Date(Math.min(...ends.map((d) => d.getTime()))).toISOString() : null;
}

// Jadwal promo harian berikutnya selagi promo belum aktif (null kalau tidak ada lagi).
export function nextPromoAt(p: Pricing, now = new Date()) {
  const { enabled, start, end, daily } = p.promo;
  const left = promoLeft(p);
  if (!enabled || !daily || (left !== null && left <= 0) || promoActive(p, now)) return null;
  const from = start && new Date(start) > now ? new Date(start) : now;
  let at = wibAt(from, daily.from);
  if (at < from || (from === now && at <= now)) at = wibAt(new Date(from.getTime() + 24 * 3600_000), daily.from);
  return !end || at < new Date(end) ? at.toISOString() : null;
}

// Harga yang berlaku sekarang. `regular` ikut dikembalikan supaya tampilan bisa menunjukkan harga normal saat promo.
export function currentPrice(p: Pricing, now = new Date()) {
  const promo = promoActive(p, now);
  return { promo, label: promo ? p.promo.label : p.regular.label, price: promo ? p.promo.price : p.regular.price, regular: p.regular };
}

export function isOpen(p: Pricing, now = new Date()) {
  return p.open && (!p.openAt || now >= new Date(p.openAt));
}
