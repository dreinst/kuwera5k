import { randomInt } from "node:crypto";
import QRCode from "qrcode";
import type { OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { fetchTransactionStatus, mapTransactionStatus, midtrans, type LiveStatus, type MidtransNotification } from "@/lib/midtrans";
import { DEFAULT_FEES, MAX_TICKETS_HARD, PAYMENT_METHOD_IDS, type PaymentMethodId } from "@/lib/registration";
import { currentPrice, getPricing, isOpen } from "@/lib/pricing";

type Db = Prisma.TransactionClient;

// manual = QRIS dinamis dari QRIS statis GoPay Merchant, dikonfirmasi admin (lihat src/lib/qris.ts).
export type PaymentMode = "mock" | "off" | "midtrans" | "manual";
export const paymentMode = (): PaymentMode => {
  const v = process.env.PAYMENT_MODE;
  return v === "mock" || v === "midtrans" || v === "manual" ? v : "off";
};

// Event checkout Meta Pixel hanya untuk pembayaran sungguhan, bukan simulasi atau Midtrans sandbox.
export const trackCheckout = () => paymentMode() === "manual" || (paymentMode() === "midtrans" && midtrans.isProduction);

export const MANUAL_GATEWAY = "qris-manual";
// Pendaftaran menerima uang sungguhan: Midtrans production atau bayar manual QRIS.
export const isLive = () => paymentMode() === "manual" || (paymentMode() === "midtrans" && midtrans.isProduction);
// Pembayaran uang sungguhan; selain ini (mock, midtrans-sandbox) berarti tiket simulasi.
export const isRealGateway = (gateway: string) => gateway === "midtrans" || gateway === MANUAL_GATEWAY;

export type RegistrationSettings = {
  holdMinutes: number;
  quotaTotal: number;
  fees: Record<PaymentMethodId, number>;
  // Metode yang ditampilkan di langkah 4. Kosong/tidak diisi = semua metode. Diatur lewat tabel
  // Setting supaya metode yang belum aktif di merchant Midtrans bisa disembunyikan tanpa deploy.
  methods: PaymentMethodId[];
  maxTickets: number; // tiket maksimal per pembelian
  manualHoldMinutes: number; // lama kuota ditahan untuk bayar manual (admin perlu waktu mengecek)
};

export async function getSettings(): Promise<RegistrationSettings> {
  const row = await prisma.setting.findUnique({ where: { key: "registration" } });
  const v = (row?.value ?? {}) as Partial<RegistrationSettings>;
  const methods = Array.isArray(v.methods) ? PAYMENT_METHOD_IDS.filter((id) => v.methods!.includes(id)) : [];
  return {
    holdMinutes: v.holdMinutes ?? 30,
    quotaTotal: v.quotaTotal ?? 1000,
    fees: { ...DEFAULT_FEES, ...(v.fees ?? {}) },
    methods: methods.length ? methods : [...PAYMENT_METHOD_IDS],
    maxTickets: Math.min(MAX_TICKETS_HARD, Math.max(1, v.maxTickets ?? 5)),
    manualHoldMinutes: v.manualHoldMinutes ?? 180,
  };
}

// Kuota terpakai = lunas + pending yang belum kedaluwarsa (PRD bagian 5).
export function activeOrderWhere(now: Date) {
  return { OR: [{ status: "PAID" as const }, { status: "PENDING" as const, expiresAt: { gt: now } }] };
}

// Kuota dihitung per tiket (satu order bisa beberapa tiket).
export async function heldCount(categoryId: string | null, now = new Date(), db: Db = prisma) {
  const r = await db.order.aggregate({ where: { ...(categoryId ? { categoryId } : {}), ...activeOrderWhere(now) }, _sum: { quantity: true } });
  return r._sum.quantity ?? 0;
}

// Angka di hero dan data terstruktur: peserta lunas dan sisa kuota total.
export async function getPublicStats(now = new Date()) {
  const [settings, paid, held] = await Promise.all([
    getSettings(),
    prisma.order.aggregate({ where: { status: "PAID" }, _sum: { quantity: true } }).then((r) => r._sum.quantity ?? 0),
    heldCount(null, now),
  ]);
  return { paid, remaining: Math.max(0, settings.quotaTotal - held) };
}

// Kunci Postgres untuk pembuatan order: cek kuota, cek duplikat, kuota promo, dan insert berjalan
// satu per satu supaya pendaftaran bersamaan tidak melewati kuota.
export const ORDER_LOCK_KEY = 50_052_026;

// Harga dan nama yang tampil mengikuti pengaturan harga admin (src/lib/pricing.ts), bukan kolom Category.price.
// Pendaftaran yang ditutup admin mengembalikan daftar kosong.
export async function getOpenCategories(now = new Date()) {
  const pricing = await getPricing();
  if (!isOpen(pricing, now)) return [];
  const { label, price } = currentPrice(pricing, now);
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
    out.push({ id: c.id, name: label, price, saleEnd: c.saleEnd.toISOString(), remaining });
  }
  return out;
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function newOrderId(year = new Date().getFullYear()) {
  let s = "";
  for (let i = 0; i < 6; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return `KWR-${year}-${s}`;
}

// Kuota promo dihitung dari order aktif yang memakainya (lunas + pending yang belum lewat hold),
// jadi order yang kedaluwarsa otomatis mengembalikan jatahnya. usedCount hanya mencatat pemakaian lunas.
export async function validatePromo(code: string, price: number, now = new Date(), db: Db = prisma) {
  const promo = await db.promoCode.findUnique({ where: { code } });
  if (!promo || !promo.isActive) return { ok: false as const, message: "Kode promo tidak dikenal" };
  if (now < promo.validFrom || now > promo.validUntil) return { ok: false as const, message: "Kode promo sudah tidak berlaku" };
  const used = await db.order.count({ where: { promoCode: promo.code, ...activeOrderWhere(now) } });
  if (used >= promo.quota) return { ok: false as const, message: "Kuota kode promo sudah habis" };
  const discount = promo.discountType === "percent"
    ? Math.round((price * promo.discountValue) / 100)
    : Math.min(promo.discountValue, price);
  const label = promo.discountType === "percent" ? `Diskon ${promo.discountValue}%` : `Potongan Rp${promo.discountValue.toLocaleString("id-ID")}`;
  return { ok: true as const, discount, label, promo };
}

// Tandai order lunas, catat pembayaran, buat satu tiket per peserta. Idempoten dan aman dipanggil
// bersamaan: update bersyarat status != PAID mengunci baris, jadi notifikasi ganda tidak membuat payment
// atau tiket kedua. Order yang lunas setelah hold habis tetap dilunasi karena uangnya sudah diterima.
// Mengembalikan nomor order, yang juga alamat halaman e-ticket (/tiket/{nomor order}).
export async function markOrderPaid(orderId: string, pay: { gateway: string; gatewayRef?: string | null; method?: string | null; amount: number; rawPayload: unknown }) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { participants: { include: { ticket: true } } } });
  if (!order) return null;
  if (order.status === "PAID" && order.participants.every((p) => p.ticket)) return order.id;
  const tickets = await Promise.all(order.participants.map(async (p) => {
    const code = `${order.id}-${p.position}`;
    const qrSvg = await QRCode.toString(code, { type: "svg", margin: 1, color: { dark: "#0B4A2C", light: "#FFFFFF" } });
    return { participantId: p.id, code, qrSvg };
  }));
  await prisma.$transaction(async (tx) => {
    const flipped = await tx.order.updateMany({ where: { id: orderId, status: { not: "PAID" } }, data: { status: "PAID", paidAt: new Date() } });
    if (flipped.count === 1) {
      await tx.payment.create({
        data: { orderId, gateway: pay.gateway, gatewayRef: pay.gatewayRef ?? null, method: pay.method ?? order.paymentMethod ?? "-", amount: pay.amount, rawPayload: pay.rawPayload as Prisma.InputJsonValue },
      });
      if (order.promoCode) await tx.promoCode.updateMany({ where: { code: order.promoCode }, data: { usedCount: { increment: 1 } } });
    }
    for (const t of tickets) {
      await tx.ticket.upsert({ where: { participantId: t.participantId }, create: { orderId, ...t }, update: {} });
    }
  });
  return order.id;
}

