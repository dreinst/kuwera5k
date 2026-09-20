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
| Tanggal & jam start | Minggu, 13 Desember 2026, 06.00 WIB | Dummy |
| Titik start & finish | Alun-Alun Tugu (depan Balai Kota Malang) | Dummy |
| Rute ilustrasi | Alun-Alun Tugu -> Jl. Kahuripan -> Jl. Semeru -> Jl. Besar Ijen -> Jl. Bandung -> Jl. Veteran -> Jl. Kawi -> Jl. Semeru -> Alun-Alun Tugu | Dummy, ukur ulang dari GPX |
| Kuota total | 1.000 peserta | Dummy |
| Registrasi dibuka | 15 Oktober 2026 (early bird sampai 15 November 2026) | Dummy |
| Pengambilan race pack | Sabtu, 12 Desember 2026, 10.00-18.00 WIB | Dummy |
| Guest star / hiburan | 4 slot "Bintang Tamu (TBC)"; senam pemanasan, live music, doorprize | Dummy |
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
| green-deep | #0B4A2C (hijau tua lanyard) | Latar gelap utama: hero, route, guest star, newsletter, footer; teks di atas kuning/krem |
| brand-green | #1C6B06 (hijau badan jersey) | Navbar saat scroll, kartu kaca, tombol sekunder, overlay foto |
| green-bright | #64A322 (titik tengah gradasi) | Hover, ikon, garis pemisah |
| yellow-lime | #F4E71D (ujung bawah jersey) | Underline kata kunci, garis rute di peta, aksen kecil |
| brand-yellow | #FFBB00 (kuning logo "FUN RUN 5K") | Tombol utama, angka besar, badge medali "5K", highlight kata headline |
| gold | #E3B219 (kuning emas lanyard) | Pill tanggal/jam, titik timeline, garis tepi kartu |
| cream | #FDFBF5 (putih krem lanyard) | Latar section sponsor dan CTA banner |
| white | #FFFFFF | Teks dan logo KUWERA di atas hijau |
| glass | rgba(255,255,255,0.10) + blur 16px + border 1px rgba(255,255,255,0.18) | Kartu Save the date, peta, navbar |

Gradasi & motif: gradasi jersey vertikal #1C6B06 -> #64A322 (55%) -> #F4E71D untuk banner tanggal, kartu promo hero, CTA banner, hover tombol; gradasi lanyard horizontal #0B4A2C -> #FDFBF5 -> #E3B219 untuk pemisah section dan progress bar form; motif gelombang organik (bawah jersey) sebagai layer dekoratif hero/banner, drift 20 detik loop via SVG + GSAP; motif titik halftone (bahu jersey, lanyard) sebagai tekstur sudut kartu dan section sponsor, opacity 15-25%. Logo KUWERA selalu putih di atas hijau, "FUN RUN 5K" selalu #FFBB00; di atas krem pakai versi hijau tua.

Pemetaan per section: Hero #0B4A2C + foto overlay hijau + gelombang, headline putih dengan "5K" #FFBB00, tombol Daftar #FFBB00/teks #0B4A2C, kartu medali #FFBB00, kartu promo gradasi jersey (ganti kartu oranye Strava); Route #0B4A2C, garis rute #F4E71D, titik #E3B219; Banner tanggal gradasi jersey + gelombang, pill #0B4A2C; Guest star #0B4A2C, nama #FFBB00; Sponsor #FDFBF5 + halftone; CTA banner kartu gradasi jersey di atas krem, tombol #0B4A2C; Newsletter/FAQ/footer #0B4A2C, tombol #FFBB00.

Kontras WCAG (min 4,5): putih/#0B4A2C 10,3; putih/#1C6B06 6,7; #FFBB00/#0B4A2C 6,1; #0B4A2C/#FFBB00 6,1; #0B4A2C/#F4E71D 8,0; #FFBB00/#1C6B06 3,9 (hanya teks >= 24 px); kuning di atas krem/putih 1,3-1,7 (jangan pernah).

Tipografi: display Bebas Neue/Anton (condensed bold uppercase); angka besar Inter Tight 800 (tabular); body Inter / Plus Jakarta Sans.

