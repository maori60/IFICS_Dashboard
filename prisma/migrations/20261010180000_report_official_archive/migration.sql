-- Index requis pour la cle etrangere composite
CREATE UNIQUE INDEX "ProjectReportVersion_id_reportId_version_key" ON "ProjectReportVersion"("id", "reportId", "version");

-- CreateTable
CREATE TABLE "ProjectReportArchive" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "reportVersionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "reference" VARCHAR(120) NOT NULL,
    "associationName" VARCHAR(255) NOT NULL,
    "projectTitle" VARCHAR(255) NOT NULL,
    "reportTitle" VARCHAR(255) NOT NULL,
    "intervenorName" VARCHAR(255),
    "sessionDate" TIMESTAMP(3) NOT NULL,
    "startTime" VARCHAR(5),
    "endTime" VARCHAR(5),
    "studentsCount" INTEGER,
    "content" TEXT NOT NULL,
    "validatedByUserId" TEXT,
    "validatedAt" TIMESTAMP(3) NOT NULL,
    "originalName" VARCHAR(255) NOT NULL,
    "storedName" VARCHAR(255) NOT NULL,
    "filePath" VARCHAR(500) NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
    "fileSize" BIGINT NOT NULL,
    "sha256" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectReportArchive_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectReportArchive_reference_key" ON "ProjectReportArchive"("reference");

-- CreateIndex
CREATE INDEX "ProjectReportArchive_validatedAt_idx" ON "ProjectReportArchive"("validatedAt");

-- CreateIndex
CREATE INDEX "ProjectReportArchive_sha256_idx" ON "ProjectReportArchive"("sha256");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectReportArchive_reportId_version_key" ON "ProjectReportArchive"("reportId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectReportArchive_reportVersionId_key" ON "ProjectReportArchive"("reportVersionId");

-- AddForeignKey
ALTER TABLE "ProjectReportArchive" ADD CONSTRAINT "ProjectReportArchive_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "ProjectReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectReportArchive" ADD CONSTRAINT "ProjectReportArchive_reportVersionId_reportId_version_fkey" FOREIGN KEY ("reportVersionId", "reportId", "version") REFERENCES "ProjectReportVersion"("id", "reportId", "version") ON DELETE RESTRICT ON UPDATE CASCADE;
