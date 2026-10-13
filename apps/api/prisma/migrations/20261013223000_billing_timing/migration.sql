-- CreateEnum
CREATE TYPE "BillingTiming" AS ENUM ('ADVANCE', 'ARREARS');

-- AlterTable Proposal
ALTER TABLE "Proposal" ADD COLUMN "billingTiming" "BillingTiming" NOT NULL DEFAULT 'ADVANCE';

-- AlterTable Contract
ALTER TABLE "Contract" ADD COLUMN "billingTiming" "BillingTiming" NOT NULL DEFAULT 'ADVANCE';

-- AlterTable Invoice
ALTER TABLE "Invoice" ADD COLUMN "billingTiming" "BillingTiming";
ALTER TABLE "Invoice" ADD COLUMN "periodStart" TIMESTAMP(3);
ALTER TABLE "Invoice" ADD COLUMN "periodEnd" TIMESTAMP(3);
