# PRD Website KUWERA 5K

Per 20 September 2026. Sumber konsep visual: video `konsep_kuwera_5k.mp4` (15,4 detik, 1440x1080, 60 fps). Sumber desain tambahan: `stitch_kuwera_5k_website_registration.zip`.

Website resmi fun run KUWERA 5K: landing page sinematik (mengikuti video konsep) + registrasi peserta online dengan pembayaran via payment gateway, sampai peserta menerima e-ticket/BIB.

## 1. Ringkasan & tujuan produk

Website KUWERA 5K adalah satu landing page sinematik plus alur registrasi berbayar yang mengubah pengunjung menjadi peserta terdaftar (sudah bayar, sudah pegang e-ticket) dalam kurang dari 3 menit, tanpa rekonsiliasi manual oleh panitia.

**Masalah yang diselesaikan**
- Registrasi lewat Google Form + transfer manual: panitia mengecek mutasi satu per satu, peserta tidak dapat konfirmasi instan.
- Kuota tidak realtime: risiko overbooking atau slot kosong menjelang hari-H.
- Informasi tersebar (rute, jadwal, guest star, sponsor, FAQ), tidak ada satu sumber resmi.

**Target pengguna**

| Persona | Kebutuhan utama | Perangkat dominan |
| --- | --- | --- |
| Pelari umum | Daftar cepat, bayar QRIS/VA/e-wallet, langsung terima e-ticket | HP (asumsi 85%+ trafik) |
| Komunitas lari | Daftar perorangan, bisa mencantumkan nama komunitas untuk rekap | HP dan laptop |
| Calon sponsor & media | Menilai kredibilitas event dari tampilan dan angka pendaftar | Laptop |
| Panitia (admin) | Lihat peserta, status bayar, ukuran jersey, ekspor ke Excel | Laptop |

**Tujuan & KPI**

| Tujuan | Target v1 |
| --- | --- |
| Konversi pengunjung menjadi pendaftar | >= 8% |
| Pendaftar yang menyelesaikan pembayaran | >= 85% dari yang membuka halaman bayar |
| Waktu dari klik Daftar sampai e-ticket terkirim | < 3 menit |
| Performa halaman di HP 4G | LCP < 2,5 detik, Lighthouse >= 90 |
| Beban admin rekonsiliasi pembayaran | 0 pengecekan manual (webhook otomatis) |

**Non-goals v1:** aplikasi mobile native, timing chip/hasil lomba, live tracking, toko merchandise, akun login peserta, registrasi kelompok.

**Data event sementara (DUMMY, diganti begitu panitia konfirmasi)**

| Item | Nilai dummy | Status |
| --- | --- | --- |
| Nama event | KUWERA Fun Run 5K 2026 | Tetap |
| Kota | Malang, Jawa Timur | Tetap |
| Tanggal & jam start | Sabtu, 24 Oktober 2026, 06.00 WIB | Final (Donny, 23 Sep 2026) |
| Titik start & finish | Alun-Alun Tugu (depan Balai Kota Malang) | Dummy |
| Rute ilustrasi | Alun-Alun Tugu -> Jl. Kahuripan -> Jl. Semeru -> Jl. Besar Ijen -> Jl. Bandung -> Jl. Veteran -> Jl. Kawi -> Jl. Semeru -> Alun-Alun Tugu | Dummy, ukur ulang dari GPX |
| Kuota total | 1.000 peserta | Dummy |
| Jendela pendaftaran | Sudah dibuka; ditutup Jumat, 23 Oktober 2026 pukul 23.59 WIB (sama dengan jendela jual kategori di seed). Banner Info di beranda menampilkan tanggal tutup ini | Sementara, konfirmasi panitia |
| Biaya pendaftaran | Rp125.000 per peserta, satu kategori, tanpa early bird | Tetap (Donny, 22 Sep 2026) |
| Pengambilan race pack | Jumat, 23 Oktober 2026 (H-1), 10.00 sampai 18.00 WIB | Dummy, ikut tanggal acara |
| Guest star / hiburan | Tidak ada guest star (dikonfirmasi Donny 23 Sep 2026); section dan datanya dihapus dari situs | Final |
| Sponsor | 6 slot logo placeholder per tier | Dummy |
| Domain | kuwera5k.id (placeholder) | Belum diputuskan |
| Bahasa | Bilingual, default Indonesia, toggle English | Tetap |
| Registrasi | Perorangan, 1 peserta per transaksi | Tetap |
| Payment gateway | Midtrans Snap, biaya layanan dibebankan ke peserta | Tetap |
| Merchant Midtrans | Badan usaha sudah ada, konfirmasi ulang NIB/NPWP/rekening | Konfirmasi |
| Hosting | VPS milik panitia | Tetap |

## 2. Analisis video konsep

Video adalah showcase motion sebuah landing page bertema marathon (referensi desain "Jakarta Marathon 2024 / JakartaRun"), bukan rekaman website jadi. Nama artis, sponsor, dan Strava adalah konten referensi.

| Detik | Yang tampil | Teknik gerak |
| --- | --- | --- |
| 0,0-1,5 | Overview seluruh halaman, zoom masuk ke hero | Zoom-in + cross-fade, blur ke tajam |
| 2,0-4,0 | Hero: navbar, pill "RUN FOR A CAUSE", headline, grid 5 kartu (Save the date, 4.702 runners + Register, peta 10K Route, Strava, Medals) | Kartu fade + scale 0,95->1 + blur 8->0 px bertahap; headline reveal per kata; tombol/badge terakhir |
| 4,5-6,5 | Route Detail: kartu peta kiri, timeline 13 checkpoint kanan | Titik timeline muncul dulu, label masuk berurutan; garis rute "digambar" |
| 6,5-7,5 | Banner tanggal: gradasi lime + foto Monas, pill tanggal & jam | Skeleton -> teks, slide dari kanan |
| 7,5-9,0 | Guest Star: 4 kartu artis | Kartu terbuka dari bilah tipis ke lebar penuh (clip-path), nama slide-up |
| 9,0-10,0 | Sponsors: 12 logo di latar putih | Fade-in stagger kiri->kanan |
| 10,0-13,0 | CTA banner + Register; Newsletter; FAQ; footer | Skeleton blur -> kartu; heading reveal; FAQ slide-in |
| 13,5-15,4 | Scroll balik ke atas, zoom-out ke overview | Smooth scroll + zoom-out |

**Pola konsisten (standar animasi KUWERA):** (1) masuk lewat blur + fade + sedikit scale; (2) stagger 60-100 ms; (3) durasi 0,5-0,8 s, ease-out; (4) dipicu saat section masuk viewport; (5) gaya "skeleton -> konten" sebagai estetika.

**Adaptasi KUWERA:** palet hitam + lime neon -> hijau-kuning KUWERA (bagian 3); 10K -> 5K; Strava -> co-brand/sponsor utama KUWERA; lineup & sponsor -> milik KUWERA; teks -> Bahasa Indonesia (opsional bilingual).

## 3. Konsep visual & brand

Palet warna mengikuti jersey dan lanyard KUWERA Fun Run 5K: hijau lapangan turun ke kuning cerah, logo putih, "FUN RUN 5K" kuning emas. Hitam dan lime neon dari video referensi tidak dipakai; strukturnya (satu warna aksi, kartu kaca, foto overlay gelap) tetap.

