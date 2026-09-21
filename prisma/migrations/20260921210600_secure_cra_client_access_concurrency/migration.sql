-- Un seul envoi email peut être en préparation
-- pour un document immuable et un purpose donnés.
CREATE UNIQUE INDEX
  "CraClientAccess_one_pending_per_document_purpose_key"
ON "CraClientAccess" ("documentId", "purpose")
WHERE "status" = 'PENDING';

-- Un seul lien utilisable peut être actif
-- pour un document immuable et un purpose donnés.
CREATE UNIQUE INDEX
  "CraClientAccess_one_active_per_document_purpose_key"
ON "CraClientAccess" ("documentId", "purpose")
WHERE "status" = 'ACTIVE';
