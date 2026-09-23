import type { OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { fetchTransactionStatus, mapTransactionStatus, midtrans } from "@/lib/midtrans";
import { getSettings, heldCount } from "@/lib/orders";
import { JERSEY_SIZES } from "@/lib/registration";
import { STATUS_LABEL, type MidtransCheck } from "@/lib/admin-shared";

export { STATUS_LABEL, type MidtransCheck };

// Query untuk halaman admin. Pemanggil wajib sudah lolos requireAdmin().


export const fmtDateTime = (d: Date | null | undefined) =>
  d ? d.toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";
export const maskNik = (nik: string | null | undefined) => (nik ? `${nik.slice(0, 4)}********${nik.slice(-4)}` : "-");

export async function dashboardStats(now = new Date()) {
  const [byStatus, activePending, paidSums, settings, held, jersey, gender, blood, cities, collected, recent] = await Promise.all([
    prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.order.count({ where: { status: "PENDING", expiresAt: { gt: now } } }),
    prisma.order.aggregate({ where: { status: "PAID" }, _sum: { subtotal: true, discount: true, fee: true, total: true } }),
    getSettings(),
    heldCount(null, now),
    prisma.participant.groupBy({ by: ["jerseySize"], where: { order: { status: "PAID" } }, _count: { _all: true } }),
    prisma.participant.groupBy({ by: ["gender"], where: { order: { status: "PAID" } }, _count: { _all: true } }),
    prisma.participant.groupBy({ by: ["bloodType"], where: { order: { status: "PAID" } }, _count: { _all: true } }),
    prisma.participant.groupBy({ by: ["city"], where: { order: { status: "PAID" } }, _count: { _all: true }, orderBy: { _count: { city: "desc" } }, take: 5 }),
    prisma.ticket.count({ where: { racepackCollectedAt: { not: null } } }),
    prisma.order.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { participant: { select: { fullName: true } } } }),
  ]);
  const count = (s: OrderStatus) => byStatus.find((b) => b.status === s)?._count._all ?? 0;
  const paid = count("PAID");

  // Pendaftar lunas per hari (WIB), 14 hari terakhir.
  const since = new Date(now.getTime() - 13 * 86400_000);
  const paidRecent = await prisma.order.findMany({ where: { status: "PAID", paidAt: { gte: since } }, select: { paidAt: true } });
  const dayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  const daily = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(since.getTime() + i * 86400_000);
    return { key: dayKey(d), label: d.toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short" }), count: 0 };
  });
  for (const o of paidRecent) {
    const slot = daily.find((x) => x.key === dayKey(o.paidAt!));
    if (slot) slot.count++;
  }

  return {
    paid, activePending, expired: count("EXPIRED"), failed: count("FAILED"), refunded: count("REFUNDED"),
    staleOrders: count("PENDING") - activePending,
    revenueTicket: (paidSums._sum.subtotal ?? 0) - (paidSums._sum.discount ?? 0),
    revenueFee: paidSums._sum.fee ?? 0,
    revenueTotal: paidSums._sum.total ?? 0,
    quotaTotal: settings.quotaTotal,
    remaining: Math.max(0, settings.quotaTotal - held),
    jersey: JERSEY_SIZES.map((s) => ({ size: s, count: jersey.find((j) => j.jerseySize === s)?._count._all ?? 0 })),
    gender: { L: gender.find((g) => g.gender === "L")?._count._all ?? 0, P: gender.find((g) => g.gender === "P")?._count._all ?? 0 },
    blood: blood.map((b) => ({ type: b.bloodType ?? "Tidak diisi", count: b._count._all })),
    cities: cities.map((c) => ({ city: c.city ?? "Tidak diisi", count: c._count._all })),
    collected,
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
      { participant: { is: { fullName: { contains: term, mode: "insensitive" } } } },
      { participant: { is: { idNumber: { contains: term } } } },
    ];
  }
  return where;
}

export async function listRegistrants(q: string, status: string, page: number) {
  const where = registrantWhere(q, status);
  const [total, rows] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
      include: { participant: true, ticket: { select: { racepackCollectedAt: true } }, payments: { select: { gateway: true } } },
    }),
  ]);
  return { total, rows };
}


export async function checkOrderWithMidtrans(order: { id: string; status: OrderStatus; total: number; payments: { gateway: string }[] }): Promise<MidtransCheck> {
  const base = { orderId: order.id, dbStatus: order.status, total: order.total };
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