// Kode unik 1..999 supaya setiap order PENDING punya nominal yang berbeda; admin mencocokkan uang masuk
// di GoPay Merchant dari nominalnya. Dipanggil di dalam kunci pembuatan order.
export async function pickUniqueCode(base: number, now: Date, db: Db) {
  const rows = await db.order.findMany({ where: { status: "PENDING", expiresAt: { gt: now }, uniqueCode: { gt: 0 } }, select: { total: true } });
  const taken = new Set(rows.map((r) => r.total));
  const free = [];
  for (let c = 1; c <= 999; c++) if (!taken.has(base + c)) free.push(c);
  return free.length ? free[randomInt(free.length)] : null;
}

type SyncOrder = { id: string; total: number; status: OrderStatus; paymentMethod: string | null; expiresAt: Date | null };
export type SyncResult = {
  status: OrderStatus;
  live: "paid" | "pending" | "denied" | "expired" | "failed" | "not_found" | "error" | "ignored";
  code?: string | null;
  mismatch?: boolean;
  detail?: string;
};

// Terapkan status resmi dari Midtrans ke order (dipakai webhook dan pengecekan ulang).
export async function applyLiveStatus(order: SyncOrder, live: Partial<MidtransNotification> & { transaction_status: string }, now = new Date()): Promise<SyncResult> {
  const mapped = mapTransactionStatus(live.transaction_status, live.fraud_status);
  if (mapped === "DENIED") {
    // Selama hold masih jalan peserta bisa mencoba lagi, jadi order dibiarkan PENDING.
    const holdOver = !order.expiresAt || order.expiresAt <= now;
    if (holdOver && order.status === "PENDING") {
      await prisma.order.updateMany({ where: { id: order.id, status: "PENDING" }, data: { status: "FAILED" } });
      return { status: "FAILED", live: "denied" };
    }
    return { status: order.status, live: "denied" };
  }
  if (mapped === "PAID") {
    const gross = Math.round(Number(live.gross_amount));
    if (gross !== order.total) {
      console.error(`nominal Midtrans ${gross} != order ${order.total} (${order.id})`);
      return { status: order.status, live: "paid", mismatch: true };
    }
    const code = await markOrderPaid(order.id, {
      gateway: midtrans.gateway, gatewayRef: live.transaction_id ?? null,
      method: live.payment_type ?? order.paymentMethod, amount: gross, rawPayload: live,
    });
    return { status: "PAID", live: "paid", code };
  }
  if (mapped === "EXPIRED" || mapped === "FAILED") {
    if (order.status === "PENDING") {
      await prisma.order.updateMany({ where: { id: order.id, status: "PENDING" }, data: { status: mapped } });
      return { status: mapped, live: mapped === "EXPIRED" ? "expired" : "failed" };
    }
    return { status: order.status, live: mapped === "EXPIRED" ? "expired" : "failed" };
  }
  return { status: order.status, live: mapped === "PENDING" ? "pending" : "ignored" };
}

