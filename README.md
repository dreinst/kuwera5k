# KUWERA 5K

Website resmi event lari KUWERA 5K. Dibangun dengan pola yang sama seperti DriveTech (Next.js + Supabase), ditambah fitur payment gateway untuk pendaftaran peserta.

Status: draft awal, belum ada brainstorming fitur/konten.

## Struktur folder

- `src/app` — routing dan halaman (Next.js App Router)
- `src/components` — komponen UI
- `src/lib` — helper, integrasi (Supabase, payment gateway, dll)
- `src/types` — tipe TypeScript
- `supabase/migrations` — skema database
- `public/images` — aset gambar
- `docs` — dokumentasi project (brainstorming, PRD, dll)

## Menjalankan lokal

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000).
