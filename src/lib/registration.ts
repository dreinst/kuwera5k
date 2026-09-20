import { z } from "zod";

// Keputusan sementara (lihat docs/PRD.md bagian 12): usia minimal dan biaya layanan per metode
// bisa diubah panitia lewat tabel Setting tanpa deploy ulang.
export const MIN_AGE = 12;
export const RACE_DATE = "2026-12-13";

export const JERSEY_SIZES = ["XS", "S", "M", "L", "XL", "XXL"] as const;
export const JERSEY_CHEST_CM: Record<(typeof JERSEY_SIZES)[number], string> = {
  XS: "84-88", S: "88-92", M: "92-96", L: "96-100", XL: "100-106", XXL: "106-112",
};

export const PAYMENT_METHODS = [
  { id: "qris", label: "QRIS", group: "QRIS", hint: "Semua e-wallet dan m-banking" },
  { id: "bca_va", label: "BCA Virtual Account", group: "Virtual account", hint: "" },
  { id: "bni_va", label: "BNI Virtual Account", group: "Virtual account", hint: "" },
  { id: "bri_va", label: "BRI Virtual Account", group: "Virtual account", hint: "" },
  { id: "mandiri_va", label: "Mandiri Virtual Account", group: "Virtual account", hint: "" },
  { id: "permata_va", label: "Permata Virtual Account", group: "Virtual account", hint: "" },
  { id: "cimb_va", label: "CIMB Virtual Account", group: "Virtual account", hint: "" },
  { id: "gopay", label: "GoPay", group: "E-wallet", hint: "" },
  { id: "shopeepay", label: "ShopeePay", group: "E-wallet", hint: "" },
  { id: "credit_card", label: "Kartu kredit / debit", group: "Kartu", hint: "Visa, Mastercard, JCB" },
] as const;
export type PaymentMethodId = (typeof PAYMENT_METHODS)[number]["id"];
export const PAYMENT_METHOD_IDS = PAYMENT_METHODS.map((m) => m.id) as [PaymentMethodId, ...PaymentMethodId[]];

export const DEFAULT_FEES: Record<PaymentMethodId, number> = {
  qris: 1500, bca_va: 4500, bni_va: 4500, bri_va: 4500, mandiri_va: 4500, permata_va: 4500, cimb_va: 4500,
  gopay: 4000, shopeepay: 4000, credit_card: 7500,
};

const phone = (label: string) =>
  z.string().trim().regex(/^08\d{8,11}$/, `${label} ditulis 08xxxxxxxxxx (10 sampai 13 digit)`);

export function ageOn(birthDate: string, on: string = RACE_DATE) {
  const b = new Date(birthDate), d = new Date(on);
  let age = d.getFullYear() - b.getFullYear();
  if (d.getMonth() < b.getMonth() || (d.getMonth() === b.getMonth() && d.getDate() < b.getDate())) age--;
  return age;
}

export const participantSchema = z.object({
  fullName: z.string().trim().min(3, "Nama minimal 3 huruf").max(80, "Nama maksimal 80 huruf"),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal lahir wajib diisi")
    .refine((v) => !Number.isNaN(new Date(v).getTime()), "Tanggal lahir tidak valid")
    .refine((v) => ageOn(v) >= MIN_AGE, `Usia minimal ${MIN_AGE} tahun saat hari lomba`)
    .refine((v) => ageOn(v) <= 90, "Cek lagi tanggal lahirnya"),
  gender: z.enum(["L", "P"], { message: "Pilih jenis kelamin" }),
  phone: phone("Nomor HP"),
  email: z.string().trim().toLowerCase().email("Email tidak valid"),
  jerseySize: z.enum(JERSEY_SIZES, { message: "Pilih ukuran jersey" }),
  emergencyName: z.string().trim().min(3, "Nama kontak darurat minimal 3 huruf").max(80),
  emergencyPhone: phone("Nomor kontak darurat"),
  community: z.string().trim().max(80, "Maksimal 80 huruf").optional().or(z.literal("")),
});
export type ParticipantInput = z.infer<typeof participantSchema>;

export const orderInputSchema = z.object({
  categoryId: z.string().min(1, "Pilih kategori"),
  participant: participantSchema,
  promoCode: z.string().trim().toUpperCase().max(30).optional().or(z.literal("")),
  paymentMethod: z.enum(PAYMENT_METHOD_IDS, { message: "Pilih metode pembayaran" }),
  agreeTerms: z.literal(true, { message: "Wajib menyetujui syarat dan ketentuan" }),
});
export type OrderInput = z.infer<typeof orderInputSchema>;

export const formatRupiah = (n: number) => `Rp${n.toLocaleString("id-ID")}`;

export function issuesToMap(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const key = i.path.map(String).join(".");
    if (!out[key]) out[key] = i.message;
  }
  return out;
}
