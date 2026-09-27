-- CreateEnum
CREATE TYPE "ExpenseTaxDeductibility" AS ENUM ('PENDING', 'DEDUCTIBLE', 'NON_DEDUCTIBLE');

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "deductibleTaxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "taxDeductibility" "ExpenseTaxDeductibility" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "taxReviewNote" TEXT,
ADD COLUMN     "taxReviewedAt" TIMESTAMP(3),
ADD COLUMN     "taxReviewedByUserId" TEXT;

-- CreateIndex
CREATE INDEX "Expense_taxReviewedByUserId_idx" ON "Expense"("taxReviewedByUserId");

-- CreateIndex
CREATE INDEX "Expense_associationId_taxDeductibility_idx" ON "Expense"("associationId", "taxDeductibility");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_taxReviewedByUserId_fkey" FOREIGN KEY ("taxReviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
