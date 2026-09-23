import type { OrderStatus } from "@prisma/client";

// Konstanta dan tipe admin yang aman dipakai komponen klien (tanpa impor database).

export const STATUS_LABEL: Record<OrderStatus, string> = {
  DRAFT: "Draf", PENDING: "Menunggu bayar", PAID: "Lunas", EXPIRED: "Kedaluwarsa", FAILED: "Gagal", REFUNDED: "Refund",
};

// Hasil pencocokan satu order dengan Midtrans (dipakai tombol per order dan verifikasi massal).
export type MidtransCheck = {
  orderId: string;
  dbStatus: OrderStatus;
  total: number;
  verdict: "cocok" | "tidak_cocok" | "belum_bayar" | "simulasi" | "tidak_ada" | "error";
  note: string;
  live?: { transaction_status?: string; payment_type?: string; gross_amount?: string; transaction_time?: string; settlement_time?: string; transaction_id?: string; fraud_status?: string };
};
