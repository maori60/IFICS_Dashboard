-- Nature métier d'un projet IFICS.
CREATE TYPE "ProjectType" AS ENUM (
  'ASSOCIATIVE_ACTION',
  'COMMERCIAL_SERVICE'
);

ALTER TABLE "Project"
ADD COLUMN "type" "ProjectType"
NOT NULL
DEFAULT 'ASSOCIATIVE_ACTION';

-- Les projets qui possèdent déjà au moins un CRA
-- correspondent aux missions commerciales existantes.
UPDATE "Project" p
SET "type" = 'COMMERCIAL_SERVICE'
WHERE EXISTS (
  SELECT 1
  FROM "CraReport" cr
  WHERE cr."projectId" = p.id
);

CREATE INDEX "Project_associationId_type_idx"
ON "Project" ("associationId", "type");
