// Data dummy sesuai docs/PRD.md bagian 1. Ganti begitu panitia konfirmasi data final.
const racePackDates = "Kamis dan Jumat, 22 dan 23 Oktober 2026"; // H-2 dan H-1

export const eventData = {
  name: "KUWERA Fun Run 5K 2026",
  city: "Malang, Jawa Timur",
  dateLabel: "Sabtu, 24 Oktober 2026",
  timeLabel: "06.00 WIB",
  startPoint: "Lapangan Rampal",
  quotaTotal: 1000,
  paidCount: 214,
  // Jumlah pendaftar baru ditampilkan di beranda setelah mencapai angka ini; sebelumnya kartu berisi ajakan Early Bird.
  publicCountFrom: 100,
  // Kode promo satu hari yang diumumkan di beranda hanya pada hari promonya (data kodenya di tabel PromoCode).
  promoDay: { code: "KUWERA10.10", text: "diskon 10% pukul 10.00 sampai 22.00 WIB", dayLabel: "Sabtu, 10 Oktober", fromIso: "2026-10-10T00:00:00+07:00", untilIso: "2026-10-10T22:00:00+07:00" },
  // Tutup H-1 minggu (ukuran jersey dikirim ke vendor untuk dicetak), atau lebih awal kalau kuota penuh.
  registrationCloseLabel: "Sabtu, 17 Oktober 2026 pukul 23.59 WIB", // sama dengan registrationCloseIso
  racePackDates,
  racePackPlace: "Kudam V/Brawijaya",
  racePackHours: "Jam pengambilannya kami kabarkan lewat WhatsApp menjelang hari H.",
  // Untuk data terstruktur (schema.org) dan metadata; sumber koordinat: OpenStreetMap way 295948065.
  startIso: "2026-10-24T06:00:00+07:00",
  registrationOpenIso: "2026-09-01T00:00:00+07:00", // jendela jual kategori di seed
  registrationCloseIso: "2026-10-17T23:59:59+07:00",
  venue: {
    name: "Lapangan Rampal",
    street: "Jl. Jenderal Urip Sumoharjo",
    locality: "Kota Malang",
    region: "Jawa Timur",
    postalCode: "65121",
    lat: -7.97357,
    lng: 112.64017,
  },
  host: "Keuangan Angkatan Darat Malang",
  organizer: "D'Production Event Organizer", // EO pelaksana
  organizerUrl: "https://www.dpro.events",
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
    { label: "3 KM", place: "Jl. Hamid Rusdi Timur", km: 3 },
    { label: "4 KM", place: "Permukiman utara Rampal, menuju Jl. Lapangan", km: 4 },
    { label: "Finish", place: "Lapangan Rampal, di titik yang sama dengan start", km: 5 },
  ],
};

export const sponsors = [
  { name: "Profast Fashion Custom", tier: "Utama", logo: "/sponsors/profast.webp" },
];

export const faqs = [
  {
    q: "Bagaimana cara mendaftar KUWERA 5K?",
    a: "Gampang! Cukup tekan tombol Daftar, pilih jumlah tiket, isi data setiap peserta, lalu bayar dengan QRIS. E-ticket terbit setelah pembayaran dikonfirmasi, dan tautannya bisa kamu simpan untuk pengambilan race pack.",
  },
  {
    q: "Metode pembayaran apa saja yang tersedia?",
    a: "QRIS, bisa dibayar dari aplikasi m-banking atau e-wallet apa pun yang mendukung QRIS. Nominalnya terisi otomatis saat QR di-scan.",
  },
  {
    q: "Apakah biaya pendaftaran bisa dikembalikan?",
    a: "Biaya yang sudah lunas tidak dikembalikan otomatis. Kalau ada kondisi khusus, panitia siap membantu lewat WhatsApp.",
  },
  {
    q: "Kapan dan di mana pengambilan race pack?",
    a: `Race pack bisa kamu ambil pada ${eventData.racePackDates} di ${eventData.racePackPlace}. ${eventData.racePackHours} Jangan lupa bawa KTP atau KIA asli dan QR di e-ticket, ya.`,
  },
  {
    q: "Apakah ada kategori kelompok atau komunitas?",
    a: "Tidak ada kategori khusus, tapi satu pembelian bisa berisi beberapa tiket sekaligus, misalnya untuk keluarga atau komunitas. Setiap tiket diisi data pesertanya masing-masing, dan nama komunitas bisa dicantumkan di form.",
  },
  {
    q: "Apa yang saya dapatkan sebagai peserta?",
    a: "Race pack berisi jersey dan BIB. Medali finisher kamu terima setelah menyelesaikan lari. QR di e-ticket dipakai saat mengambil race pack.",
  },
];
