-- Management workflow extensions for tickets, association finance settings,
-- IT asset documents, positions and HR contract generation.
-- This migration is additive: no existing table or column is dropped or rewritten.

CREATE TYPE "AssetDocumentType" AS ENUM (
  'PURCHASE_INVOICE',
  'WARRANTY',
  'RECEIPT',
  'MANUAL',
  'CERTIFICATE',
  'PHOTO',
  'OTHER'
);

CREATE TYPE "HrContractType" AS ENUM (
  'CDI',
  'CDD',
  'STAGE',
  'ALTERNANCE',
  'APPRENTISSAGE',
  'PROFESSIONNALISATION',
  'VOLONTARIAT',
  'OTHER'
);

CREATE TYPE "HrContractStatus" AS ENUM (
  'DRAFT',
  'GENERATED',
  'SIGNED',
  'CANCELLED',
  'ARCHIVED'
);

CREATE TABLE "AssociationFinanceSettings" (
  "id" TEXT NOT NULL,
  "associationId" TEXT NOT NULL,
  "legalForm" VARCHAR(100),
  "rnaNumber" VARCHAR(40),
  "vatNumber" VARCHAR(40),
  "bankName" VARCHAR(150),
  "bankAccountHolder" VARCHAR(200),
  "iban" VARCHAR(34),
  "bic" VARCHAR(11),
  "paymentTerms" TEXT,
  "taxExemptionText" TEXT,
  "logoFilePath" VARCHAR(500),
  "maxAssetDocuments" INTEGER NOT NULL DEFAULT 20,
  "maxAssetDocumentMb" INTEGER NOT NULL DEFAULT 10,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AssociationFinanceSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TicketProgress" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "progressPercent" INTEGER NOT NULL DEFAULT 0,
  "nextAction" TEXT,
  "resolutionSummary" TEXT,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TicketProgress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssetDocument" (
  "id" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "uploadedByUserId" TEXT,
  "type" "AssetDocumentType" NOT NULL DEFAULT 'OTHER',
  "title" VARCHAR(255),
  "originalName" VARCHAR(255) NOT NULL,
  "storedName" VARCHAR(255) NOT NULL,
  "filePath" VARCHAR(500) NOT NULL,
  "mimeType" VARCHAR(100) NOT NULL,
  "fileSize" BIGINT NOT NULL,
  "sha256" VARCHAR(64),
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AssetDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JobPosition" (
  "id" TEXT NOT NULL,
  "associationId" TEXT NOT NULL,
  "code" VARCHAR(60) NOT NULL,
  "title" VARCHAR(180) NOT NULL,
  "departmentId" TEXT,
  "description" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "JobPosition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContractTemplate" (
  "id" TEXT NOT NULL,
  "associationId" TEXT NOT NULL,
  "contractType" "HrContractType" NOT NULL,
  "name" VARCHAR(180) NOT NULL,
  "content" TEXT NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContractTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HrEmploymentDetail" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "positionId" TEXT,
  "contractType" "HrContractType" NOT NULL,
  "workLocation" VARCHAR(200),
  "weeklyHours" DECIMAL(6,2),
  "grossMonthlySalary" DECIMAL(12,2),
  "probationPeriod" VARCHAR(180),
  "contractReference" VARCHAR(100),
  "additionalConditions" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HrEmploymentDetail_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HrContract" (
  "id" TEXT NOT NULL,
  "associationId" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "templateId" TEXT,
  "contractType" "HrContractType" NOT NULL,
  "status" "HrContractStatus" NOT NULL DEFAULT 'DRAFT',
  "title" VARCHAR(255) NOT NULL,
  "contentSnapshot" TEXT NOT NULL,
  "pdfPath" VARCHAR(500),
  "createdByUserId" TEXT,
  "generatedAt" TIMESTAMP(3),
  "signedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HrContract_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AssociationFinanceSettings_associationId_key" ON "AssociationFinanceSettings"("associationId");
CREATE INDEX "AssociationFinanceSettings_associationId_idx" ON "AssociationFinanceSettings"("associationId");

CREATE UNIQUE INDEX "TicketProgress_ticketId_key" ON "TicketProgress"("ticketId");
CREATE INDEX "TicketProgress_ticketId_idx" ON "TicketProgress"("ticketId");
CREATE INDEX "TicketProgress_updatedByUserId_idx" ON "TicketProgress"("updatedByUserId");

CREATE INDEX "AssetDocument_assetId_archivedAt_idx" ON "AssetDocument"("assetId", "archivedAt");
CREATE INDEX "AssetDocument_type_idx" ON "AssetDocument"("type");
CREATE INDEX "AssetDocument_sha256_idx" ON "AssetDocument"("sha256");
CREATE INDEX "AssetDocument_uploadedByUserId_idx" ON "AssetDocument"("uploadedByUserId");

CREATE UNIQUE INDEX "JobPosition_associationId_code_key" ON "JobPosition"("associationId", "code");
CREATE INDEX "JobPosition_associationId_active_idx" ON "JobPosition"("associationId", "active");
CREATE INDEX "JobPosition_departmentId_idx" ON "JobPosition"("departmentId");

CREATE UNIQUE INDEX "ContractTemplate_associationId_contractType_name_key" ON "ContractTemplate"("associationId", "contractType", "name");
CREATE INDEX "ContractTemplate_associationId_contractType_active_idx" ON "ContractTemplate"("associationId", "contractType", "active");
CREATE INDEX "ContractTemplate_associationId_isDefault_idx" ON "ContractTemplate"("associationId", "isDefault");

CREATE UNIQUE INDEX "HrEmploymentDetail_profileId_key" ON "HrEmploymentDetail"("profileId");
CREATE INDEX "HrEmploymentDetail_positionId_idx" ON "HrEmploymentDetail"("positionId");
CREATE INDEX "HrEmploymentDetail_contractType_idx" ON "HrEmploymentDetail"("contractType");

CREATE INDEX "HrContract_associationId_status_idx" ON "HrContract"("associationId", "status");
CREATE INDEX "HrContract_profileId_createdAt_idx" ON "HrContract"("profileId", "createdAt");
CREATE INDEX "HrContract_templateId_idx" ON "HrContract"("templateId");
CREATE INDEX "HrContract_createdByUserId_idx" ON "HrContract"("createdByUserId");
