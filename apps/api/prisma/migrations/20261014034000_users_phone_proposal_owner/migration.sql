-- User contact fields for proposal employee block
ALTER TABLE "User" ADD COLUMN "phone" TEXT;
ALTER TABLE "User" ADD COLUMN "whatsapp" TEXT;

-- Proposal commercial owner
ALTER TABLE "Proposal" ADD COLUMN "ownerId" TEXT;

-- Backfill owner to admin (or first active user)
UPDATE "Proposal" p
SET "ownerId" = u.id
FROM (
  SELECT id FROM "User"
  WHERE active = true
  ORDER BY CASE WHEN role = 'ADMIN' THEN 0 ELSE 1 END, "createdAt" ASC
  LIMIT 1
) u
WHERE p."ownerId" IS NULL;

ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
