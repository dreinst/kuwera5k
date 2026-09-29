-- Penanda data uji pada order (29 Sep 2026). Hanya menambah kolom; KWR-2026-UJI001 ditandai sebagai data uji.
BEGIN;
SET ROLE kuwera_owner;
-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "isTest" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Order" SET "isTest" = true WHERE id = 'KWR-2026-UJI001';
RESET ROLE;
COMMIT;
