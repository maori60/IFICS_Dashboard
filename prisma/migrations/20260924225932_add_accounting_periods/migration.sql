-- CreateEnum
CREATE TYPE "AccountingFiscalYearStatus" AS ENUM ('OPEN', 'CLOSING', 'CLOSED');

-- CreateEnum
CREATE TYPE "AccountingPeriodStatus" AS ENUM ('OPEN', 'REVIEW', 'PRE_CLOSED', 'CLOSED');

-- CreateTable
CREATE TABLE "AccountingFiscalYear" (
    "id" TEXT NOT NULL,
    "associationId" TEXT NOT NULL,
    "label" VARCHAR(80) NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "AccountingFiscalYearStatus" NOT NULL DEFAULT 'OPEN',
    "closingStartedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "closedByUserId" TEXT,
    "reopenedAt" TIMESTAMP(3),
    "reopenedByUserId" TEXT,
    "reopenReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountingFiscalYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingPeriod" (
    "id" TEXT NOT NULL,
    "associationId" TEXT NOT NULL,
    "fiscalYearId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "label" VARCHAR(80) NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "AccountingPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "reviewStartedAt" TIMESTAMP(3),
    "reviewStartedByUserId" TEXT,
    "preClosedAt" TIMESTAMP(3),
    "preClosedByUserId" TEXT,
    "closedAt" TIMESTAMP(3),
    "closedByUserId" TEXT,
    "reopenedAt" TIMESTAMP(3),
    "reopenedByUserId" TEXT,
    "reopenReason" TEXT,
    "closureChecklist" JSONB,
    "lockVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountingPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccountingFiscalYear_associationId_idx" ON "AccountingFiscalYear"("associationId");

-- CreateIndex
CREATE INDEX "AccountingFiscalYear_associationId_status_idx" ON "AccountingFiscalYear"("associationId", "status");

-- CreateIndex
CREATE INDEX "AccountingFiscalYear_startDate_endDate_idx" ON "AccountingFiscalYear"("startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingFiscalYear_associationId_startDate_endDate_key" ON "AccountingFiscalYear"("associationId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "AccountingPeriod_associationId_idx" ON "AccountingPeriod"("associationId");

-- CreateIndex
CREATE INDEX "AccountingPeriod_associationId_status_idx" ON "AccountingPeriod"("associationId", "status");

-- CreateIndex
CREATE INDEX "AccountingPeriod_fiscalYearId_idx" ON "AccountingPeriod"("fiscalYearId");

-- CreateIndex
CREATE INDEX "AccountingPeriod_startDate_endDate_idx" ON "AccountingPeriod"("startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingPeriod_fiscalYearId_number_key" ON "AccountingPeriod"("fiscalYearId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingPeriod_fiscalYearId_startDate_endDate_key" ON "AccountingPeriod"("fiscalYearId", "startDate", "endDate");

-- AddForeignKey
ALTER TABLE "AccountingFiscalYear" ADD CONSTRAINT "AccountingFiscalYear_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "Association"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingPeriod" ADD CONSTRAINT "AccountingPeriod_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "Association"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingPeriod" ADD CONSTRAINT "AccountingPeriod_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "AccountingFiscalYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;
