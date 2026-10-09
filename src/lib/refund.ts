import { createHmac, timingSafeEqual } from "node:crypto";
import { cache } from "react";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { siteUrl } from "@/lib/site";
import { REFUND_BATAS_HARI, REFUND_PROVIDERS } from "@/lib/refund-shared";

export * from "@/lib/refund-shared";

// Refund karena acara dibatalkan (9 Okt 2026). Semuanya diatur satu baris Setting "refund":
// aktif = halaman refund dan pita pembatalan menyala, diumumkan = tanggal pengumuman (batas pengajuan dihitung dari sini),
// kunci = rahasia untuk tautan pribadi, nominal = order yang dikembalikan tidak sebesar totalnya (lihat
// tools/sql/2026-10-09-refund-setting.sql). Tanpa baris itu atau tanpa kunci, semua halaman refund tampil 404.
export type RefundConfig = { aktif: boolean; diumumkan: string | null; kunci: string; nominal: Record<string, number> };

// cache(): layout (pita) dan halaman membaca setelan yang sama, cukup satu query per permintaan.
export const getRefund = cache(async (): Promise<RefundConfig | null> => {
  const row = await prisma.setting.findUnique({ where: { key: "refund" } });
  const v = (row?.value ?? {}) as Partial<RefundConfig>;
  if (!v.aktif || !v.kunci) return null;
  return { aktif: true, diumumkan: v.diumumkan ?? null, kunci: v.kunci, nominal: v.nominal ?? {} };
});

// Dipakai pita di semua halaman: database gangguan (atau belum terjangkau saat build) dianggap belum aktif.
export const refundAktif = () => getRefund().then((c) => !!c, () => false);

export const refundBatas = (c: RefundConfig) =>
  c.diumumkan ? new Date(new Date(c.diumumkan).getTime() + REFUND_BATAS_HARI * 86_400_000) : null;

// Kunci tautan pribadi: HMAC nomor order. Skrip email di VPS menghitung kunci yang sama (kuwera-email-tiket).
export const refundKey = (c: RefundConfig, orderId: string) =>
  createHmac("sha256", c.kunci).update(`refund:${orderId}`).digest("base64url").slice(0, 24);

export function validRefundKey(c: RefundConfig, orderId: string, k: unknown) {
  const expected = Buffer.from(refundKey(c, orderId));
  const given = Buffer.from(typeof k === "string" ? k : "");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export const refundLink = (c: RefundConfig, orderId: string) => `${siteUrl}/refund/${orderId}?k=${refundKey(c, orderId)}`;

// Dana kembali 100% dari yang dibayar pemesan, termasuk kode unik.
export const refundAmount = (c: RefundConfig, o: { id: string; total: number }) => c.nominal[o.id] ?? o.total;

export const ORDER_ID_RE = /^KWR-\d{4}-[A-Z0-9]{6}$/;

export const refundSchema = z.object({
  method: z.enum(["bank", "ewallet"]),
  provider: z.string(),
  accountNumber: z.string().transform((v) => v.replace(/[\s.-]/g, "")).pipe(z.string().regex(/^\d{8,20}$/, "Nomor rekening atau nomor HP dompet berisi 8 sampai 20 angka, ya.")),
  accountNumber2: z.string().transform((v) => v.replace(/[\s.-]/g, "")),
  accountName: z.string().trim().min(3, "Mohon isi nama pemilik rekening sesuai buku tabungan atau aplikasinya.").max(80).regex(/^[\p{L}][\p{L}\s.,'-]*$/u, "Nama pemilik rekening diisi huruf saja, ya."),
  setuju: z.literal(true, "Mohon centang persetujuannya dulu, ya."),
}).superRefine((v, ctx) => {
  if (!REFUND_PROVIDERS[v.method].includes(v.provider)) ctx.addIssue({ code: "custom", path: ["provider"], message: "Mohon pilih bank atau dompet digitalnya dulu." });
  if (v.accountNumber !== v.accountNumber2) ctx.addIssue({ code: "custom", path: ["accountNumber2"], message: "Nomor yang diketik ulang belum sama. Mohon cek lagi, ya." });
});
