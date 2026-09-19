// Data dummy sesuai docs/PRD.md bagian 1. Ganti begitu panitia konfirmasi data final.
export const eventData = {
  name: "KUWERA Fun Run 5K 2026",
  city: "Malang, Jawa Timur",
  dateLabel: "Minggu, 13 Desember 2026",
  timeLabel: "06.00 WIB",
  startPoint: "Alun-Alun Tugu (depan Balai Kota Malang)",
  quotaTotal: 1000,
  paidCount: 214,
  registrationOpen: "15 Oktober 2026",
  earlyBirdUntil: "15 November 2026",
  earlyBirdPrice: 150000,
  regularPrice: 200000,
};

export const remainingQuota = eventData.quotaTotal - eventData.paidCount;

export const route = {
  distanceKm: 5,
  cutOffMinutes: 60,
  checkpoints: [
    { label: "Start", place: "Alun-Alun Tugu", km: 0 },
    { label: "CP1", place: "Jl. Kahuripan", km: 1 },
    { label: "Water station 1", place: "Jl. Semeru", km: 1.8 },
    { label: "CP2", place: "Jl. Besar Ijen", km: 2.5 },
    { label: "CP3", place: "Jl. Bandung", km: 3.2 },
    { label: "Water station 2", place: "Jl. Veteran", km: 3.9 },
    { label: "CP4", place: "Jl. Kawi", km: 4.5 },
    { label: "Finish", place: "Alun-Alun Tugu", km: 5 },
  ],
};

export const guestStars = [
  { name: "Bintang Tamu 1", role: "TBC" },
  { name: "Bintang Tamu 2", role: "TBC" },
  { name: "Bintang Tamu 3", role: "TBC" },
  { name: "Bintang Tamu 4", role: "TBC" },
];

export const sponsors = [
  { name: "Sponsor 1", tier: "Utama" },
  { name: "Sponsor 2", tier: "Utama" },
  { name: "Sponsor 3", tier: "Pendukung" },
  { name: "Sponsor 4", tier: "Pendukung" },
  { name: "Sponsor 5", tier: "Media" },
  { name: "Sponsor 6", tier: "Media" },
];

export const faqs = [
  {
    q: "Bagaimana cara mendaftar KUWERA 5K?",
    a: "Klik tombol Daftar, isi data peserta, pilih metode bayar, lalu selesaikan pembayaran. E-ticket otomatis terkirim ke email dan WhatsApp.",
  },
  {
    q: "Metode pembayaran apa saja yang tersedia?",
    a: "QRIS, virtual account (BCA, BNI, BRI, Mandiri, Permata, CIMB), GoPay, ShopeePay, dan kartu kredit/debit.",
  },
  {
    q: "Apakah biaya pendaftaran bisa dikembalikan?",
    a: "Pendaftaran yang sudah lunas tidak dapat direfund otomatis. Hubungi panitia untuk kasus khusus.",
  },
  {
    q: "Kapan dan di mana pengambilan race pack?",
    a: "Race pack diambil H-1 di lokasi yang akan diinformasikan lewat email dan WhatsApp setelah pembayaran lunas.",
  },
  {
    q: "Apakah ada kategori kelompok atau komunitas?",
    a: "Saat ini registrasi hanya perorangan (1 peserta per transaksi). Kamu tetap bisa mencantumkan nama komunitasmu di form pendaftaran.",
  },
  {
    q: "Apa yang saya dapatkan sebagai peserta?",
    a: "Jersey/BIB, medali finisher, akses race pack, dan e-ticket dengan QR code untuk verifikasi di hari-H.",
  },
];
