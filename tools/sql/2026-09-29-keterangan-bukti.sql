-- Keterangan pada bukti bayar (29 Sep 2026). Hanya menambah kolom, lalu mengisi keterangan bukti pembeli KWR-2026-ZNSRJQ.
BEGIN;
SET ROLE kuwera_owner;
-- AlterTable
ALTER TABLE "PaymentProof" ADD COLUMN     "note" TEXT;

UPDATE "PaymentProof" SET note = 'Bukti bayar pembeli: Rp112.516 (terpotong diskon kode KUWERA10 Rp12.500)' WHERE "orderId" = 'KWR-2026-ZNSRJQ' AND note IS NULL;
RESET ROLE;
COMMIT;
