import { z } from "zod";
import { KAB_KOTA } from "@/lib/wilayah";

// Keputusan sementara (lihat docs/PRD.md bagian 12): usia minimal dan biaya layanan per metode
// bisa diubah panitia lewat tabel Setting tanpa deploy ulang.
export const MIN_AGE = 12;
export const RACE_DATE = "2026-10-24";

// Size chart O-neck reguler dari Donny (24 Sep 2026), dalam cm. Jersey berlengan pendek,
// jadi kolom lengan panjang dari tabel vendor tidak dipakai.
export const JERSEY_SIZES = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"] as const;
export const JERSEY_CHART_COLUMNS = [
  { key: "width", label: "Lebar" },
  { key: "length", label: "Panjang" },
  { key: "shoulderWidth", label: "Lebar bahu" },
  { key: "sleeveLength", label: "Panjang lengan" },
  { key: "sleeveCirc", label: "Lingkar lengan" },
  { key: "collar", label: "Lingkar kerah" },
  { key: "shoulderCirc", label: "Lingkar bahu" },
] as const;
type JerseyMeasure = Record<(typeof JERSEY_CHART_COLUMNS)[number]["key"], number>;
export const JERSEY_CHART: Record<(typeof JERSEY_SIZES)[number], JerseyMeasure> = {
  XS: { width: 48, length: 66, shoulderWidth: 14.2, sleeveLength: 18, sleeveCirc: 17, collar: 41, shoulderCirc: 20 },
  S: { width: 50, length: 68, shoulderWidth: 15.2, sleeveLength: 19, sleeveCirc: 17.5, collar: 42, shoulderCirc: 21 },
  M: { width: 52, length: 70, shoulderWidth: 16.2, sleeveLength: 19, sleeveCirc: 18, collar: 43, shoulderCirc: 21 },
  L: { width: 54, length: 72, shoulderWidth: 17.2, sleeveLength: 20, sleeveCirc: 18.5, collar: 44, shoulderCirc: 22 },
  XL: { width: 56, length: 74, shoulderWidth: 18.2, sleeveLength: 20, sleeveCirc: 19, collar: 45, shoulderCirc: 22 },
  "2XL": { width: 58, length: 76, shoulderWidth: 19.2, sleeveLength: 21, sleeveCirc: 19.5, collar: 45.5, shoulderCirc: 23 },
  "3XL": { width: 60, length: 78, shoulderWidth: 20.2, sleeveLength: 22, sleeveCirc: 20, collar: 46.5, shoulderCirc: 24 },
  "4XL": { width: 62, length: 80, shoulderWidth: 21.2, sleeveLength: 23, sleeveCirc: 20.5, collar: 47.5, shoulderCirc: 25 },
  "5XL": { width: 64, length: 82, shoulderWidth: 22.2, sleeveLength: 24, sleeveCirc: 21, collar: 48.5, shoulderCirc: 26 },
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
  city: z.string().trim().min(1, "Pilih kota/kabupaten"),
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
}).superRefine((p, ctx) => {
  // Kota/kabupaten harus salah satu wilayah di provinsi yang dipilih (daftar di src/lib/wilayah.ts).
  if (p.city && !(KAB_KOTA[p.province] ?? []).includes(p.city)) {
    ctx.addIssue({ code: "custom", path: ["city"], message: "Pilih kota/kabupaten dari daftar provinsi yang dipilih" });
  }
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

// Email disamarkan di halaman yang bisa dibuka siapa pun yang memegang tautannya (/bayar, /tiket).
export const maskEmail = (email: string) => {
  const [user, domain] = email.split("@");
  return domain ? `${user.slice(0, 2)}${"*".repeat(Math.max(3, user.length - 2))}@${domain}` : email;
};

export function issuesToMap(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const key = i.path.map(String).join(".");
    if (!out[key]) out[key] = i.message;
  }
  return out;
}