Elemen khas: bento grid hero 3x2 (5 kartu), underline #F4E71D pada satu kata kunci tiap heading, pill radius penuh, badge medali "5K", radius kartu 20 px, tombol radius penuh + ikon panah.

Aset panitia: logo KUWERA SVG versi putih+kuning dan versi hijau tua; logo lembaga (emblem dada kiri jersey) untuk navbar/footer; file motif gelombang & halftone dalam SVG; 3 foto lanskap >= 2400 px; rute GPX/KML + nama checkpoint; foto talent 3:4; logo sponsor SVG/PNG per tier; teks event, S&K, FAQ >= 6.

## 4. Struktur halaman & isi section

Halaman: `/` landing (single-page scroll) -> `/daftar` (form multi-step) -> `/bayar/:orderId` (gateway) -> `/tiket/:code` (e-ticket + QR); `/cek-status`; `/faq`, `/syarat`, `/privasi`; `/admin`. Peserta tanpa akun; e-ticket lewat tautan unik ke email/WA.

| # | Section | Isi | Data dinamis |
| --- | --- | --- | --- |
| 0 | Navbar | Logo, menu Beranda/Rute/Info/Kontak, WA panitia, tombol Daftar setelah scroll | - |
| 1 | Hero bento 5 kartu | Pill "AYO LARI BARENG", headline "KUWERA 5K", sub "didukung oleh ..."; kartu Save the date + kalender, counter pendaftar + Daftar + sisa kuota, peta 5K Route, promo early bird, medali finisher | Jumlah lunas & sisa kuota (refresh 30 s) |
| 2 | Route Detail | Peta rute 5K, timeline checkpoint, water station, cut-off | Checkpoint dari CMS |
| 3 | Banner tanggal | Tanggal, jam, titik start, foto landmark | - |
| 4 | Guest star / rangkaian acara | 4 kartu talent, atau senam, live music, doorprize, bazar | Lineup dari CMS |
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
| Kartu guest star | Viewport | clip-path inset(0 100% 0 0)->inset(0), nama y 20->0 | 0,7 s power3.out, 0,12 s |
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
- [ ] merchant Midtrans: badan usaha ada, konfirmasi ulang dokumen; menunggu Sandbox Server Key + Client Key (checklist lengkap sudah dikirim ke Andrew via Telegram 20 Sep)
- [x] biaya layanan ke peserta
- [x] guest star & sponsor placeholder TBC
- [x] registrasi perorangan
- [x] brand dari jersey/lanyard
- [x] bilingual default ID
- [ ] domain: pakai kuwera5k.vercel.app dulu, domain sendiri ditunda (menentukan email pengirim)
- [x] hosting: frontend di Vercel dulu, database di VPS dreinst (Coolify), lihat bagian 12. Migrasi app ke VPS sesuai bagian 8 tetap opsi nanti
- [ ] siapa yang develop belum ditetapkan

## 12. Status implementasi (per 20 September 2026)

