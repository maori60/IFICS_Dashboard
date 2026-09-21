-- CreateEnum
CREATE TYPE "CraClientDecisionType" AS ENUM ('ACCEPTED', 'REFUSED');

-- AlterEnum
ALTER TYPE "CraDocumentType" ADD VALUE 'CLIENT_ATTESTED';

-- CreateTable
CREATE TABLE "CraClientDecision" (
    "id" TEXT NOT NULL,
    "accessId" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "decision" "CraClientDecisionType" NOT NULL,
    "firstName" VARCHAR(120) NOT NULL,
    "lastName" VARCHAR(120) NOT NULL,
    "jobTitle" VARCHAR(180) NOT NULL,
    "comment" VARCHAR(2000),
    "recipientEmail" VARCHAR(320) NOT NULL,
    "organizationName" VARCHAR(255) NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceDocumentId" TEXT NOT NULL,
    "sourceDocumentReference" VARCHAR(80) NOT NULL,
    "sourceDocumentSha256" VARCHAR(64) NOT NULL,
    "attestedDocumentId" TEXT NOT NULL,

    CONSTRAINT "CraClientDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CraClientDecision_reportId_decidedAt_idx" ON "CraClientDecision"("reportId", "decidedAt");

-- CreateIndex
CREATE INDEX "CraClientDecision_sourceDocumentId_idx" ON "CraClientDecision"("sourceDocumentId");

-- CreateIndex
CREATE INDEX "CraClientDecision_recipientEmail_idx" ON "CraClientDecision"("recipientEmail");

-- CreateIndex
CREATE INDEX "CraClientDecision_decision_idx" ON "CraClientDecision"("decision");

-- CreateIndex
CREATE UNIQUE INDEX "CraClientDecision_accessId_reportId_key" ON "CraClientDecision"("accessId", "reportId");

-- CreateIndex
CREATE UNIQUE INDEX "CraClientDecision_attestedDocumentId_reportId_key" ON "CraClientDecision"("attestedDocumentId", "reportId");

-- CreateIndex
CREATE UNIQUE INDEX "CraClientAccess_id_reportId_key" ON "CraClientAccess"("id", "reportId");

-- AddForeignKey
ALTER TABLE "CraClientDecision" ADD CONSTRAINT "CraClientDecision_accessId_reportId_fkey" FOREIGN KEY ("accessId", "reportId") REFERENCES "CraClientAccess"("id", "reportId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CraClientDecision" ADD CONSTRAINT "CraClientDecision_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "CraReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CraClientDecision" ADD CONSTRAINT "CraClientDecision_sourceDocumentId_reportId_fkey" FOREIGN KEY ("sourceDocumentId", "reportId") REFERENCES "CraDocument"("id", "reportId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CraClientDecision" ADD CONSTRAINT "CraClientDecision_attestedDocumentId_reportId_fkey" FOREIGN KEY ("attestedDocumentId", "reportId") REFERENCES "CraDocument"("id", "reportId") ON DELETE RESTRICT ON UPDATE CASCADE;

