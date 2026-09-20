-- CreateEnum
CREATE TYPE "CraDayType" AS ENUM ('WORK', 'PAID_LEAVE', 'RTT', 'SICK_LEAVE', 'AUTHORIZED_ABSENCE', 'UNJUSTIFIED_ABSENCE', 'TRAINING', 'PUBLIC_HOLIDAY', 'OTHER');

-- CreateEnum
CREATE TYPE "CraDocumentType" AS ENUM ('IFICS_TO_SIGN', 'INTERVENOR_SIGNED');

-- CreateEnum
CREATE TYPE "CraDocumentStatus" AS ENUM ('GENERATED', 'SENT_TO_INTERVENOR', 'RECEIVED', 'APPROVED', 'REJECTED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "CraAntivirusStatus" AS ENUM ('PENDING', 'CLEAN', 'INFECTED', 'ERROR', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "CraClientAccessPurpose" AS ENUM ('INITIAL_CONFIRMATION', 'REDOWNLOAD');

-- CreateEnum
CREATE TYPE "CraClientAccessStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'EXPIRED', 'REVOKED');

-- AlterTable
ALTER TABLE "CraDay" ADD COLUMN     "dayType" "CraDayType" NOT NULL DEFAULT 'WORK',
ADD COLUMN     "durationMinutes" INTEGER NOT NULL DEFAULT 420;

-- CreateTable
CREATE TABLE "CraDocument" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "type" "CraDocumentType" NOT NULL,
    "status" "CraDocumentStatus" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "reportRevision" INTEGER NOT NULL,
    "reference" VARCHAR(80) NOT NULL,
    "originalName" VARCHAR(255) NOT NULL,
    "storedName" VARCHAR(255) NOT NULL,
    "filePath" VARCHAR(500) NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "fileSize" BIGINT NOT NULL,
    "sha256" VARCHAR(64),
    "generatedByUserId" TEXT,
    "uploadedByUserId" TEXT,
    "reviewedByUserId" TEXT,
    "sentToIntervenorAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" VARCHAR(2000),
    "antivirusStatus" "CraAntivirusStatus" NOT NULL DEFAULT 'PENDING',
    "antivirusCheckedAt" TIMESTAMP(3),
    "antivirusResult" VARCHAR(255),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CraDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CraClientAccess" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "purpose" "CraClientAccessPurpose" NOT NULL,
    "status" "CraClientAccessStatus" NOT NULL DEFAULT 'ACTIVE',
    "tokenHash" VARCHAR(64) NOT NULL,
    "recipientEmail" VARCHAR(320) NOT NULL,
    "createdByUserId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "firstViewedAt" TIMESTAMP(3),
    "downloadedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "emailSentAt" TIMESTAMP(3),
    "emailMessageId" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CraClientAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CraDocument_reference_key" ON "CraDocument"("reference");

-- CreateIndex
CREATE INDEX "CraDocument_reportId_status_idx" ON "CraDocument"("reportId", "status");

-- CreateIndex
CREATE INDEX "CraDocument_reportId_type_idx" ON "CraDocument"("reportId", "type");

-- CreateIndex
CREATE INDEX "CraDocument_status_idx" ON "CraDocument"("status");

-- CreateIndex
CREATE INDEX "CraDocument_antivirusStatus_idx" ON "CraDocument"("antivirusStatus");

-- CreateIndex
CREATE INDEX "CraDocument_sha256_idx" ON "CraDocument"("sha256");

-- CreateIndex
CREATE INDEX "CraDocument_archivedAt_idx" ON "CraDocument"("archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CraDocument_reportId_type_version_key" ON "CraDocument"("reportId", "type", "version");

-- CreateIndex
CREATE UNIQUE INDEX "CraClientAccess_tokenHash_key" ON "CraClientAccess"("tokenHash");

-- CreateIndex
CREATE INDEX "CraClientAccess_reportId_status_idx" ON "CraClientAccess"("reportId", "status");

-- CreateIndex
CREATE INDEX "CraClientAccess_documentId_idx" ON "CraClientAccess"("documentId");

-- CreateIndex
CREATE INDEX "CraClientAccess_recipientEmail_idx" ON "CraClientAccess"("recipientEmail");

-- CreateIndex
CREATE INDEX "CraClientAccess_expiresAt_idx" ON "CraClientAccess"("expiresAt");

-- CreateIndex
CREATE INDEX "CraClientAccess_purpose_status_idx" ON "CraClientAccess"("purpose", "status");

-- CreateIndex
CREATE INDEX "CraDay_reportId_dayType_idx" ON "CraDay"("reportId", "dayType");

-- AddForeignKey
ALTER TABLE "CraDocument" ADD CONSTRAINT "CraDocument_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "CraReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CraClientAccess" ADD CONSTRAINT "CraClientAccess_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "CraReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CraClientAccess" ADD CONSTRAINT "CraClientAccess_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "CraDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