Sudah jadi dan live di https://kuwera5k.vercel.app (auto-deploy dari `main` GitHub `dreinst/kuwera5k`):
- Landing page lengkap 9 section (navbar, hero bento 5 kartu, rute + timeline checkpoint, banner tanggal, guest star, sponsor, CTA, newsletter + FAQ, footer) dengan animasi reveal blur/fade/scale sesuai bagian 7 (framer-motion; GSAP/Lenis belum dipakai).
- Rute resmi dari peta panitia: Start Rampal, Jl. Ronggolawe, Jl. Urip Sumoharjo, Jl. Panglima Sudirman, Jl. Untung Suropati Utara, Jl. Terusan Kesatrian, Jl. Mayjen M. Wiyono, Jl. Indraprasta, Jl. Hamid Rusdi, Jl. Lapangan Brawijaya, Jl. Ronggolawe, Finish Rampal.
- Peta rute dibangun dari geometri jalan OpenStreetMap oleh `tools/generate-route-map.mjs` (`npm run route:map`): jalur dirutekan lewat graf jalan mengikuti urutan nama jalan di atas, latar jaringan jalan ditulis ke `public/images/route-map-bg.svg`, jalur dan marker ke `src/lib/route-map.ts`, dirender `src/components/RouteMap.tsx`. Nama di OSM: Panglima Sudirman = "Jalan Panglima Besar Sudirman", ada penghubung "Jalan Kesatrian" dan "Jalan Hamid Rusdi Timur"; "Jl. Lapangan Brawijaya" tidak bernama di OSM. Wajib atribusi "OpenStreetMap contributors, ODbL" (sudah ada di caption).
- Rute dicocokkan dengan peta resmi panitia (`Asset RUTE FINAL.jpg`, salinan di `docs/design-reference/`, tidak di-commit) memakai `tools/trace-reference.py`: garis biru diekstrak dari gambar, digeoreferensikan ke OSM lewat 8 simpang yang pasti (residu 4 sampai 46 m), lalu ruas di bawah garis diidentifikasi. Hasilnya: setelah Indraprasta rute naik ke ujung utara Jl. Hamid Rusdi (sekitar 7,969 LS), belok barat lewat jalan permukiman tanpa nama, turun ke ujung barat Jalan Lapangan, lalu ke timur menyusuri sisi utara lapangan (inilah "Jl. Lapangan Brawijaya") sampai Ronggolawe, dan finish di sisi timur lapangan. Titik-titik ini ada di `REF_WAYPOINTS` dalam generator. Panjang di geometri jalan 4,84 km; jarak resmi 5K termasuk lintasan start/finish di dalam Lapangan Rampal. KM 1 Panglima Sudirman, KM 2 Kesatrian, KM 3 Hamid Rusdi Timur, KM 4 di belokan barat permukiman utara Rampal (sama seperti poster). Kalau panitia punya GPX, taruh di `tools/route.gpx` dan generator memakainya langsung.
- Database PostgreSQL 16 di VPS dreinst 187.53.129.205 lewat Coolify: project `kuwera5k`, resource `uvx3zbwvek7pig9oiwyzgivg`, db `kuwera5k`, user `kuwera`. Diekspos publik lewat proxy TCP nginx Coolify di port 5435 (port 5433/5434 sudah dipakai Supabase DriveTech). Firewall: `ufw allow 5435/tcp` saja tidak cukup karena VPS memakai `ufw-docker`; harus `ufw-docker allow uvx3zbwvek7pig9oiwyzgivg-proxy 5435`.
- Prisma 7.10.0 (bukan 8 rc: itu CLI platform cloud Prisma, beda workflow). Di Prisma 7, URL database pindah dari `schema.prisma` ke `prisma.config.ts`, dan `PrismaClient` wajib pakai driver adapter (`@prisma/adapter-pg` + `pg`), lihat `src/lib/db.ts`. Skema bagian 9 sudah di-push (8 tabel). `DATABASE_URL` tersimpan sebagai env sensitive di Vercel dan di `.env` lokal (tidak di-commit).

Catatan risiko yang belum ditutup:
- Koneksi Vercel ke database lewat internet tanpa SSL (`sslmode=disable`, driver `pg` menolak `prefer` karena server tidak mendukung SSL). Sebelum data peserta sungguhan masuk: aktifkan SSL di Postgres (sertifikat self-signed cukup, lalu `sslmode=require`) atau pindahkan app ke VPS sesuai bagian 8.
- Belum ada connection pooling (PgBouncer) di depan Postgres; Vercel serverless membuka banyak koneksi pendek. Tambahkan sebelum load test bagian 10.

Belum dikerjakan: `/daftar` (form multi-step), integrasi Midtrans + webhook, `/tiket/:code`, `/cek-status`, dashboard admin, cron expiry/rekonsiliasi, email transaksional, next-intl (bilingual), GSAP/Lenis, foto asli (masih placeholder), humanizer pass untuk seluruh teks.

## 11. Aset desain

- `stitch_kuwera_5k_website_registration.zip` (Downloads): dipakai sebagai referensi desain tambahan.
- `konsep kuwera 5k.mp4` (Downloads, 15,4 detik, 1440x1080, 60 fps): referensi utama motion/animasi, ditiru persis polanya lalu diadaptasi ke palet dan konten KUWERA sesuai bagian 2 dan 7.
