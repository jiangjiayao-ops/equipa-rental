-- CreateEnum
CREATE TYPE "ProposalSendChannel" AS ENUM ('EMAIL', 'WHATSAPP');
CREATE TYPE "ProposalSendStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'DEV_OUTBOX');

-- AlterTable Proposal
ALTER TABLE "Proposal" ADD COLUMN "publicToken" TEXT;
ALTER TABLE "Proposal" ADD COLUMN "acceptedOptionId" TEXT;
ALTER TABLE "Proposal" ADD COLUMN "sentAt" TIMESTAMP(3);
ALTER TABLE "Proposal" ADD COLUMN "acceptedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Proposal_publicToken_key" ON "Proposal"("publicToken");

-- CreateTable ProposalOption
CREATE TABLE "ProposalOption" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "billingPeriod" "BillingPeriod" NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "unitRate" DOUBLE PRECISION NOT NULL,
    "mobFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "demobFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "selected" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ProposalOption_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ProposalOption" ADD CONSTRAINT "ProposalOption_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable ProposalSendAttempt
CREATE TABLE "ProposalSendAttempt" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "channel" "ProposalSendChannel" NOT NULL,
    "status" "ProposalSendStatus" NOT NULL,
    "toAddress" TEXT,
    "provider" TEXT NOT NULL,
    "providerRef" TEXT,
    "error" TEXT,
    "publicUrl" TEXT,
    "payloadJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProposalSendAttempt_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ProposalSendAttempt" ADD CONSTRAINT "ProposalSendAttempt_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- FK acceptedOption (nullable, set after options exist)
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_acceptedOptionId_fkey" FOREIGN KEY ("acceptedOptionId") REFERENCES "ProposalOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable ProposalLine unitRate default
ALTER TABLE "ProposalLine" ALTER COLUMN "unitRate" SET DEFAULT 0;