| Token | Nilai (disampel dari jersey/lanyard) | Pemakaian |
| --- | --- | --- |
| green-deep | #0B4A2C (hijau tua lanyard) | Latar gelap utama: hero, route, newsletter, footer; teks di atas kuning/krem |
| brand-green | #1C6B06 (hijau badan jersey) | Navbar saat scroll, kartu kaca, tombol sekunder, overlay foto |
| green-bright | #64A322 (titik tengah gradasi) | Hover, ikon, garis pemisah |
| yellow-lime | #F4E71D (ujung bawah jersey) | Underline kata kunci, garis rute di peta, aksen kecil |
| brand-yellow | #FFBB00 (kuning logo "FUN RUN 5K") | Tombol utama, angka besar, badge medali "5K", highlight kata headline |
| gold | #E3B219 (kuning emas lanyard) | Pill tanggal/jam, titik timeline, garis tepi kartu |
| cream | #FDFBF5 (putih krem lanyard) | Latar section sponsor dan CTA banner |
| white | #FFFFFF | Teks dan logo KUWERA di atas hijau |
| glass | rgba(255,255,255,0.10) + blur 16px + border 1px rgba(255,255,255,0.18) | Kartu Save the date, peta, navbar |

Gradasi & motif: gradasi jersey vertikal #1C6B06 -> #64A322 (55%) -> #F4E71D untuk banner tanggal, kartu promo hero, CTA banner, hover tombol; gradasi lanyard horizontal #0B4A2C -> #FDFBF5 -> #E3B219 untuk pemisah section dan progress bar form; motif gelombang organik (bawah jersey) sebagai layer dekoratif hero/banner, drift 20 detik loop via SVG + GSAP; motif titik halftone (bahu jersey, lanyard) sebagai tekstur sudut kartu dan section sponsor, opacity 15-25%. Logo KUWERA selalu putih di atas hijau, "FUN RUN 5K" selalu #FFBB00; di atas krem pakai versi hijau tua.

Pemetaan per section: Hero #0B4A2C + foto overlay hijau + gelombang, headline putih dengan "5K" #FFBB00, tombol Daftar #FFBB00/teks #0B4A2C, kartu medali #FFBB00, kartu promo gradasi jersey (ganti kartu oranye Strava); Route #0B4A2C, garis rute #F4E71D, titik #E3B219; Banner tanggal gradasi jersey + gelombang, pill #0B4A2C; Sponsor #FDFBF5 + halftone; CTA banner kartu gradasi jersey di atas krem, tombol #0B4A2C; Newsletter/FAQ/footer #0B4A2C, tombol #FFBB00.

Kontras WCAG (min 4,5): putih/#0B4A2C 10,3; putih/#1C6B06 6,7; #FFBB00/#0B4A2C 6,1; #0B4A2C/#FFBB00 6,1; #0B4A2C/#F4E71D 8,0; #FFBB00/#1C6B06 3,9 (hanya teks >= 24 px); kuning di atas krem/putih 1,3-1,7 (jangan pernah).

Tipografi: display Bebas Neue/Anton (condensed bold uppercase); angka besar Inter Tight 800 (tabular); body Inter / Plus Jakarta Sans.

Elemen khas: bento grid hero 3x2 (5 kartu), underline #F4E71D pada satu kata kunci tiap heading, pill radius penuh, badge medali "5K", radius kartu 20 px, tombol radius penuh + ikon panah.

Aset panitia: logo KUWERA SVG versi putih+kuning dan versi hijau tua; logo lembaga (emblem dada kiri jersey) untuk navbar/footer; file motif gelombang & halftone dalam SVG; 3 foto lanskap >= 2400 px; rute GPX/KML + nama checkpoint; foto talent 3:4; logo sponsor SVG/PNG per tier; teks event, S&K, FAQ >= 6.

## 4. Struktur halaman & isi section

Halaman: `/` landing (single-page scroll) -> `/daftar` (form multi-step) -> `/bayar/:orderId` (gateway) -> `/tiket/:code` (e-ticket + QR); `/cek-status`; `/faq`, `/syarat`, `/privasi`; `/admin`. Peserta tanpa akun; e-ticket lewat tautan unik ke email/WA.

| # | Section | Isi | Data dinamis |
| --- | --- | --- | --- |
| 0 | Navbar | Logo, menu Beranda/Rute/Info/Kontak, tombol Daftar setelah scroll (WhatsApp pindah ke tombol melayang kanan bawah) | - |
| 1 | Hero bento 5 kartu | Pill "AYO LARI BARENG", headline "KUWERA 5K", sub "didukung oleh ..."; kartu Save the date + kalender, counter pendaftar + Daftar + sisa kuota, peta 5K Route, promo early bird, medali finisher | Jumlah lunas & sisa kuota (refresh 30 s) |
| 2 | Route Detail | Peta rute 5K, timeline checkpoint, water station, cut-off | Checkpoint dari CMS |
| 3 | Banner tanggal | Tanggal, jam, titik start, foto landmark | - |
| 4 | (dihapus) | Tidak ada guest star; section ini tidak dipakai | - |
| 5 | Sponsor & partner | Logo per tier | CMS |
| 6 | CTA banner | Ajakan + tombol Daftar | - |
| 7 | Newsletter + FAQ | Email/WA channel + 3 FAQ + Lihat semua | CMS |
| 8 | Footer | Kontak, sosial, S&K, privasi | - |

`/daftar` 4 langkah: kategori (perorangan, 1 peserta per transaksi) + bahasa ID/EN -> data peserta (nama KTP, tgl lahir, gender, HP, email, jersey, kontak darurat, komunitas) -> ringkasan + promo + S&K -> pilih metode bayar (biaya layanan tampil per metode). Draft tersimpan 24 jam.

## 5. Fitur inti & user stories

| ID | User story | Kriteria diterima | Prio |
| --- | --- | --- | --- |
| F01 | Info tanggal, lokasi, harga, sisa kuota di layar pertama | Hero 5 kartu; counter = order lunas di DB | P0 |
| F02 | Daftar 1 orang dari HP < 3 menit | Multi-step, validasi inline, tanpa login | P0 |
| F03 | Registrasi kelompok dalam 1 pembayaran (bukan v1) | Struktur data sudah 1 order banyak peserta, UI menyusul | P2 |
| F04 | Bayar QRIS/VA/e-wallet, konfirmasi instan | Webhook <= 1 menit, e-ticket otomatis | P0 |
| F05 | E-ticket dengan QR untuk race pack | /tiket/:code + PDF + email | P0 |
| F06 | Admin lihat peserta, status, rekap jersey, ekspor Excel | Dashboard filter/cari/ekspor .xlsx | P0 |
| F07 | Registrasi tutup otomatis saat kuota penuh | Tombol jadi "Kuota penuh / Waiting list" | P0 |
| F08 | Cek status via email/HP | /cek-status kirim ulang tautan | P1 |
| F09 | Kode promo | Kuota, masa berlaku, nominal/persen | P1 |
| F10 | Scan QR saat ambil race pack | /admin/scan kamera HP | P1 |
| F11 | Broadcast ke peserta lunas | Email + WA Channel | P1 |
| F12 | Pengingat H-7, H-1 | Email/WA terjadwal | P2 |
| F13 | Bilingual ID/EN | Toggle di navbar (next-intl), default ID; e-ticket & email ikut bahasa | P0 |

