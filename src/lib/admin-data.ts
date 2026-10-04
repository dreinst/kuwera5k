import type { OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { fetchTransactionStatus, mapTransactionStatus, midtrans } from "@/lib/midtrans";
import { MANUAL_GATEWAY, expireStaleOrders, getSettings, heldCount } from "@/lib/orders";
import { JERSEY_SIZES } from "@/lib/registration";
import { getPenarikan, ringkasPenarikan } from "@/lib/penarikan";
import { getPricing } from "@/lib/pricing";
import { STATUS_LABEL, type MidtransCheck } from "@/lib/admin-shared";

export { STATUS_LABEL, type MidtransCheck };

// Query untuk halaman admin. Pemanggil wajib sudah lolos requireAdmin().


export const fmtDateTime = (d: Date | null | undefined) =>
  d ? d.toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";
export const maskNik = (nik: string | null | undefined) => (nik ? `${nik.slice(0, 4)}********${nik.slice(-4)}` : "-");

export async function dashboardStats(now = new Date()) {
  await expireStaleOrders(now);
  const [byStatus, activePending, paidSums, penarikan, settings, held, jersey, gender, blood, cities, collected, recent] = await Promise.all([
    prisma.order.groupBy({ by: ["status"], where: { isTest: false }, _count: { _all: true } }),
    prisma.order.count({ where: { status: "PENDING", isTest: false, expiresAt: { gt: now } } }),
    prisma.order.aggregate({ where: { status: "PAID", isTest: false }, _sum: { subtotal: true, discount: true, fee: true, total: true, uniqueCode: true } }),
    getPenarikan(),
    getSettings(),
    heldCount(null, now),
    prisma.participant.groupBy({ by: ["jerseySize"], where: { order: { status: "PAID", isTest: false } }, _count: { _all: true } }),
    prisma.participant.groupBy({ by: ["gender"], where: { order: { status: "PAID", isTest: false, source: "web" } }, _count: { _all: true } }),
    prisma.participant.groupBy({ by: ["bloodType"], where: { order: { status: "PAID", isTest: false } }, _count: { _all: true } }),
    prisma.participant.groupBy({ by: ["city"], where: { order: { status: "PAID", isTest: false } }, _count: { _all: true }, orderBy: { _count: { city: "desc" } }, take: 5 }),
    prisma.ticket.count({ where: { racepackCollectedAt: { not: null }, order: { isTest: false } } }),
    prisma.order.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { participants: { where: { position: 1 }, select: { fullName: true } } } }),
  ]);
  const count = (s: OrderStatus) => byStatus.find((b) => b.status === s)?._count._all ?? 0;
  // Peserta lunas per harga tiket yang dibayar (harga satuan saat order dibuat), dipisah web dan anggota Kudam.
  const [paidOrders, pricing] = await Promise.all([
    prisma.order.findMany({ where: { status: "PAID", isTest: false }, select: { subtotal: true, discount: true, quantity: true, source: true } }),
    getPricing(),
  ]);
  const tiers = new Map<string, { price: number; kudam: boolean; tiket: number; transaksi: number }>();
  for (const o of paidOrders) {
    const price = Math.round((o.subtotal - o.discount) / Math.max(1, o.quantity));
    const kudam = o.source === "kudam";
    const key = `${kudam}-${price}`;
    const t = tiers.get(key) ?? { price, kudam, tiket: 0, transaksi: 0 };
    t.tiket += o.quantity; t.transaksi += 1; tiers.set(key, t);
  }
  const tierLabel = (t: { price: number; kudam: boolean }) =>
    t.kudam ? "Anggota Kudam" : t.price === pricing.promo.price ? pricing.promo.label : t.price === pricing.regular.price ? pricing.regular.label : "Harga lain";
  const priceTiers = [...tiers.values()].sort((a, b) => a.price - b.price || Number(a.kudam) - Number(b.kudam)).map((t) => ({ ...t, label: tierLabel(t) }));

  // Peserta lunas dihitung per tiket (satu order bisa beberapa tiket).
  const paid = await prisma.participant.count({ where: { order: { status: "PAID", isTest: false } } });

  // Pendaftar lunas per hari (WIB), 14 hari terakhir. Semua angka di sini tanpa order data uji.
  const since = new Date(now.getTime() - 13 * 86400_000);
  const paidRecent = await prisma.order.findMany({ where: { status: "PAID", isTest: false, paidAt: { gte: since } }, select: { paidAt: true, quantity: true } });
  const dayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  const daily = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(since.getTime() + i * 86400_000);
    return { key: dayKey(d), label: d.toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short" }), count: 0 };
  });
  for (const o of paidRecent) {
    const slot = daily.find((x) => x.key === dayKey(o.paidAt!));
    if (slot) slot.count += o.quantity;
  }

  return {
    paid, activePending, expired: count("EXPIRED"), failed: count("FAILED"), refunded: count("REFUNDED"),
    staleOrders: count("PENDING") - activePending,
    revenueTicket: (paidSums._sum.subtotal ?? 0) - (paidSums._sum.discount ?? 0),
    revenueTotal: paidSums._sum.total ?? 0,
    uniqueCodes: paidSums._sum.uniqueCode ?? 0,
    penarikan: ringkasPenarikan(penarikan),
    quotaTotal: settings.quotaTotal,
    remaining: Math.max(0, settings.quotaTotal - held),
    jersey: JERSEY_SIZES.map((s) => ({ size: s, count: jersey.find((j) => j.jerseySize === s)?._count._all ?? 0 })),
    gender: { L: gender.find((g) => g.gender === "L")?._count._all ?? 0, P: gender.find((g) => g.gender === "P")?._count._all ?? 0 },
    blood: blood.map((b) => ({ type: b.bloodType ?? "Tidak diisi", count: b._count._all })),
    cities: cities.map((c) => ({ city: c.city ?? "Tidak diisi", count: c._count._all })),
    collected,
    priceTiers,
    daily,
    recent,
    mode: { payment: process.env.PAYMENT_MODE ?? "off", production: midtrans.isProduction },
  };
}

