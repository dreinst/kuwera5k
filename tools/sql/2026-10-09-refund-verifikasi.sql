-- Verifikasi berlapis refund (9 Okt 2026): pengaju wajib mengetik nomor WhatsApp dan email saat mendaftar.
-- Pengajuan yang masuk sebelum aturan ini tetap false, jadi tidak bisa ditandai selesai sebelum dikirim ulang.
BEGIN;
SET ROLE kuwera_owner;
-- AlterTable
ALTER TABLE "RefundRequest" ADD COLUMN     "verified" BOOLEAN NOT NULL DEFAULT false;

RESET ROLE;
COMMIT;
