-- CreateEnum
ALTER TYPE "ProposalStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TYPE "EquipmentStatus" ADD VALUE IF NOT EXISTS 'UNAVAILABLE';

-- AlterTable User
ALTER TABLE "User" ADD COLUMN "isMasterAdmin" BOOLEAN NOT NULL DEFAULT false;

-- Seed master flag on platform owner only
UPDATE "User" SET "isMasterAdmin" = true WHERE email = 'admin@equipa.com.br';

-- Soft-delete columns
ALTER TABLE "Customer" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Equipment" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Proposal" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Contract" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- AuditLog
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityLabel" TEXT,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
