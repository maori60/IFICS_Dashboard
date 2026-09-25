-- Enregistrements de règlements clients indépendants du statut de la facture.
CREATE TYPE "BillingPaymentMethod" AS ENUM (
  'BANK_TRANSFER',
  'CARD',
  'DIRECT_DEBIT',
  'CASH',
  'CHEQUE',
  'OTHER'
);

CREATE TABLE "BillingPayment" (
  "id" TEXT NOT NULL,
  "associationId" TEXT NOT NULL,
  "billingDocumentId" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'EUR',
  "paidAt" TIMESTAMP(3) NOT NULL,
  "method" "BillingPaymentMethod" NOT NULL,
  "reference" VARCHAR(120),
  "note" TEXT,
  "recordedByUserId" TEXT,
  "reversedAt" TIMESTAMP(3),
  "reversedByUserId" TEXT,
  "reversalReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BillingPayment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BillingPayment_associationId_paidAt_idx"
  ON "BillingPayment"("associationId", "paidAt");
CREATE INDEX "BillingPayment_billingDocumentId_paidAt_idx"
  ON "BillingPayment"("billingDocumentId", "paidAt");
CREATE INDEX "BillingPayment_recordedByUserId_idx"
  ON "BillingPayment"("recordedByUserId");
CREATE INDEX "BillingPayment_reversedByUserId_idx"
  ON "BillingPayment"("reversedByUserId");
CREATE INDEX "BillingPayment_reversedAt_idx"
  ON "BillingPayment"("reversedAt");

ALTER TABLE "BillingPayment"
  ADD CONSTRAINT "BillingPayment_associationId_fkey"
  FOREIGN KEY ("associationId") REFERENCES "Association"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BillingPayment"
  ADD CONSTRAINT "BillingPayment_billingDocumentId_fkey"
  FOREIGN KEY ("billingDocumentId") REFERENCES "BillingDocument"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BillingPayment"
  ADD CONSTRAINT "BillingPayment_recordedByUserId_fkey"
  FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BillingPayment" ADD CONSTRAINT "BillingPayment_reversedByUserId_fkey" FOREIGN KEY ("reversedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
