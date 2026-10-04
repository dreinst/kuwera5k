import { KAB_KOTA } from "@/lib/wilayah";
import { BLOOD_TYPES, JERSEY_SIZES, PROVINCES, type ParticipantForm } from "@/lib/registration";

// Formulir pendaftaran lewat WhatsApp, cadangan kalau website tidak bisa dibuka pelanggan. Kolomnya sama dengan
// formulir website (langkah Data peserta); satu formulir = satu peserta. Bot mengirim template ini, pelanggan mengisi
// setelah titik dua lalu mengirim balik, dan /api/bot/daftar membaca isinya dengan aturan yang sama seperti website.
export const FORM_HEADER = "FORMULIR PENDAFTARAN KUWERA 5K";

const FIELDS: { key: keyof ParticipantForm; label: string; hint?: string }[] = [
  { key: "firstName", label: "Nama depan" },
  { key: "lastName", label: "Nama belakang", hint: "boleh kosong" },
  { key: "idNumber", label: "NIK", hint: "16 angka sesuai KTP/KIA" },
  { key: "birthDate", label: "Tanggal lahir", hint: "contoh 17-08-1995" },
  { key: "gender", label: "Jenis kelamin", hint: "L atau P" },
  { key: "bloodType", label: "Golongan darah", hint: "A, B, AB, O, atau Belum tahu" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Nomor HP (WA)" },
  { key: "address", label: "Alamat" },
  { key: "province", label: "Provinsi" },
  { key: "city", label: "Kota/Kabupaten", hint: "contoh Kota Malang" },
  { key: "postalCode", label: "Kode pos" },
  { key: "jerseySize", label: "Ukuran jersey", hint: JERSEY_SIZES.join("/") },
  { key: "emergencyName", label: "Nama kontak darurat" },
  { key: "emergencyPhone", label: "Nomor kontak darurat" },
  { key: "community", label: "Komunitas", hint: "boleh kosong" },
];

export const LABEL: Record<string, string> = Object.fromEntries(FIELDS.map((f) => [f.key, f.label]));

export function formTemplate(siteUrl: string) {
  return [
    FORM_HEADER,
    "(salin pesan ini, isi setelah tanda titik dua, lalu kirim balik ke chat ini)",
    "",
    ...FIELDS.map((f) => `${f.label}${f.hint ? ` (${f.hint})` : ""}: `),
    "",
    `Dengan mengirim formulir ini, saya menyetujui syarat dan ketentuan di ${siteUrl}/syarat`,
  ].join("\n");
}

const norm = (s: string) => s.toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z/]/g, "");

// Baca "Label: isi" per baris; label dicocokkan tanpa peduli huruf besar, spasi, dan keterangan dalam kurung.
export function parseForm(text: string): { form: Partial<ParticipantForm>; problems: string[] } {
  const byLabel = new Map(FIELDS.map((f) => [norm(f.label), f.key]));
  const form: Partial<ParticipantForm> = {};
  for (const line of text.split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i < 0) continue;
    const key = byLabel.get(norm(line.slice(0, i)));
    if (key) form[key] = line.slice(i + 1).trim();
  }
  const problems: string[] = [];

  // Tanggal lahir DD-MM-YYYY (atau DD/MM/YYYY) menjadi YYYY-MM-DD seperti isian website.
  const d = (form.birthDate ?? "").match(/^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{4})$/);
  if (form.birthDate && d) form.birthDate = `${d[3]}-${d[2].padStart(2, "0")}-${d[1].padStart(2, "0")}`;
  else if (form.birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(form.birthDate)) problems.push("Tanggal lahir ditulis tanggal-bulan-tahun, contoh 17-08-1995");

  const g = (form.gender ?? "").toLowerCase();
  form.gender = /^(l|laki|pria|cowok)/.test(g) ? "L" : /^(p|perempuan|wanita|cewek)/.test(g) ? "P" : form.gender ?? "";

  const b = (form.bloodType ?? "").trim().toUpperCase();
  const blood = BLOOD_TYPES.find((x) => x.toUpperCase() === b) ?? (/(TIDAK|BELUM|-)/.test(b) ? "Belum tahu" : undefined);
  if (blood) form.bloodType = blood;

  const j = (form.jerseySize ?? "").toUpperCase().replace(/\s/g, "").replace(/^XXL$/, "2XL");
  if (j) form.jerseySize = j;

  const prov = PROVINCES.find((p) => norm(p) === norm(form.province ?? "") || norm(p) === norm((form.province ?? "").replace(/^prov(insi)?\.?/i, "")));
  if (prov) form.province = prov;

  // Kota/kabupaten: cocokkan tanpa awalan; kalau "Malang" bisa Kota atau Kabupaten, minta dipertegas.
  if (prov && form.city) {
    const bare = (s: string) => norm(s.replace(/^(kota|kabupaten|kab\.?)\s*/i, ""));
    const list = KAB_KOTA[prov] ?? [];
    const exact = list.find((c) => norm(c) === norm(form.city!.replace(/^kab\.?\s*/i, "Kabupaten ")));
    const loose = list.filter((c) => bare(c) === bare(form.city!));
    if (exact) form.city = exact;
    else if (loose.length === 1) form.city = loose[0];
    else if (loose.length > 1) problems.push(`Kota/Kabupaten: tulis salah satu dari ${loose.join(" atau ")}`);
  }
  return { form, problems };
}
