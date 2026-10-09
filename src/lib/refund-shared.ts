// Konstanta refund yang aman dipakai komponen klien (tanpa impor database).

export const REFUND_STATUS = ["DIAJUKAN", "PERLU_PERBAIKAN", "SELESAI"] as const;
export type RefundStatus = (typeof REFUND_STATUS)[number];
export const REFUND_STATUS_LABEL: Record<RefundStatus, string> = {
  DIAJUKAN: "Diajukan", PERLU_PERBAIKAN: "Perlu perbaikan", SELESAI: "Selesai",
};

export const REFUND_METHODS = { bank: "Rekening bank", ewallet: "Dompet digital" } as const;
export type RefundMethod = keyof typeof REFUND_METHODS;
export const REFUND_PROVIDERS: Record<RefundMethod, readonly string[]> = {
  bank: ["BCA", "BRI", "BNI", "Mandiri", "BSI", "CIMB Niaga", "Permata", "BTN", "Danamon", "Bank Jatim", "Bank Jago", "SeaBank", "Jenius (BTPN)", "Bank lain"],
  ewallet: ["GoPay", "OVO", "DANA", "ShopeePay"],
};

export const REFUND_BATAS_HARI = 30; // lama pengajuan dibuka sejak pengumuman
export const REFUND_PROSES = "paling lama 7 hari kerja";

export const tglPanjang = (d: Date | string) =>
  new Date(d).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", weekday: "long", day: "numeric", month: "long", year: "numeric" });
