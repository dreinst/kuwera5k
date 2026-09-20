import { prisma } from "@/lib/db";
import { DEFAULT_FEES, type PaymentMethodId } from "@/lib/registration";

export type PaymentMode = "mock" | "off" | "midtrans";
export const paymentMode = (): PaymentMode => {
  const v = process.env.PAYMENT_MODE;
  return v === "mock" || v === "midtrans" ? v : "off";
};

export type RegistrationSettings = {
  holdMinutes: number;
  quotaTotal: number;
  fees: Record<PaymentMethodId, number>;
};

export async function getSettings(): Promise<RegistrationSettings> {
  const row = await prisma.setting.findUnique({ where: { key: "registration" } });
  const v = (row?.value ?? {}) as Partial<RegistrationSettings>;
  return {
    holdMinutes: v.holdMinutes ?? 30,
    quotaTotal: v.quotaTotal ?? 1000,
    fees: { ...DEFAULT_FEES, ...(v.fees ?? {}) },
  };
}

// Kuota terpakai = lunas + pending yang belum kedaluwarsa (PRD bagian 5).
export function activeOrderWhere(now: Date) {
  return { OR: [{ status: "PAID" as const }, { status: "PENDING" as const, expiresAt: { gt: now } }] };
}

export async function heldCount(categoryId: string | null, now = new Date()) {
  return prisma.order.count({ where: { ...(categoryId ? { categoryId } : {}), ...activeOrderWhere(now) } });
}

export async function getOpenCategories(now = new Date()) {
  const cats = await prisma.category.findMany({
    where: { isActive: true, saleStart: { lte: now }, saleEnd: { gte: now } },
    orderBy: { price: "asc" },
  });
  const settings = await getSettings();
  const totalHeld = await heldCount(null, now);
  const out = [];
  for (const c of cats) {
    const held = await heldCount(c.id, now);
    const remaining = Math.max(0, Math.min(c.quota - held, settings.quotaTotal - totalHeld));
    out.push({ id: c.id, name: c.name, price: c.price, saleEnd: c.saleEnd.toISOString(), remaining });
  }
  return out;
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function newOrderId(year = new Date().getFullYear()) {
  let s = "";
  for (let i = 0; i < 6; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return `KWR-${year}-${s}`;
}

export async function validatePromo(code: string, price: number, now = new Date()) {
  const promo = await prisma.promoCode.findUnique({ where: { code } });
  if (!promo || !promo.isActive) return { ok: false as const, message: "Kode promo tidak dikenal" };
  if (now < promo.validFrom || now > promo.validUntil) return { ok: false as const, message: "Kode promo sudah tidak berlaku" };
  if (promo.usedCount >= promo.quota) return { ok: false as const, message: "Kuota kode promo sudah habis" };
  const discount = promo.discountType === "percent"
    ? Math.round((price * promo.discountValue) / 100)
    : Math.min(promo.discountValue, price);
  const label = promo.discountType === "percent" ? `Diskon ${promo.discountValue}%` : `Potongan Rp${promo.discountValue.toLocaleString("id-ID")}`;
  return { ok: true as const, discount, label, promo };
}
