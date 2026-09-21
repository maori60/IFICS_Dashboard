ALTER TABLE "CraDocument"
ADD COLUMN "sourceDocumentId" TEXT;

CREATE INDEX "CraDocument_sourceDocumentId_idx"
ON "CraDocument"("sourceDocumentId");

ALTER TABLE "CraDocument"
ADD CONSTRAINT "CraDocument_sourceDocumentId_fkey"
FOREIGN KEY ("sourceDocumentId")
REFERENCES "CraDocument"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;