export const PAGE_SIZE = 50;

export function registrantWhere(q: string, status: string): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = {};
  if (status && status in STATUS_LABEL) where.status = status as OrderStatus;
  const term = q.trim();
  if (term) {
    where.OR = [
      { id: { contains: term.toUpperCase() } },
      { buyerEmail: { contains: term.toLowerCase() } },
      { buyerPhone: { contains: term } },
      { participants: { some: { fullName: { contains: term, mode: "insensitive" } } } },
      { participants: { some: { idNumber: { contains: term } } } },
    ];
  }
  return where;
}

export async function listRegistrants(q: string, status: string, page: number) {
  await expireStaleOrders();
  const where = registrantWhere(q, status);
  const [total, rows] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
      include: {
        participants: { orderBy: { position: "asc" }, select: { fullName: true, idNumber: true, jerseySize: true } },
        tickets: { select: { racepackCollectedAt: true } }, payments: { select: { gateway: true } },
      },
    }),
  ]);
  return { total, rows };
}


export async function checkOrderWithMidtrans(order: { id: string; status: OrderStatus; total: number; payments: { gateway: string }[] }): Promise<MidtransCheck> {
  const base = { orderId: order.id, dbStatus: order.status, total: order.total };
  if (order.payments.some((p) => p.gateway === MANUAL_GATEWAY)) {
    return { ...base, verdict: "simulasi", note: "Dibayar lewat QRIS manual (dikonfirmasi admin), bukan transaksi Midtrans" };
  }
  if (order.payments.length && order.payments.every((p) => p.gateway !== "midtrans" && p.gateway !== "midtrans-sandbox")) {
    return { ...base, verdict: "simulasi", note: "Dibayar lewat simulasi (mode pratinjau), tidak ada transaksi Midtrans" };
  }
  const res = await fetchTransactionStatus(order.id);
  if (res.kind === "error") return { ...base, verdict: "error", note: `Midtrans tidak bisa dihubungi: ${res.detail}` };
  if (res.kind === "not_found") {
    return order.status === "PAID"
      ? { ...base, verdict: "tidak_cocok", note: "Database mencatat lunas, tapi transaksinya tidak ada di Midtrans" }
      : { ...base, verdict: "tidak_ada", note: "Peserta belum memilih metode bayar di Midtrans" };
  }
  const d = res.data;
  const live = {
    transaction_status: d.transaction_status, payment_type: d.payment_type, gross_amount: d.gross_amount,
    transaction_time: d.transaction_time as string | undefined, settlement_time: d.settlement_time as string | undefined,
    transaction_id: d.transaction_id, fraud_status: d.fraud_status,
  };
  const mapped = mapTransactionStatus(d.transaction_status, d.fraud_status);
  const gross = Math.round(Number(d.gross_amount));
  if (mapped === "PAID") {
    if (gross !== order.total) return { ...base, live, verdict: "tidak_cocok", note: `Nominal Midtrans Rp${gross.toLocaleString("id-ID")} berbeda dengan total order` };
    if (order.status === "PAID") return { ...base, live, verdict: "cocok", note: "Lunas di Midtrans dan di database, nominal sama" };
    return { ...base, live, verdict: "tidak_cocok", note: "Sudah lunas di Midtrans, tapi database belum mencatat lunas" };
  }
  if (order.status === "PAID") return { ...base, live, verdict: "tidak_cocok", note: `Database lunas, status Midtrans ${d.transaction_status}` };
  return { ...base, live, verdict: "belum_bayar", note: `Status Midtrans ${d.transaction_status}, sesuai dengan database` };
}
