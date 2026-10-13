-- Organization tax / contact profile
ALTER TABLE "Organization" ADD COLUMN "ie" TEXT;
ALTER TABLE "Organization" ADD COLUMN "im" TEXT;
ALTER TABLE "Organization" ADD COLUMN "street" TEXT;
ALTER TABLE "Organization" ADD COLUMN "city" TEXT;
ALTER TABLE "Organization" ADD COLUMN "state" TEXT;
ALTER TABLE "Organization" ADD COLUMN "cep" TEXT;
ALTER TABLE "Organization" ADD COLUMN "phone" TEXT;
ALTER TABLE "Organization" ADD COLUMN "email" TEXT;

-- Branch tax / contact (per-filial)
ALTER TABLE "Branch" ADD COLUMN "legalName" TEXT;
ALTER TABLE "Branch" ADD COLUMN "tradeName" TEXT;
ALTER TABLE "Branch" ADD COLUMN "cnpj" TEXT;
ALTER TABLE "Branch" ADD COLUMN "ie" TEXT;
ALTER TABLE "Branch" ADD COLUMN "im" TEXT;
ALTER TABLE "Branch" ADD COLUMN "street" TEXT;
ALTER TABLE "Branch" ADD COLUMN "cep" TEXT;
ALTER TABLE "Branch" ADD COLUMN "phone" TEXT;
ALTER TABLE "Branch" ADD COLUMN "email" TEXT;
