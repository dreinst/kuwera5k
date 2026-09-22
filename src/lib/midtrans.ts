import { createHash } from "node:crypto";
import type { PaymentMethodId } from "@/lib/registration";

const isProduction = process.env.MIDTRANS_IS_PRODUCTION === "true";

export const midtrans = {
  isProduction,
  snapApi: isProduction ? "https://app.midtrans.com/snap/v1" : "https://app.sandbox.midtrans.com/snap/v1",
  coreApi: isProduction ? "https://api.midtrans.com/v2" : "https://api.sandbox.midtrans.com/v2",
  snapJs: isProduction ? "https://app.midtrans.com/snap/snap.js" : "https://app.sandbox.midtrans.com/snap/snap.js",
  clientKey: process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY ?? "",
};

// Kode metode di Snap `enabled_payments` untuk tiap pilihan di langkah 4.
export const MIDTRANS_PAYMENT_CODES: Record<PaymentMethodId, string> = {
  qris: "qris",
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
  const minutes = Math.max(1, Math.ceil((order.expiresAt.getTime() - now.getTime()) / 60_000));
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
  const expected = createHash("sha512")
    .update(`${n.order_id}${n.status_code}${n.gross_amount}${process.env.MIDTRANS_SERVER_KEY ?? ""}`)
    .digest("hex");
  return expected === n.signature_key;
}

export async function fetchTransactionStatus(orderId: string) {
  const res = await fetch(`${midtrans.coreApi}/${encodeURIComponent(orderId)}/status`, {
    headers: { Authorization: authHeader(), Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as Partial<MidtransNotification>;
}

export function mapTransactionStatus(status?: string, fraud?: string): "PAID" | "PENDING" | "EXPIRED" | "FAILED" | "IGNORE" {
  if (status === "settlement") return "PAID";
  if (status === "capture") return fraud === "challenge" ? "PENDING" : "PAID";
  if (status === "pending") return "PENDING";
  if (status === "expire") return "EXPIRED";
  if (status === "cancel" || status === "deny" || status === "failure") return "FAILED";
  return "IGNORE";
}
