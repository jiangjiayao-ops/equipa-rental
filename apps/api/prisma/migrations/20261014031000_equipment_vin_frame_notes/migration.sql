-- AlterTable Equipment: VIN, frame, notes (year already existed)
ALTER TABLE "Equipment" ADD COLUMN "vin" TEXT;
ALTER TABLE "Equipment" ADD COLUMN "frameNumber" TEXT;
ALTER TABLE "Equipment" ADD COLUMN "notes" TEXT;