// Cek ulang order PENDING/FAILED ke Midtrans. Menjadi jalur cadangan kalau notifikasi telat atau gagal:
// dipanggil halaman /bayar, polling status, dan pendaftaran ulang dengan email/HP yang sama.
// Tidak pernah melempar error: kegagalan jaringan atau database dilaporkan sebagai live "error".
export async function syncOrderWithMidtrans(order: SyncOrder, now = new Date()): Promise<SyncResult> {
  try {
    return await syncOrThrow(order, now);
  } catch (e) {
    console.error(`sinkron Midtrans ${order.id} gagal`, e);
    return { status: order.status, live: "error", detail: e instanceof Error ? e.message : String(e) };
  }
}

// Order yang perlu dicek ulang: pernah membuka Snap dan belum lunas atau belum final.
export const needsSync = (o: { status: OrderStatus; snapToken: string | null }) =>
  !!o.snapToken && (o.status === "PENDING" || o.status === "FAILED") && paymentMode() === "midtrans";

async function syncOrThrow(order: SyncOrder, now: Date): Promise<SyncResult> {
  const res: LiveStatus = await fetchTransactionStatus(order.id);
  if (res.kind === "error") return { status: order.status, live: "error", detail: res.detail };
  if (res.kind === "not_found") {
    // Belum ada transaksi di Midtrans. Setelah hold habis token Snap juga sudah kedaluwarsa,
    // jadi order aman ditutup.
    if (order.status === "PENDING" && order.expiresAt && order.expiresAt <= now) {
      await prisma.order.updateMany({ where: { id: order.id, status: "PENDING" }, data: { status: "EXPIRED" } });
      return { status: "EXPIRED", live: "not_found" };
    }
    return { status: order.status, live: "not_found" };
  }
  return applyLiveStatus(order, res.data, now);
}
