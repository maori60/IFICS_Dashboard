-- Autoriser plusieurs bilans pour un même projet,
-- un même intervenant et une même date.

ALTER TABLE "ProjectReport"
  ADD COLUMN "startTime" VARCHAR(5),
  ADD COLUMN "endTime" VARCHAR(5);

DROP INDEX "ProjectReport_projectId_intervenorId_sessionDate_key";

CREATE INDEX "ProjectReport_projectId_sessionDate_idx"
  ON "ProjectReport"("projectId", "sessionDate");