Aturan bisnis: kuota = lunas + pending belum kedaluwarsa (hold 30 menit); satu email/HP sekali per kategori; jersey dikunci setelah lunas; tanpa refund otomatis.

## 6. Alur registrasi & payment gateway

Keputusan: **Midtrans Snap**, merchant atas nama badan usaha yang sudah ada (konfirmasi ulang NIB/NPWP/rekening sebelum production). Metode v1: QRIS (paling atas), VA BCA/BNI/BRI/Mandiri/Permata/CIMB, GoPay, ShopeePay, kartu; retail (Indomaret/Alfamart) tidak diaktifkan. Biaya per transaksi (perkiraan, cek midtrans.com/id/pricing): QRIS +-0,7%, VA +-Rp4.000, e-wallet +-2%, kartu +-2,9% + Rp2.000; tanpa biaya bulanan; sandbox gratis.

**Biaya layanan dibebankan ke peserta.** Peserta memilih metode di /daftar langkah 4 (bukan di popup Snap); server menghitung biaya layanan per metode, menampilkan "Harga tiket + Biaya layanan = Total", lalu membuka Snap dengan `enabled_payments` hanya metode itu agar total persis sama. Nominal per metode di tabel settings (dummy: QRIS Rp1.500, VA Rp4.500, GoPay/ShopeePay Rp4.000, kartu Rp7.500); alternatif flat Rp5.000 semua metode.

Alur: form + pilih metode -> `POST /api/orders` (cek kuota, hold 30 menit, hitung biaya layanan, order PENDING) -> buat transaksi Midtrans dengan enabled_payments=[metode] -> snap_token -> popup Snap -> webhook settlement -> verifikasi signature -> PAID + kode tiket -> kirim e-ticket email + WA -> browser polling status -> redirect `/tiket/:code`.

Status: DRAFT -> PENDING -> PAID | EXPIRED (30 menit, slot dilepas) | FAILED; PAID -> REFUNDED (manual); EXPIRED -> PENDING (ulang bayar).

Aturan teknis: (1) kebenaran bayar hanya dari webhook, bukan redirect; (2) verifikasi signature SHA-512 / callback token + cek ulang API status; (3) webhook idempoten; (4) order_id `KWR-{tahun}-{6 acak}` = kode tiket; (5) expiry 30 menit + cron pelepas slot tiap 5 menit; (6) cron rekonsiliasi harian vs settlement; (7) nominal integer rupiah; (8) uji sandbox: sukses, expired, bayar dua kali, webhook sebelum redirect, webhook telat 10 menit.

E-ticket: kode + QR, nama, kategori, jersey, jadwal & lokasi race pack, jam start, peta titik kumpul, wajib bawa KTP, link FAQ. Format: halaman web (utama), PDF (cadangan), pesan WA berisi tautan.

## 7. Spesifikasi animasi & interaksi

Semua gerak direproduksi di browser dengan kode. Zoom overview di awal/akhir video hanya ditiru sebagai preloader opsional.

| Library | Untuk apa |
| --- | --- |
| GSAP 3 + ScrollTrigger + SplitText + DrawSVG | Reveal saat scroll, headline per kata, garis rute, count-up (semua plugin gratis sejak 2025) |
| Lenis | Smooth scroll lerp 0,1 sinkron ScrollTrigger |
| Motion (framer-motion) | Accordion FAQ, langkah form, modal, tombol |
| Lottie (dotLottie) | Medali berputar, centang sukses bayar |
| canvas-confetti | Confetti sekali di e-ticket |
| CSS backdrop-filter | Glassmorphism |

| Elemen | Pemicu | Gerak | Durasi / easing / stagger |
| --- | --- | --- | --- |
| Preloader (opsional) | Load | Logo + progress, zoom-out 1,05->1 | 1,2 s power2.inOut |
| Headline hero | Setelah preloader | Clip-path bawah + y 30->0 per kata | 0,7 s power3.out, 0,08 s |
| 5 kartu hero | +0,3 s | opacity, scale 0,95->1, blur 8->0 | 0,6 s power2.out, 0,1 s |
| Counter pendaftar | Kartu muncul | Count-up | 1,5 s expo.out |
| Tombol Daftar | Hover/tap | Panah geser 4 px, #FFBB00 menggelap 8%; tap scale 0,97 | 0,2 s |
| Navbar | Scroll > 80 px | Latar kaca, tombol Daftar tampil | 0,3 s |
| Kartu peta | 20% viewport | blur + fade + scale | 0,6 s |
| Garis rute | Bersama peta | stroke-dashoffset 100->0 (path dari GPX) | 2 s power1.inOut |
| Timeline checkpoint | +0,4 s | Titik scale 0->1, label x -16->0 | 0,4 s, 0,06 s |
| Banner tanggal | Viewport | Skeleton -> teks; parallax foto +-30 px | 0,5 s; scrub |
| Logo sponsor | Viewport | opacity + y 12->0; marquee jika > 12 | 0,4 s, 0,05 s |
| CTA banner | Viewport | Skeleton blur -> scale 0,97->1 | 0,6 s |
| FAQ | Viewport; klik | x -20->0; accordion auto height | 0,4 s; 0,3 s |
| Form registrasi | Ganti langkah | Slide 40 px + fade, progress bar | 0,35 s |
| E-ticket | Load PAID | Lottie centang, confetti, tiket flip-in | 1,5 s |
| Tilt kartu hero (P2) | Hover desktop | Rotasi 3D +-6 derajat | - |

Aturan performa: hanya transform/opacity/filter/clip-path; blur maks 6 elemen lalu dihapus; animasi hero setelah LCP; mobile tanpa parallax/tilt, durasi -30%, stagger maks 6; prefers-reduced-motion -> fade 0,2 s; ScrollTrigger once:true; target 60 fps CPU 4x throttle, JS animasi < 120 kB gzip.

## 8. Tech stack & arsitektur

Keputusan: **VPS milik panitia**. Memungkinkan: 2 vCPU / 4 GB RAM / 40 GB SSD (Ubuntu 24.04) cukup untuk 500 pengguna bersamaan. Syarat: IP publik, domain, HTTPS aktif (webhook Midtrans hanya ke URL HTTPS publik).

