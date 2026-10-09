-- Refund pembatalan acara (9 Okt 2026). Hanya menambah satu kolom dan satu tabel, tidak mengubah data yang ada.
-- Baris Setting "refund" (saklar halaman refund, tanggal pengumuman, kunci tautan, nominal khusus) diisi terpisah
-- saat pengumuman, lihat tools/sql/2026-10-09-refund-setting.sql.
BEGIN;
SET ROLE kuwera_owner;
-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "refundLinkAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "RefundRequest" (
    "orderId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DIAJUKAN',
    "note" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transferredAt" TIMESTAMP(3),
    "processedBy" TEXT,
    "proofName" TEXT,
    "proofMime" TEXT,
    "proofData" BYTEA,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RefundRequest_pkey" PRIMARY KEY ("orderId")
);

-- AddForeignKey
ALTER TABLE "RefundRequest" ADD CONSTRAINT "RefundRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE ON "RefundRequest" TO kuwera_app;
RESET ROLE;
COMMIT;
