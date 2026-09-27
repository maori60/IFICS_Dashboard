CREATE TYPE "VatLiabilityStatus" AS ENUM (
  'NOT_CONFIGURED',
  'SUBJECT',
  'NOT_SUBJECT'
);

CREATE TYPE "VatCollectionBasis" AS ENUM (
  'NOT_CONFIGURED',
  'DEBITS',
  'COLLECTIONS'
);

CREATE TYPE "VatFilingFrequency" AS ENUM (
  'NOT_CONFIGURED',
  'MONTHLY',
  'QUARTERLY',
  'ANNUAL'
);

ALTER TABLE "AssociationFinanceSettings"
ADD COLUMN "vatLiabilityStatus" "VatLiabilityStatus"
  NOT NULL DEFAULT 'NOT_CONFIGURED',
ADD COLUMN "vatCollectionBasis" "VatCollectionBasis"
  NOT NULL DEFAULT 'NOT_CONFIGURED',
ADD COLUMN "vatFilingFrequency" "VatFilingFrequency"
  NOT NULL DEFAULT 'NOT_CONFIGURED',
ADD COLUMN "vatEffectiveFrom" TIMESTAMP(3);