| Lapisan | Pilihan |
| --- | --- |
| Frontend | Next.js 15 App Router + TypeScript + Tailwind + next-intl (ID/EN) |
| Backend | Next.js Route Handlers di container yang sama |
| Database | PostgreSQL 16 di Docker pada VPS + Prisma; counter via polling 30 s |
| Reverse proxy + SSL | Caddy (Let's Encrypt otomatis) |
| Deploy | Docker Compose (app, postgres, caddy); GitHub Actions via SSH atau Coolify |
| Payment | Midtrans Snap |
| Email transaksional | Resend (atau Brevo) dengan domain KUWERA terverifikasi + React Email; jangan SMTP dari VPS sendiri |
| Kotak masuk | Zoho Mail (gratis 5 user, domain sendiri) atau Google Workspace |
| WhatsApp | wa.me untuk peserta; Fonnte/Wablas broadcast (P1) |
| PDF / QR | @react-pdf/renderer; qrcode |
| Peta | Gambar statis + overlay SVG path dari GPX |
| Auth admin | Auth.js (email + password) + TOTP 2FA |
| Cron | Cron sistem VPS: expiry tiap 5 menit, rekonsiliasi + backup harian |
| Backup | pg_dump harian ke Cloudflare R2 (gratis 10 GB) + lokal 7 hari |
| CDN / proteksi | Cloudflare di depan VPS |
| Monitoring / analitik | Uptime Kuma + Sentry; Meta Pixel + GA4 (atau Umami) |

Arsitektur: Peserta -> Cloudflare -> VPS (Caddy HTTPS -> Next.js -> PostgreSQL Docker); Midtrans webhook -> Caddy; Next.js -> Resend, WA API; cron VPS -> expiry/rekonsiliasi/backup; backup -> R2; Admin -> Cloudflare.

Repo: `app/[locale]/` (landing, daftar, bayar, tiket, cek-status, admin), `app/api/` (orders, payments/webhook, tickets, cron/expire, cron/reconcile, admin/export), `components/sections/`, `lib/animations/`, `lib/payment/` (adapter Midtrans generik), `messages/` (id.json, en.json), `prisma/` (schema, migrasi, seed dummy), `deploy/` (Dockerfile, docker-compose.yml, Caddyfile, backup.sh, crontab).

Keamanan: kunci hanya di .env VPS (chmod 600); webhook tolak signature invalid + rate limit 60/menit/IP di Caddy; ufw hanya 22/80/443, SSH key, fail2ban, auto security update; PostgreSQL tidak diekspos; tidak simpan foto KTP; admin Auth.js + TOTP; backup harian + ekspor Excel H-3.

**Email atas nama KUWERA:** ya, buat baru, dan harus domain sendiri (dummy halo@kuwera5k.id), bukan Gmail. Resend hanya mengirim dari domain terverifikasi (SPF, DKIM, DMARC) dan e-ticket dari @gmail.com lewat pihak ketiga hampir pasti masuk spam. Urutan: tetapkan domain -> DNS di Cloudflare -> buat halo@ (balasan peserta) dan noreply@ (pengirim otomatis) di Zoho Mail/Google Workspace -> daftarkan domain di Resend, pasang 3 record DNS, tes kirim ke Gmail & Yahoo -> sebelum domain ada, development pakai sandbox Resend.

## 9. Data model & dashboard admin

Tabel (PostgreSQL di VPS via Prisma; v1 satu order = satu peserta, relasi tetap 1-ke-banyak): `categories` (name, price, quota, sale_start/end, is_active); `orders` (id KWR-2026-XXXXXX, category_id, status, subtotal, discount, fee, total, promo_code, buyer_email/phone, expires_at, paid_at); `participants` (order_id, full_name, birth_date, gender, phone, email, jersey_size, emergency_name/phone, community); `payments` (order_id, gateway, gateway_ref, method, amount, raw_payload, received_at); `tickets` (code, participant_id, qr_svg, bib_number, racepack_collected_at, collected_by); `promo_codes`; `site_content` (key, value jsonb); `settings` (biaya layanan per metode, hold_minutes, kuota_total, teks bilingual).

Dashboard: Ringkasan (lunas, pending, kuota, pendapatan, grafik harian); Peserta (filter, cari, ekspor xlsx/csv); Order & pembayaran (log webhook, cek ulang status, refund manual); Race pack (scanner QR, rekap jersey); Konten; Promo; Broadcast (P1).

Laporan ekspor: daftar peserta lengkap; rekap jersey per kategori; rekonsiliasi PAID vs settlement vs rekening.

## 10. Non-functional, milestone, biaya, pertanyaan terbuka

Non-functional: LCP < 2,5 s, TTI < 3,5 s, Lighthouse >= 90; 500 pengguna bersamaan (uji k6); 99,9% uptime, halaman statis tetap tampil saat DB gangguan; HTTPS, rate limit, validasi server; OG image 1200x630 hijau-kuning dengan logo KUWERA, schema.org Event, sitemap; teks hijau tua #0B4A2C di atas kuning, jangan kuning di atas krem/putih; 2 versi terakhir Chrome/Safari iOS/Samsung Internet; data peserta dihapus 6 bulan setelah hari-H.

| Minggu | Deliverable |
| --- | --- |
| 1 | Konten & aset, desain Figma, repo, VPS + Docker + Caddy, Midtrans sandbox, seed dummy |
| 2 | Landing page statis responsif |
| 3 | Animasi GSAP + Lenis, optimasi (Lighthouse >= 90) |
| 4 | Form registrasi, API order, webhook, e-ticket |
| 5 | Dashboard admin, ekspor, promo, scanner |
| 6 | Ganti dummy -> data final, UAT, load test, Midtrans production, verifikasi domain email, soft launch |

Biaya berjalan: VPS sudah ada (cek minimal 2 vCPU/4 GB); domain Rp150-300 rb/tahun; Cloudflare gratis; Zoho Mail gratis 5 user; Resend gratis 3.000 email/bulan; WA API +-Rp100 rb/bulan (P1); Midtrans per transaksi dibebankan ke peserta. Total Rp0-150 rb/bulan di luar domain. Cek harga resmi Midtrans (midtrans.com/id/pricing) sebelum production.

Status keputusan (20 Sep 2026):
- [x] kota Malang, tanggal dummy; rute resmi sudah ada (loop Lapangan Rampal, lihat bagian 12), start/finish = Lapangan Rampal
- [x] kategori/harga dummy, final menyusul
- [ ] merchant Midtrans: kunci sandbox dan production diterima 22 Sep, alur bayar lolos uji sandbox 23 Sep. Per 23 Sep akun production masih "Business review: In progress" dan belum ada metode bayar yang aktif (lihat bagian 12, Go-live)
- [x] biaya layanan ke peserta
- [x] sponsor placeholder TBC; guest star tidak ada (dikonfirmasi 23 Sep 2026)
- [x] registrasi perorangan
- [x] brand dari jersey/lanyard
- [x] bilingual default ID
- [ ] domain: pakai kuwera5k.vercel.app dulu, domain sendiri ditunda (menentukan email pengirim)
- [x] hosting: frontend di Vercel dulu, database di VPS dreinst (Coolify), lihat bagian 12. Migrasi app ke VPS sesuai bagian 8 tetap opsi nanti
- [ ] siapa yang develop belum ditetapkan

## 12. Status implementasi (per 23 September 2026)

Sudah jadi dan live di https://kuwera5k.vercel.app (auto-deploy dari `main` GitHub `dreinst/kuwera5k`):
- Landing page 8 section (navbar, hero bento 5 kartu, rute + timeline checkpoint, banner tanggal, sponsor, CTA, newsletter + FAQ, footer) dengan animasi reveal blur/fade/scale sesuai bagian 7 (framer-motion; GSAP/Lenis belum dipakai).
- Rute resmi dari peta panitia: Start Rampal, Jl. Ronggolawe, Jl. Urip Sumoharjo, Jl. Panglima Sudirman, Jl. Untung Suropati Utara, Jl. Terusan Kesatrian, Jl. Mayjen M. Wiyono, Jl. Indraprasta, Jl. Hamid Rusdi, Jl. Lapangan Brawijaya, Jl. Ronggolawe, Finish Rampal.
- Peta rute di situs (sejak 22 September 2026) direplikasi langsung dari poster resmi panitia sesuai permintaan Donny ("layout benar-benar sesuai gambaran, tanpa perubahan"): `tools/trace-poster.py` (`npm run route:map`) membaca `docs/design-reference/rute-final-panitia.jpg`, mengekstrak garis biru rute (garis tepi ditelusuri lalu digeser setengah lebar garis; bagian yang tertutup oktagon "3 KM" disambung ulang), bendera start dan finish, dua water station, empat oktagon KM (diurutkan menurut arah lari), 22 ikon marshal, panah arah, dan oval Lapangan Rampal, lalu menulis `src/lib/route-map.ts` (koordinat piksel poster) dan latar jalan `public/images/route-map-bg.webp` (garis abu-abu poster dijadikan putih transparan, elemen berwarna dihapus). `src/components/RouteMap.tsx` menggambar ulang semuanya dalam palet situs dengan animasi. Start dan finish digambar terpisah persis seperti poster (start di barat daya lapangan, finish di selatan lapangan). Rekonstruksi OSM sebelumnya tetap ada sebagai referensi (`npm run route:map:osm`, output `route-map-osm.*`, tidak dipakai situs).
- Database PostgreSQL 16 di VPS dreinst 187.53.129.205 lewat Coolify: project `kuwera5k`, resource `uvx3zbwvek7pig9oiwyzgivg`, db `kuwera5k`, user `kuwera`. Diekspos publik lewat proxy TCP nginx Coolify di port 5435 (port 5433/5434 sudah dipakai Supabase DriveTech). Firewall: `ufw allow 5435/tcp` saja tidak cukup karena VPS memakai `ufw-docker`; harus `ufw-docker allow uvx3zbwvek7pig9oiwyzgivg-proxy 5435`.
- Prisma 7.10.0 (bukan 8 rc: itu CLI platform cloud Prisma, beda workflow). Di Prisma 7, URL database pindah dari `schema.prisma` ke `prisma.config.ts`, dan `PrismaClient` wajib pakai driver adapter (`@prisma/adapter-pg` + `pg`), lihat `src/lib/db.ts`. Skema bagian 9 sudah di-push (8 tabel). `DATABASE_URL` tersimpan sebagai env sensitive di Vercel dan di `.env` lokal (tidak di-commit).

Catatan risiko yang belum ditutup:
- Koneksi Vercel ke database lewat internet tanpa SSL (`sslmode=disable`, driver `pg` menolak `prefer` karena server tidak mendukung SSL). Sebelum data peserta sungguhan masuk: aktifkan SSL di Postgres (sertifikat self-signed cukup, lalu `sslmode=require`) atau pindahkan app ke VPS sesuai bagian 8.
- Belum ada connection pooling (PgBouncer) di depan Postgres; Vercel serverless membuka banyak koneksi pendek. Tambahkan sebelum load test bagian 10.
- Belum ada pembatas spam di `POST /api/orders`: skrip bisa membuat banyak order palsu yang menahan kuota selama 30 menit. Pilihan: aturan rate limit Vercel Firewall untuk path itu, atau batas order pending per IP.
- Belum ada cron rekonsiliasi; pembayaran yang notifikasinya gagal total baru terdeteksi saat peserta membuka lagi `/bayar` atau mendaftar ulang.

Pendaftaran (dibangun 20 September 2026, pembayaran masih tiruan):
- `/daftar` empat langkah (kategori, data peserta, ringkasan + promo + S&K, metode bayar dengan biaya layanan per metode), validasi zod di klien dan server (`src/lib/registration.ts`), draft tersimpan di localStorage 24 jam. `/bayar/:orderId` menampilkan order, timer 30 menit, dan polling status; `/tiket/:code` menampilkan QR (dibuat server dengan `qrcode`), data peserta, jadwal race pack, konfeti. `/syarat` dan `/privasi` masih draf.
- API: `POST /api/orders` (cek kategori terbuka, kuota = lunas + pending belum kedaluwarsa, duplikat email/HP per kategori, promo, biaya layanan, order PENDING + hold 30 menit, id `KWR-{tahun}-{6 acak}` dengan retry tabrakan), `GET /api/orders/:id` (status untuk polling), `POST /api/orders/:id/pay-mock` (hanya saat `PAYMENT_MODE=mock`: tandai PAID, buat Payment gateway `mock` dan Ticket), `POST /api/promo`.
- `PAYMENT_MODE`: `mock` (tombol simulasi, dipakai sekarang di lokal dan Vercel supaya alur bisa dicoba), `off` (tombol bayar nonaktif), `midtrans` (Snap asli).
- Integrasi Midtrans Snap (kode selesai 22 September 2026, lolos uji penuh di sandbox pada 23 September 2026 dini hari WIB): `src/lib/midtrans.ts` (base URL sandbox/production dari `MIDTRANS_IS_PRODUCTION`, pembuatan token Snap dengan `enabled_payments` satu metode pilihan peserta, `expiry` mengikuti sisa hold, verifikasi signature SHA-512, cek ulang status ke API, pemetaan status), `POST /api/orders/:id/snap` (token), `POST /api/payments/webhook` (verifikasi signature, cek ulang ke API, cocokkan nominal, `markOrderPaid` idempoten; expire/cancel/deny jadi EXPIRED/FAILED), halaman `/bayar` memuat snap.js dan membuka popup dari tombol Bayar; polling status tetap jalan sehingga e-ticket muncul begitu webhook masuk. Kode channel yang terbukti di sandbox: QRIS umum `other_qris` (kode `qris` menghasilkan "No payment channels available"), Mandiri VA `echannel`, GoPay `gopay` dan ShopeePay `shopeepay` tampil sebagai QRIS masing-masing; channel aktif merchant sandbox: GoPay QRIS, 6 VA, kartu, ShopeePay QRIS.
- Catatan kunci: di dashboard Midtrans versi sekarang kunci Sandbox dan Production sama-sama berawalan `Mid-`; bedakan dari dashboard asalnya (dashboard.sandbox.midtrans.com vs dashboard.midtrans.com). Sejak 22 September 2026 malam env lokal dan Vercel memakai kunci Sandbox dengan `PAYMENT_MODE=midtrans` (kunci production diparkir di `MIDTRANS_PROD_*`); pembuatan token Snap ke API sandbox sudah terbukti jalan (order uji KWR-2026-UHZN4E).
- Hasil uji sandbox 23 September 2026 di alamat live (Notification URL sandbox diisi lewat dashboard): BCA VA lunas lewat simulator (order KWR-2026-6FZ4V6) dan QRIS lunas lewat simulator QRIS (KWR-2026-75FMBG, acquirer GoPay). Keduanya berubah PAID lewat webhook dalam hitungan detik tanpa halaman `/bayar` terbuka, tiket terbit, dan `/tiket` tampil tanpa label simulasi. Notifikasi yang dikirim ulang untuk order yang sudah lunas dijawab 200 dengan kode tiket yang sama (tidak ada tiket ganda), signature salah ditolak 403, order tak dikenal dijawab 200 `{ok:false}` supaya Midtrans berhenti mengulang. Kedaluwarsa dipaksa lewat API `POST /v2/{id}/expire` (KWR-2026-TSHFTF): webhook mengubah status jadi EXPIRED dan `/bayar` menampilkan "Waktu bayar habis" dengan tombol daftar ulang. Cara memakai simulator: VA di simulator.sandbox.midtrans.com/bca/va/index (masukkan nomor VA, Inquire, Pay); QRIS di simulator.sandbox.midtrans.com/v2/qris/index memakai URL gambar `https://api.sandbox.midtrans.com/v2/qris/{transaction_id}/qr-code` (gambar berlogo dari halaman Snap tidak terbaca simulator). Belum diuji: kartu kredit dan deeplink GoPay/ShopeePay.
- Audit kode pembayaran 23 September 2026 (sebelum go-live, 27 temuan dari lima sisi, tiap temuan diuji ulang dua pemeriksa independen) menemukan masalah yang tidak muncul di uji sandbox. Yang paling berat: cek duplikat email/HP memakai `{...activeOrderWhere(now), OR: [...]}` sehingga key `OR` kedua menimpa filter status, akibatnya siapa pun yang ordernya pernah kedaluwarsa tidak bisa mendaftar lagi selamanya. Kedua: tombol Bayar yang ditekan lagi (setelah popup ditutup atau halaman dimuat ulang) selalu gagal, karena Midtrans menolak token Snap baru untuk order_id yang sudah memilih metode. Perbaikan (commit e2e874f):
  - cek duplikat memakai `AND`, lalu cek duplikat, kuota, dan kuota promo berjalan dalam satu transaksi dengan `pg_advisory_xact_lock` (batas tunggu kunci 8 detik lewat `SET LOCAL lock_timeout`, dijawab 503 "Pendaftaran sedang ramai"); kuota promo dihitung dari order aktif sehingga order kedaluwarsa mengembalikan jatahnya, `usedCount` hanya mencatat pemakaian lunas;
  - token Snap disimpan di kolom baru `Order.snapToken`/`snapRedirectUrl` dan dipakai ulang; token baru ditolak kalau sisa hold kurang dari 1 menit; durasi expiry Snap dibulatkan ke bawah supaya Midtrans tidak menerima bayar setelah hold habis;
  - webhook hanya memakai status, nominal, dan metode dari API status Midtrans (isi notifikasi tidak dipercaya), error dijawab 503 supaya Midtrans mengulang, pelunasan memakai update bersyarat sehingga notifikasi ganda serentak tetap menghasilkan satu payment dan satu tiket;
  - pembayaran yang lunas setelah timer habis atau notifikasinya gagal tetap terdeteksi: halaman `/bayar` dan `GET /api/orders/:id?sync=1` mengecek ulang ke Midtrans, halaman bayar punya masa "Mengecek pembayaran" 3 menit setelah timer habis, dan pendaftaran ulang dengan email/HP yang sama mengecek order lama dulu supaya peserta tidak bayar dua kali;
  - kartu yang ditolak (`deny`) tidak langsung dianggap gagal selama hold masih berjalan karena Snap mengizinkan coba kartu lain; semua panggilan ke Midtrans diberi batas waktu;
  - metode bayar bisa dibatasi lewat `Setting.registration.methods` (daftar id metode; kosong = semua) tanpa deploy; pembayaran sandbox dicatat `gateway = "midtrans-sandbox"` dan tiketnya berlabel simulasi;
  - fungsi Vercel dipindah ke region `sin1` (Singapura) lewat `vercel.json` karena VPS database ada di Kuala Lumpur; sebelumnya fungsi jalan di `iad1` (AS) dengan jeda sekitar 230 ms per query.
  Diuji di Postgres lokal + Midtrans sandbox (31 kasus, semua lolos, termasuk 10 pendaftaran serentak dengan kuota 3, notifikasi telat setelah hold habis, dan 6 notifikasi ganda serentak), lalu uji singkat di alamat live setelah deploy.
- Go-live, status 23 September 2026:
  1. Akun production Midtrans masih "Business review: In progress". Metode yang sedang diaktifkan: BNI, CIMB Niaga, Permata, BRI, Mandiri Bill, BSI, GoPay, GoPay Dynamic QRIS (SLA 3 sampai 4 hari kerja). BCA VA, ShopeePay, dan kartu kredit belum diajukan; keputusan Donny apakah diajukan (BCA VA SLA 7 hari kerja, ShopeePay 20 hari kerja dan butuh izin usaha perdagangan).
  2. Notification URL production (dashboard.midtrans.com > Settings > Payment > Notification URL) = `https://kuwera5k.vercel.app/api/payments/webhook` belum diisi; perlu diisi Donny sendiri.
  3. Setelah metode aktif: isi `Setting.registration.methods` dengan metode yang benar-benar aktif (misal `["qris","bni_va","bri_va","mandiri_va","permata_va","cimb_va","gopay"]`), di Vercel pindahkan `MIDTRANS_PROD_SERVER_KEY` ke `MIDTRANS_SERVER_KEY` dan `MIDTRANS_PROD_CLIENT_KEY` ke `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY`, set `MIDTRANS_IS_PRODUCTION=true`, deploy ulang (client key dibaca saat build).
  4. Tepat sebelum pindah, hapus semua order yang dibuat selama mode sandbox (token Snap sandbox di order itu tidak berlaku di production). Data dikosongkan saat go-live (keputusan Donny 23 Sep): sebelum `MIDTRANS_IS_PRODUCTION=true`, hero menampilkan angka contoh (214 pendaftar, sisa 786 dari `event-data.ts`); sesudahnya hero membaca database (`getPublicStats`, beranda diperbarui tiap 60 detik), jadi mulai dari 0 peserta dan sisa kuota penuh. Order uji lama sudah dihapus 23 Sep dengan cadangan di `tools/cache/` (gitignored).
  5. Uji satu transaksi sungguhan kecil setelah pindah (dibayar Donny sendiri), lalu refund manual dan hapus ordernya supaya hitungan pendaftar kembali 0.
- Seed (`npm run db:seed`): satu kategori "Pendaftaran 5K" Rp125.000 (harga dari Donny 22 Sep 2026; jendela penjualan 1 Sep sampai 23 Okt 2026 23.59 WIB (H-1 acara), dimajukan supaya pratinjau bisa dicoba sekarang), promo `KUWERA10` (10%, kuota 100), setting biaya layanan per metode (QRIS 1.500, VA 4.500, e-wallet 4.000, kartu 7.500), hold 30 menit, kuota total 1.000.
- Keputusan sementara yang diambil tanpa konfirmasi: usia minimal 12 tahun saat hari lomba (`MIN_AGE`), biaya layanan per metode (bukan flat). Ubah lewat tabel Setting atau `src/lib/registration.ts`.

Pembaruan tampilan 23 September 2026 (permintaan Donny):
- Guest star dihapus seluruhnya (section, data, foto) karena acara tidak memakai guest star.
- WhatsApp admin panitia: +62 822 3299 9900 (`src/lib/whatsapp.ts`). Tombol WhatsApp melayang di kanan bawah semua halaman (`src/components/WhatsAppButton.tsx`, dipasang di root layout) dan tidak ada lagi di navbar. Isi pesan mengikuti halaman: umum ("Halo kak, izin bertanya soal KUWERA Fun Run 5K: "), `/daftar` ("Halo kak, izin menyampaikan ada error di pendaftaran KUWERA Fun Run 5K. Detailnya: "), `/bayar/:id` (kendala pembayaran + nomor order), `/tiket/:code` (pertanyaan tiket + kode tiket); halaman bayar yang habis waktunya memakai template "sudah membayar tapi e-ticket belum muncul".
- Tekstur latar ala jersey (`src/components/JerseyTexture.tsx`): titik halftone kuning di pojok atas (`public/images/jersey-dots.svg`, dibuat skrip, titik mengecil seperti bahu jersey) dan pita hijau bergelombang di bawah (`public/images/jersey-waves.webp`, pita kontur dari medan halus, memudar ke atas). Awalnya dipakai per section; sejak revisi logo dan tekstur di bawah diganti satu lapis tekstur untuk seluruh halaman.
- Medali memakai desain teaser panitia (`preview medali untuk website.svg`); sejak revisi hero di bawah diganti desain final.
- Peta rute: panah arah diperkecil supaya muat di dalam garis rute; dua panah palsu (garis tepi oktagon 3 KM dan bendera start) dibuang lewat filter di `tools/trace-poster.py`. Pos marshal diganti 17 pos dari peta "POS PAM" panitia (27 personel, `docs/design-reference/pos-pam-2024.png`, gitignored): `tools/map-marshal-posts.py` mencocokkan sudut rute di kedua peta (transformasi afin, galat rata-rata 32 px dari lebar 3838), menempelkan tiap pos ke garis rute, lalu menulis `src/lib/marshal-posts.ts`. Situs menampilkan titik pos dan ikonnya; jumlah personel per pos tidak ditampilkan.

Revisi 23 September 2026: water station hanya satu, di km 2,5 tepatnya di Denzibang (keputusan panitia). Water station dekat start dihapus. Posisinya di peta tidak lagi diambil dari pin poster, melainkan dihitung dari daftar checkpoint (`route.checkpoints` di `src/lib/event-data.ts`) lewat `src/lib/route-geo.ts`: km diubah jadi posisi di jalur dengan interpolasi di antara penanda KM poster, jadi kalau lokasinya berubah cukup ganti angka km-nya. Section rute: peta di kiri, urutan jalan dan checkpoint berdampingan di kanan. Footer: kredit "Made by dreinst, organized by D'Production Event Organizer" dengan logo D'Pro, sama seperti situs grup D'Pro lain.

Revisi 23 September 2026: start dan finish di titik yang sama, dengan jalur berbentuk U sesuai arahan panitia (foto satelit Donny) dan poster: start berangkat dari titik S/F di Jl. Urip Sumoharjo ke tenggara, putar balik di simpang Jl. Ronggolawe, kembali ke barat laut di lajur luar menuju pojok Panglima Sudirman; finish turun dari Jl. Ronggolawe lalu menyusuri lajur paling dekat lapangan ke titik S/F yang sama. Penelusuran garis tengah poster sebelumnya melebur lajur-lajur ini jadi zig-zag, jadi `tools/trace-poster.py` sekarang membangun ulang bagian ini dari ukuran poster (tiga lajur sejajar lebar 56, garis utama tetap 118) dan menulis `segments` di `route-map.ts`; `RouteMap.tsx` menggambar tiap segmen dengan lebarnya dan animasi berurutan. Penanda S/F berupa dua bendera bersilang di antara ujung lajur start dan lajur finish. `tools/map-marshal-posts.py` kini memakai koordinat sudut (bukan nomor titik) supaya tahan terhadap pembuatan ulang jalur.

Revisi 23 September 2026 (logo, tekstur, SEO, Meta Pixel):
- Logo resmi KUWERA Fun Run dari Donny divektorkan per warna (`public/brand/kuwera-logo.svg`, versi putih+kuning `kuwera-logo-light.svg`) dan dipakai di navbar, footer, dan kepala e-ticket. Favicon, ikon aplikasi, dan apple-touch-icon memakai monogram "KU" di kotak hijau tua (`src/app/icon.svg`, `apple-icon.png`, `favicon.ico`).
- Tekstur satu lapis untuk seluruh halaman (`src/components/PageTexture.tsx`, fixed di belakang konten): gradasi hijau, grid titik tipis, titik halftone di pojok, pita gelombang di bawah. Latar dan tekstur per section dibuang. Kartu dan form (form daftar, kartu pembayaran, kartu peta rute, kolom email newsletter) memakai gradasi hijau polos `bg-card` (`src/app/globals.css`); kartu kaca di hero tetap karena berada di atas foto. `JerseyTexture` tinggal dipakai di hero, dan latar hero memudar di bagian bawah ke tekstur halaman supaya tidak ada garis batas. Section konten seragam `py-20`, lebar isi `max-w-6xl` di tengah, termasuk navbar (logo sejajar dengan isi section).
- SEO: `metadataBase` dan judul bertemplate di `src/app/layout.tsx` (alamat situs dari `src/lib/site.ts`), deskripsi dan canonical per halaman, gambar OG 1200x630 (`src/app/opengraph-image.jpg`, 128 KB supaya pratinjau WhatsApp muncul), `robots.txt` (blokir `/api/`), `sitemap.xml` (/, /daftar, /syarat, /privasi), `manifest.webmanifest`, halaman 404 berbahasa Indonesia, dan data terstruktur schema.org `SportsEvent` di beranda (`src/lib/structured-data.ts`: tanggal, Lapangan Rampal dengan koordinat, harga Rp126.500 = Rp125.000 + biaya layanan termurah). `/bayar` dan `/tiket` diberi `noindex` karena memuat nama dan email peserta. Hasil audit sebelum perubahan: Lighthouse mobile SEO 100, performa 93.
- Hero (permintaan Donny): kartu peta rute 5K dihapus dari hero (peta lengkap tetap di section Rute). Kartu medali memakai desain final medali dan lanyard, tampak depan (pelari) dan belakang (lambang Keuangan Angkatan Darat), dari `medali depan.svg` dan `belakang.svg` (dirender dengan Chromium, digabung jadi `public/images/medali.webp`). Kartu baru "Jersey peserta" di kiri kartu medali memakai `PREV_JERSEY_KUWERA FUN RUN 5K_DPRO.jpg` yang latar putihnya dibuang (`public/images/jersey.webp`). Susunan di layar lebar: baris atas tanggal, pendaftar, biaya; baris bawah jersey (dua kolom) dan medali. Gambar OG ikut memakai medali baru.
- Meta Pixel (`src/components/MetaPixel.tsx`, `src/lib/meta-pixel.ts`) aktif kalau `NEXT_PUBLIC_META_PIXEL_ID` diisi. Kode dasar dipasang lewat `ensureFbq()` begitu event pertama dipanggil, jadi event saat halaman baru terbuka masuk antrean setelah `init`; setup otomatis Meta dimatikan (`autoConfig` false). Event: PageView (tiap halaman, perpindahan halaman dicatat fbevents.js sendiri), ViewContent (form daftar dibuka), InitiateCheckout (order dibuat) dan AddPaymentInfo (Snap pertama kali dibuka) hanya saat Midtrans production, Purchase (e-ticket pembayaran Midtrans production, sekali per order dan hanya 24 jam pertama setelah lunas, `eventID` = nomor order untuk deduplikasi kalau Conversions API dipasang). Alamat halaman yang dikirim ke Meta memuat nomor order di /bayar dan /tiket; kebijakan privasi menyebutkannya. Automatic Advanced Matching di Events Manager harus tetap nonaktif. Data peserta tidak dikirim ke Meta; kebijakan privasi sudah menyebutnya. Verifikasi domain lewat `NEXT_PUBLIC_META_DOMAIN_VERIFICATION`. Per 23 September 2026 ad account Meta panitia belum punya dataset/Pixel, jadi ID-nya belum diisi. GA4 belum dipasang.

Redesign 23 September 2026 mengikuti video konsep dan screenshot referensi Donny (isi, materi, dan palet KUWERA tetap):
- Navbar: menu di kiri (Beranda, Rute, Info, FAQ, Kontak), logo di tengah, tombol Daftar selalu tampil di kanan. WhatsApp tetap hanya tombol melayang.
- Hero: pil "Fun Run 5K Malang 2026", judul terpusat "KUWERA" (garis tepi) "FUN RUN" (isi kuning) "5K" (garis tepi), deskripsi, lalu "Diselenggarakan oleh" + logo D'Pro. Kartu tiga kolom bertingkat: kiri Save the date (tanggal besar, tombol Tambah ke kalender Google, selesai = start + batas waktu 60 menit) dan biaya pendaftaran; tengah jumlah pendaftar + tombol Daftar dan kartu medali kuning ("Medali finisher menunggu kamu!"); kanan kartu jersey (menggantikan kartu rute di konsep, karena kartu rute sudah diminta dihapus dari hero).
- Detail rute: judul terpusat, linimasa nama jalan bergaya konsep (titik start/finish menyala, kata terakhir putih, sisanya kuning), checkpoint tetap di kanan urutan jalan. Latar peta baru diunduh saat peta mendekati layar.
- Pita tanggal selebar layar: foto Tugu di kiri memudar ke kuning, pil tanggal dan jam serta "Titik kumpul Lapangan Rampal" rata kanan.
- Sponsor & Partner dengan judul bergaris bawah; kartu ajakan daftar gelap dengan foto pelari di kanan; Newsletter ("Jangan sampai ketinggalan!") dan "Pertanyaan umum" berdampingan; footer satu baris (hak cipta, logo, tautan) lalu kredit D'Pro.
- Font isi Inter (sebelumnya Arial), tombol pil dengan lingkaran panah (`src/components/ArrowCircle.tsx`).
- Lighthouse HP setelah redesign (build produksi lokal): performa 90 sampai 91, aksesibilitas 100, best practices 100, SEO 100; total unduhan awal 478 KB (dari 818 KB) setelah latar peta rute dimuat belakangan dan tekstur gelombang dikompres. LCP simulasi 3,5 detik, masih di atas target PRD 2,5 detik.

SEO lanjutan 23 September 2026: data terstruktur beranda jadi satu `@graph` (SportsEvent dengan `endDate` = start + 60 menit dan URL penyelenggara www.dpro.events, WebSite dengan nama dan nama alternatif situs untuk tampilan nama situs di Google, FAQPage sesuai FAQ yang tampil); meta `googlebot` mengizinkan pratinjau gambar besar dan cuplikan penuh; slot verifikasi Google Search Console lewat `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`; sitemap memuat `lastmod`. Ketersediaan tiket di data terstruktur berubah jadi SoldOut otomatis kalau kuota habis (setelah go-live).

Newsletter (status 23 September 2026): form di beranda belum menyimpan maupun mengirim apa pun (`onSubmit` hanya mencegah reload). Belum ada layanan email, alamat pengirim, maupun domain email (`halo@kuwera5k.id` belum ada karena domain kuwera5k.id belum dibeli). Keputusan yang dibutuhkan dari panitia: alamat pengirim dan domainnya, isi dan jadwal email, serta siapa yang menulis kontennya.

Form pendaftaran 24 September 2026 (permintaan Donny): nama depan dan belakang (nama belakang boleh kosong; `fullName` tetap disimpan sebagai gabungan), email, nomor HP, nomor identitas KTP/KIA (NIK 16 angka, ikut dicek duplikat bersama email dan HP), alamat, provinsi (38 provinsi), kota/kabupaten, kode pos, tanggal lahir, jenis kelamin, golongan darah (A, B, AB, O, Belum tahu), kontak darurat, ukuran jersey, komunitas (opsional). Kolom baru di tabel Participant nullable (sudah di-push ke database live). Ukuran jersey XS sampai 4XL dengan size chart sementara dari Donny (lingkar dada 90 sampai 125, panjang badan 64 sampai 78, lengan 31 sampai 38 cm) yang bisa dibuka di form. Cloudflare Turnstile ("bukan robot") di langkah pembayaran, diverifikasi server di `POST /api/orders`; aktif hanya kalau `NEXT_PUBLIC_TURNSTILE_SITE_KEY` dan `TURNSTILE_SECRET_KEY` keduanya diisi (menunggu kunci dari dashboard Cloudflare panitia). Kebijakan privasi menyebut data baru dan Cloudflare.

Halaman admin 24 September 2026 (`/admin`, desain mengikuti landing, referensi fitur dari admin DriveTech dan Pet Blessings):
- Akun di tabel `AdminUser`, dibuat dengan `npm run admin:user -- <username> <admin|panitia>` yang mencetak link sekali pakai (24 jam) untuk mengatur kata sandi sendiri; reset memakai perintah yang sama dan mengeluarkan semua sesi lama akun itu. Kata sandi di-hash scrypt; sesi berupa cookie httpOnly bertanda tangan HMAC (12 jam, kunci di Setting `adminAuth`); 5 kali salah = akun terkunci 15 menit; Turnstile di halaman masuk kalau kuncinya diisi. Setiap halaman, server action, dan route admin memeriksa sesi sendiri. Semua aksi tercatat di `AdminLog`.
- Peran `admin`: semua fitur. Peran `panitia`: dashboard, data peserta, cek Midtrans per order, tandai race pack (tidak bisa ekspor CSV, verifikasi massal, atau membatalkan tanda race pack).
- Dashboard (diperbarui tiap 30 detik): peserta lunas, menunggu bayar, kedaluwarsa/gagal, race pack diambil, pendapatan tiket, biaya layanan, total diterima, grafik lunas per hari (14 hari), rekap ukuran jersey, jenis kelamin, golongan darah, kota terbanyak, pendaftaran terbaru, aktivitas admin.
- Data peserta: cari nama/email/HP/NIK/nomor order, saring status, NIK disamarkan di daftar, lengkap di detail. Detail: data peserta, pembayaran, "Cek ke Midtrans" (status resmi, jenis bayar, nominal, waktu, ID transaksi), "Sinkronkan status" untuk order yang belum final, dan tanda ambil race pack setelah mencocokkan NIK dengan KTP/KIA.
- Verifikasi Midtrans (admin): semua order yang pernah membuka Snap atau tercatat lunas dicocokkan status dan nominalnya; hasil Cocok, Tidak cocok, Belum bayar, Belum ada transaksi, Simulasi, Gagal cek.
- Ekspor CSV (admin) untuk Excel, dengan pengaman rumus Excel di setiap sel.
- `/admin` tidak diindeks (noindex, diblokir di robots.txt), tanpa tombol WhatsApp dan tanpa Meta Pixel.

Belum dikerjakan: `/cek-status`, dashboard admin, cron expiry/rekonsiliasi, email dan WhatsApp e-ticket, next-intl (bilingual), GSAP/Lenis, foto asli, counter pendaftar di hero masih angka dummy (belum baca database), ID Meta Pixel dan GA4.

## 11. Aset desain

- `stitch_kuwera_5k_website_registration.zip` (Downloads): dipakai sebagai referensi desain tambahan.
- `konsep kuwera 5k.mp4` (Downloads, 15,4 detik, 1440x1080, 60 fps): referensi utama motion/animasi, ditiru persis polanya lalu diadaptasi ke palet dan konten KUWERA sesuai bagian 2 dan 7.
