-- Penanda iklan di order: diisi dari tautan pendaftaran (?ref=IGB1 atau utm_campaign) (8 Okt 2026). Hanya menambah kolom.
BEGIN;
SET ROLE kuwera_owner;
-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "adRef" TEXT;

RESET ROLE;
COMMIT;
