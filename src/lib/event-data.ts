// Data dummy sesuai docs/PRD.md bagian 1. Ganti begitu panitia konfirmasi data final.
export const eventData = {
  name: "KUWERA Fun Run 5K 2026",
  city: "Malang, Jawa Timur",
  dateLabel: "Minggu, 13 Desember 2026",
  timeLabel: "06.00 WIB",
  startPoint: "Lapangan Rampal",
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
  // Rute resmi dari panitia (peta rute KUWERA 5K), start/finish di Lapangan Rampal.
  streets: [
    "Start Rampal",
    "Jl. Ronggolawe",
    "Jl. Urip Sumoharjo",
    "Jl. Panglima Sudirman",
    "Jl. Untung Suropati Utara",
    "Jl. Terusan Kesatrian",
    "Jl. Mayjen M. Wiyono",
    "Jl. Indraprasta",
    "Jl. Hamid Rusdi",
    "Jl. Lapangan Brawijaya",
    "Jl. Ronggolawe",
    "Finish Rampal",
  ],
  // Urutan dan posisi dari peta rute panitia; jarak dari geometri jalan OpenStreetMap
  // (tools/generate-route-map.mjs). Jarak resmi 5K termasuk lintasan di dalam lapangan.
  checkpoints: [
    { label: "Start", place: "Lapangan Rampal, sisi Jl. Ronggolawe", km: 0 },
    { label: "Water station", place: "Jl. Urip Sumoharjo, sisi barat lapangan", km: 0.5 },
    { label: "1 KM", place: "Jl. Panglima Sudirman", km: 1 },
    { label: "2 KM", place: "Jl. Kesatrian", km: 2 },
    { label: "Water station", place: "Jl. Indraprasta", km: 2.6 },
    { label: "3 KM", place: "Jl. Hamid Rusdi Timur", km: 3 },
    { label: "4 KM", place: "Permukiman utara Rampal, menuju Jl. Lapangan", km: 4 },
    { label: "Finish", place: "Lapangan Rampal", km: 5 },
  ],
};

// Foto masih dummy (Unsplash, lisensi bebas), ganti dengan foto talent asli 3:4.
export const guestStars = [
  { name: "Bintang Tamu 1", role: "TBC", image: "/images/guest-1.jpg" },
  { name: "Bintang Tamu 2", role: "TBC", image: "/images/guest-2.jpg" },
  { name: "Bintang Tamu 3", role: "TBC", image: "/images/guest-3.jpg" },
  { name: "Bintang Tamu 4", role: "TBC", image: "/images/guest-4.jpg" },
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
    a: "Race pack berisi jersey dan BIB, medali finisher setelah lari, dan e-ticket dengan QR code untuk pengambilan race pack.",
  },
];
