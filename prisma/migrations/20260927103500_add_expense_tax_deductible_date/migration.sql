-- AlterTable
ALTER TABLE "Expense"
ADD COLUMN "taxDeductibleDate" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Expense_associationId_taxDeductibleDate_idx"
ON "Expense"("associationId", "taxDeductibleDate");
