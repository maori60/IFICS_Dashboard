-- Ajout des rôles métier des clients d'un projet.
ALTER TABLE "ProjectClient"
ADD COLUMN "isContractualClient" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "isEndClient" BOOLEAN NOT NULL DEFAULT false;

-- Compatibilité avec les projets existants :
-- l'ancien client principal devient à la fois
-- client contractuel/facturé et client final/validateur.
UPDATE "ProjectClient"
SET
  "isContractualClient" = true,
  "isEndClient" = true
WHERE "isMainClient" = true;

-- Un projet ne peut avoir qu'un seul client contractuel.
CREATE UNIQUE INDEX
  "ProjectClient_one_contractual_client_per_project_key"
ON "ProjectClient" ("projectId")
WHERE "isContractualClient" = true;

-- Un projet ne peut avoir qu'un seul client final.
CREATE UNIQUE INDEX
  "ProjectClient_one_end_client_per_project_key"
ON "ProjectClient" ("projectId")
WHERE "isEndClient" = true;
