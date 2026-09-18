-- CreateEnum
CREATE TYPE "CraStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'CLIENT_PENDING', 'VALIDATED', 'REFUSED');

-- CreateTable
CREATE TABLE "CraReport" (
    "id" TEXT NOT NULL,
    "associationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "intervenorId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" "CraStatus" NOT NULL DEFAULT 'DRAFT',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "submittedAt" TIMESTAMP(3),
    "validatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CraReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CraDay" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "intervenorId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "comment" VARCHAR(2000),
    "hasIncident" BOOLEAN NOT NULL DEFAULT false,
    "incident" VARCHAR(5000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CraDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CraReport_associationId_year_month_status_idx" ON "CraReport"("associationId", "year", "month", "status");

-- CreateIndex
CREATE INDEX "CraReport_intervenorId_year_month_idx" ON "CraReport"("intervenorId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "CraReport_projectId_intervenorId_year_month_key" ON "CraReport"("projectId", "intervenorId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "CraReport_id_intervenorId_key" ON "CraReport"("id", "intervenorId");

-- CreateIndex
CREATE INDEX "CraDay_reportId_date_idx" ON "CraDay"("reportId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "CraDay_intervenorId_date_key" ON "CraDay"("intervenorId", "date");

-- AddForeignKey
ALTER TABLE "CraReport" ADD CONSTRAINT "CraReport_projectId_intervenorId_fkey" FOREIGN KEY ("projectId", "intervenorId") REFERENCES "ProjectIntervenor"("projectId", "intervenorId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CraDay" ADD CONSTRAINT "CraDay_reportId_intervenorId_fkey" FOREIGN KEY ("reportId", "intervenorId") REFERENCES "CraReport"("id", "intervenorId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Validate report period and revision
ALTER TABLE "CraReport"
ADD CONSTRAINT "CraReport_month_check"
CHECK ("month" BETWEEN 1 AND 12);

ALTER TABLE "CraReport"
ADD CONSTRAINT "CraReport_revision_check"
CHECK ("revision" >= 1);

-- Require a meaningful description when an incident is reported
ALTER TABLE "CraDay"
ADD CONSTRAINT "CraDay_incident_check"
CHECK (
    NOT "hasIncident"
    OR (
        "incident" IS NOT NULL
        AND "incident" ~ '[^[:space:]]'
    )
);
