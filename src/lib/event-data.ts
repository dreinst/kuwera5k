// Data dummy sesuai docs/PRD.md bagian 1. Ganti begitu panitia konfirmasi data final.
export const eventData = {
  name: "KUWERA Fun Run 5K 2026",
  city: "Malang, Jawa Timur",
  dateLabel: "Sabtu, 24 Oktober 2026",
  timeLabel: "06.00 WIB",
  startPoint: "Lapangan Rampal",
  quotaTotal: 1000,
  paidCount: 214,
  registrationCloseLabel: "Jumat, 23 Oktober 2026 pukul 23.59 WIB", // sama dengan registrationCloseIso
  price: 125000,
  racePackLabel: "Jumat, 23 Oktober 2026, 10.00 sampai 18.00 WIB", // H-1, sesuai FAQ
  racePackPlace: "Lapangan Rampal (tenda panitia)",
  // Untuk data terstruktur (schema.org) dan metadata; sumber koordinat: OpenStreetMap way 295948065.
  startIso: "2026-10-24T06:00:00+07:00",
  registrationOpenIso: "2026-09-01T00:00:00+07:00", // jendela jual kategori di seed
  registrationCloseIso: "2026-10-23T23:59:59+07:00",
  venue: {
    name: "Lapangan Rampal",
    street: "Jl. Jenderal Urip Sumoharjo",
    locality: "Kota Malang",
    region: "Jawa Timur",
    postalCode: "65121",
    lat: -7.97357,
    lng: 112.64017,
  },
  organizer: "D'Production Event Organizer",
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
    { label: "Start", place: "Lapangan Rampal, sisi Jl. Urip Sumoharjo", km: 0 },
    { label: "1 KM", place: "Jl. Panglima Sudirman", km: 1 },
    { label: "2 KM", place: "Jl. Kesatrian", km: 2 },
    // Satu-satunya water station (keputusan panitia 23 Sep 2026); pin di peta mengikuti km ini.
    { label: "Water station", place: "Denzibang", km: 2.5 },
    { label: "3 KM", place: "Jl. Hamid Rusdi Timur", km: 3 },
    { label: "4 KM", place: "Permukiman utara Rampal, menuju Jl. Lapangan", km: 4 },
    { label: "Finish", place: "Lapangan Rampal, di titik yang sama dengan start", km: 5 },
  ],
};

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
    a: "Klik tombol Daftar, isi data peserta, pilih metode bayar, lalu selesaikan pembayaran. E-ticket langsung muncul setelah pembayaran lunas; simpan tautannya untuk ambil race pack.",
  },
  {
    q: "Metode pembayaran apa saja yang tersedia?",
    a: "QRIS, virtual account (BCA, BNI, BRI, Mandiri, Permata, CIMB), GoPay, ShopeePay, dan kartu kredit/debit.",
  },
  {
    q: "Apakah biaya pendaftaran bisa dikembalikan?",
    a: "Biaya yang sudah lunas tidak dikembalikan otomatis. Untuk kasus khusus, hubungi panitia lewat WhatsApp.",
  },
  {
    q: "Kapan dan di mana pengambilan race pack?",
    a: `Race pack diambil ${eventData.racePackLabel} di ${eventData.racePackPlace}. Bawa KTP asli dan tunjukkan QR di e-ticket.`,
  },
  {
    q: "Apakah ada kategori kelompok atau komunitas?",
    a: "Pendaftaran hanya perorangan, satu peserta per transaksi. Nama komunitasmu tetap bisa dicantumkan di form pendaftaran.",
  },
  {
    q: "Apa yang saya dapatkan sebagai peserta?",
    a: "Race pack berisi jersey dan BIB. Medali finisher kamu terima setelah menyelesaikan lari. QR di e-ticket dipakai saat mengambil race pack.",
  },
];
