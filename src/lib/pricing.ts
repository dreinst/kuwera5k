import { prisma } from "@/lib/db";

// Harga tiket dan status buka/tutup pendaftaran, diatur admin di /kuweraadmin/harga (tabel Setting, key "pricing").
// Harga promo (misalnya Early Bird) berlaku selama dinyalakan dan berada di jendela waktunya; di luar itu harga normal.
// Waktu disimpan sebagai ISO string; kosong = tanpa batas.
export type Pricing = {
  open: boolean; // saklar utama pendaftaran
  openAt: string | null; // kalau diisi, pendaftaran baru dibuka pada waktu ini
  promo: { enabled: boolean; label: string; price: number; start: string | null; end: string | null };
  regular: { label: string; price: number };
};

export const DEFAULT_PRICING: Pricing = {
  open: true,
  openAt: null,
  promo: { enabled: false, label: "Early Bird", price: 125000, start: null, end: null },
  regular: { label: "Reguler", price: 150000 },
};

export async function getPricing(): Promise<Pricing> {
  const row = await prisma.setting.findUnique({ where: { key: "pricing" } });
  const v = (row?.value ?? {}) as Partial<Pricing>;
  return {
    open: v.open ?? DEFAULT_PRICING.open,
    openAt: v.openAt ?? null,
    promo: { ...DEFAULT_PRICING.promo, ...(v.promo ?? {}) },
    regular: { ...DEFAULT_PRICING.regular, ...(v.regular ?? {}) },
  };
}

export function promoActive(p: Pricing, now = new Date()) {
  const { enabled, start, end } = p.promo;
  return enabled && (!start || now >= new Date(start)) && (!end || now < new Date(end));
}

// Harga yang berlaku sekarang. `regular` ikut dikembalikan supaya tampilan bisa menunjukkan harga normal saat promo.
export function currentPrice(p: Pricing, now = new Date()) {
  const promo = promoActive(p, now);
  return { promo, label: promo ? p.promo.label : p.regular.label, price: promo ? p.promo.price : p.regular.price, regular: p.regular };
}

export function isOpen(p: Pricing, now = new Date()) {
  return p.open && (!p.openAt || now >= new Date(p.openAt));
}
