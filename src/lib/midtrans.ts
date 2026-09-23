import { createHash, timingSafeEqual } from "node:crypto";
import type { PaymentMethodId } from "@/lib/registration";

const isProduction = process.env.MIDTRANS_IS_PRODUCTION === "true";

export const midtrans = {
  isProduction,
  snapApi: isProduction ? "https://app.midtrans.com/snap/v1" : "https://app.sandbox.midtrans.com/snap/v1",
  coreApi: isProduction ? "https://api.midtrans.com/v2" : "https://api.sandbox.midtrans.com/v2",
  snapJs: isProduction ? "https://app.midtrans.com/snap/snap.js" : "https://app.sandbox.midtrans.com/snap/snap.js",
  clientKey: process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY ?? "",
  // Dicatat di tabel payments; tiket dari pembayaran sandbox diberi label simulasi dan dihapus saat go-live.
  gateway: isProduction ? "midtrans" : "midtrans-sandbox",
};

// Kode metode di Snap `enabled_payments` untuk tiap pilihan di langkah 4. Diverifikasi di sandbox
// 22 September 2026: QRIS umum = "other_qris" (kode "qris" tidak dikenal), Mandiri VA = "echannel".
export const MIDTRANS_PAYMENT_CODES: Record<PaymentMethodId, string> = {
  qris: "other_qris",
  bca_va: "bca_va",
  bni_va: "bni_va",
  bri_va: "bri_va",
  mandiri_va: "echannel",
  permata_va: "permata_va",
  cimb_va: "cimb_va",
  gopay: "gopay",
  shopeepay: "shopeepay",
  credit_card: "credit_card",
};

const authHeader = () => "Basic " + Buffer.from(`${process.env.MIDTRANS_SERVER_KEY ?? ""}:`).toString("base64");

function jakartaTime(d: Date) {
  const parts = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(d);
  return `${parts.replace("T", " ")} +0700`;
}

export type SnapOrder = {
  id: string;
  subtotal: number;
  discount: number;
  fee: number;
  total: number;
  categoryName: string;
  paymentMethod: PaymentMethodId;
  expiresAt: Date;
  participant: { fullName: string; email: string; phone: string };
  finishUrl: string;
};

export async function createSnapToken(order: SnapOrder) {
  const now = new Date();
  // Dibulatkan ke bawah supaya batas bayar di Midtrans tidak melewati hold kuota di server.
  // Route /snap menolak membuat token kalau sisa waktu kurang dari 1 menit.
  const minutes = Math.max(1, Math.floor((order.expiresAt.getTime() - now.getTime()) / 60_000));
  const items = [
    { id: "tiket", price: order.subtotal - order.discount, quantity: 1, name: `KUWERA 5K ${order.categoryName}`.slice(0, 50) },
  ];
  if (order.fee > 0) items.push({ id: "fee", price: order.fee, quantity: 1, name: "Biaya layanan pembayaran" });
  const body = {
    transaction_details: { order_id: order.id, gross_amount: order.total },
    item_details: items,
    customer_details: { first_name: order.participant.fullName.slice(0, 50), email: order.participant.email, phone: order.participant.phone },
    enabled_payments: [MIDTRANS_PAYMENT_CODES[order.paymentMethod]],
    expiry: { start_time: jakartaTime(now), unit: "minute", duration: minutes },
    callbacks: { finish: order.finishUrl },
  };
  const res = await fetch(`${midtrans.snapApi}/transactions`, {
    method: "POST",
    headers: { Authorization: authHeader(), "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  const data = (await res.json().catch(() => ({}))) as { token?: string; redirect_url?: string; error_messages?: string[] };
  if (!res.ok || !data.token) {
    throw new Error(`Midtrans Snap ${res.status}: ${(data.error_messages ?? []).join("; ") || "tidak ada token"}`);
  }
  return { token: data.token, redirectUrl: data.redirect_url ?? null };
}

export type MidtransNotification = {
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key: string;
  transaction_status: string;
  fraud_status?: string;
  transaction_id?: string;
  payment_type?: string;
  [k: string]: unknown;
};

export function verifySignature(n: Pick<MidtransNotification, "order_id" | "status_code" | "gross_amount" | "signature_key">) {
  const key = process.env.MIDTRANS_SERVER_KEY ?? "";
  if (!key || typeof n.signature_key !== "string") return false;
  const expected = Buffer.from(createHash("sha512").update(`${n.order_id}${n.status_code}${n.gross_amount}${key}`).digest("hex"));
  const given = Buffer.from(n.signature_key);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export type LiveStatus =
  | { kind: "found"; data: Partial<MidtransNotification> & { transaction_status: string } }
  | { kind: "not_found" }
  | { kind: "error"; detail: string };

// Status transaksi langsung dari Midtrans. Transaksi yang belum ada (peserta belum memilih metode di
// Snap) dijawab Midtrans dengan HTTP 200 tapi status_code "404" di body.
export async function fetchTransactionStatus(orderId: string): Promise<LiveStatus> {
  try {
    const res = await fetch(`${midtrans.coreApi}/${encodeURIComponent(orderId)}/status`, {
      headers: { Authorization: authHeader(), Accept: "application/json" },
      cache: "no-store",
      // Batas waktu supaya halaman /bayar dan polling tidak menggantung kalau API Midtrans lambat.
      signal: AbortSignal.timeout(6_000),
    });
    const data = (await res.json().catch(() => ({}))) as Partial<MidtransNotification> & { status_message?: string };
    if (data.status_code === "404" || res.status === 404) return { kind: "not_found" };
    if (!res.ok || typeof data.transaction_status !== "string" || data.order_id !== orderId) {
      return { kind: "error", detail: `HTTP ${res.status} ${data.status_code ?? ""} ${data.status_message ?? ""}`.trim() };
    }
    return { kind: "found", data: data as Partial<MidtransNotification> & { transaction_status: string } };
  } catch (e) {
    return { kind: "error", detail: e instanceof Error ? e.message : String(e) };
  }
}

// "deny" (misal kartu ditolak bank) belum final: di Snap peserta masih bisa mencoba kartu lain untuk
// order_id yang sama selama batas bayar belum habis. "cancel" dilakukan merchant, jadi final.
export function mapTransactionStatus(status?: string, fraud?: string): "PAID" | "PENDING" | "DENIED" | "EXPIRED" | "FAILED" | "IGNORE" {
  if (status === "settlement") return "PAID";
  if (status === "capture") return fraud === "challenge" ? "PENDING" : "PAID";
  if (status === "pending") return "PENDING";
  if (status === "deny") return "DENIED";
  if (status === "expire") return "EXPIRED";
  if (status === "cancel" || status === "failure") return "FAILED";
  return "IGNORE";
}
