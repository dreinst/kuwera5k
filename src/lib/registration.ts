import { z } from "zod";

// Keputusan sementara (lihat docs/PRD.md bagian 12): usia minimal dan biaya layanan per metode
// bisa diubah panitia lewat tabel Setting tanpa deploy ulang.
export const MIN_AGE = 12;
export const RACE_DATE = "2026-10-24";

// Size chart sementara dari Donny (24 Sep 2026), dalam cm: A lingkar dada, B panjang badan, C panjang lengan.
export const JERSEY_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL"] as const;
export const JERSEY_CHART: Record<(typeof JERSEY_SIZES)[number], { chest: number; length: number; sleeve: number }> = {
  XS: { chest: 90, length: 64, sleeve: 31 },
  S: { chest: 95, length: 66, sleeve: 32 },
  M: { chest: 100, length: 68, sleeve: 33 },
  L: { chest: 105, length: 70, sleeve: 34 },
  XL: { chest: 110, length: 72, sleeve: 35 },
  XXL: { chest: 115, length: 74, sleeve: 36 },
  "3XL": { chest: 120, length: 76, sleeve: 37 },
  "4XL": { chest: 125, length: 78, sleeve: 38 },
};

export const PROVINCES = [
  "Aceh", "Sumatera Utara", "Sumatera Barat", "Riau", "Kepulauan Riau", "Jambi", "Sumatera Selatan",
  "Kepulauan Bangka Belitung", "Bengkulu", "Lampung", "DKI Jakarta", "Jawa Barat", "Banten", "Jawa Tengah",
  "DI Yogyakarta", "Jawa Timur", "Bali", "Nusa Tenggara Barat", "Nusa Tenggara Timur", "Kalimantan Barat",
  "Kalimantan Tengah", "Kalimantan Selatan", "Kalimantan Timur", "Kalimantan Utara", "Sulawesi Utara", "Gorontalo",
  "Sulawesi Tengah", "Sulawesi Barat", "Sulawesi Selatan", "Sulawesi Tenggara", "Maluku", "Maluku Utara", "Papua",
  "Papua Barat", "Papua Barat Daya", "Papua Tengah", "Papua Pegunungan", "Papua Selatan",
] as const;

export const BLOOD_TYPES = ["A", "B", "AB", "O", "Belum tahu"] as const;

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
  firstName: z.string().trim().min(2, "Nama depan minimal 2 huruf").max(40, "Nama depan maksimal 40 huruf"),
  lastName: z.string().trim().max(40, "Nama belakang maksimal 40 huruf").optional().or(z.literal("")),
  idNumber: z.string().trim().regex(/^\d{16}$/, "Nomor identitas (NIK) harus 16 angka"),
  address: z.string().trim().min(10, "Alamat minimal 10 huruf").max(200, "Alamat maksimal 200 huruf"),
  province: z.enum(PROVINCES, { message: "Pilih provinsi" }),
  city: z.string().trim().min(3, "Kota/kabupaten minimal 3 huruf").max(60, "Maksimal 60 huruf"),
  postalCode: z.string().trim().regex(/^\d{5}$/, "Kode pos harus 5 angka"),
  bloodType: z.enum(BLOOD_TYPES, { message: "Pilih golongan darah" }),
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
// Isian form sebelum divalidasi (pilihan yang belum dipilih = string kosong).
export type ParticipantForm = Record<keyof ParticipantInput, string>;
export const fullNameOf = (p: { firstName: string; lastName?: string | null }) => `${p.firstName} ${p.lastName ?? ""}`.trim();

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
