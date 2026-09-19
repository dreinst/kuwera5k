# KUWERA 5K

Website resmi fun run KUWERA 5K di Malang: landing page, pendaftaran peserta dengan pembayaran lewat Midtrans, dan e-ticket otomatis. Live di https://kuwera5k.vercel.app.

Dokumen kebutuhan lengkap ada di `docs/PRD.md`, termasuk status implementasi terbaru di bagian 12.

## Stack

Next.js 16 (App Router), Tailwind CSS 4, framer-motion, Prisma 7 dengan PostgreSQL 16. Frontend di Vercel, database di VPS panitia lewat Coolify.

## Struktur folder

- `src/app`: routing dan halaman
- `src/components`: komponen UI, section landing page ada di `sections/`
- `src/lib`: data event (`event-data.ts`) dan koneksi database (`db.ts`)
- `prisma`: skema database
- `public/images`: aset gambar (foto saat ini masih dummy berlisensi bebas dari Unsplash dan Pexels)
- `docs`: PRD dan dokumentasi project

## Menjalankan lokal

Buat file `.env` dari `.env.example` dan isi `DATABASE_URL` dengan koneksi PostgreSQL kamu, lalu:

```bash
npm install
npm run db:generate
npm run dev
```

Buka http://localhost:3000.

Script lain: `npm run db:push` untuk menyinkronkan skema ke database, `npm run typecheck` untuk cek tipe.
