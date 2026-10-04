-- Asal order: web atau kudam (anggota Kudam diinput superadmin, harga tetap, tanpa kode unik) (30 Sep 2026). Hanya menambah kolom.
BEGIN;
SET ROLE kuwera_owner;
-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'web';

RESET ROLE;
COMMIT;
