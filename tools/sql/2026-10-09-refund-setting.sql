-- Menyalakan halaman refund (dijalankan saat pembatalan diumumkan). Kunci tautan dibuat sekali dan tidak ditimpa
-- kalau baris sudah ada. "nominal" berisi order yang dikembalikan tidak sebesar totalnya:
-- KWR-2026-ZNSRJQ membayar Rp112.516 (kode KUWERA10 terpakai karena kesalahan sistem), kekurangan Rp12.500 ditutup
-- superadmin, jadi yang kembali ke pemesan Rp112.516 (keputusan owner 9 Okt 2026).
INSERT INTO "Setting" (key, value, "updatedAt")
VALUES ('refund', jsonb_build_object(
          'aktif', true,
          'diumumkan', to_char(timezone('UTC', now()), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
          'kunci', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
          'nominal', jsonb_build_object('KWR-2026-ZNSRJQ', 112516)),
        timezone('UTC', now()))
ON CONFLICT (key) DO NOTHING;
