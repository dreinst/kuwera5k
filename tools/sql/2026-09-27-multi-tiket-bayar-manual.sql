-- Multi tiket per order + bayar manual QRIS (27 Sep 2026). Hanya menambah kolom/index, tidak menghapus data.
BEGIN;
-- DropIndex
DROP INDEX "Participant_orderId_key";

-- DropIndex
DROP INDEX "Ticket_orderId_key";

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "adminNotifiedAt" TIMESTAMP(3),
ADD COLUMN     "quantity" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "uniqueCode" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "waNotifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Participant" ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "participantId" TEXT;

-- CreateIndex
CREATE INDEX "Participant_idNumber_idx" ON "Participant"("idNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Participant_orderId_position_key" ON "Participant"("orderId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_participantId_key" ON "Ticket"("participantId");

-- CreateIndex
CREATE INDEX "Ticket_orderId_idx" ON "Ticket"("orderId");

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Tiket lama (satu per order) dihubungkan ke peserta order itu.
UPDATE "Ticket" t SET "participantId" = p.id FROM "Participant" p WHERE p."orderId" = t."orderId" AND t."participantId" IS NULL;
COMMIT;
