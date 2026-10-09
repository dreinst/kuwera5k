-- Koreksi data tiket dari pemesan di formulir refund (9 Okt 2026). Hanya menambah satu kolom.
BEGIN;
SET ROLE kuwera_owner;
-- AlterTable
ALTER TABLE "RefundRequest" ADD COLUMN     "dataNote" TEXT;

RESET ROLE;
COMMIT;
