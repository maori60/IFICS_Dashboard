-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('FUEL', 'TOLL', 'PARKING', 'TRANSPORT', 'MEAL', 'ACCOMMODATION', 'INTERNET', 'PHONE', 'HARDWARE', 'SOFTWARE', 'PRINTING', 'SUPPLIES', 'TRAINING', 'INSURANCE', 'MILEAGE', 'BANK_FEES', 'PROFESSIONAL_SERVICE', 'OTHER');

-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ExpensePaymentMethod" AS ENUM ('CARD', 'BANK_TRANSFER', 'DIRECT_DEBIT', 'CASH', 'CHEQUE', 'PERSONAL_ADVANCE', 'OTHER');

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "associationId" TEXT NOT NULL,
    "projectId" TEXT,
    "intervenorId" TEXT,
    "createdByUserId" TEXT,
    "reviewedByUserId" TEXT,
    "category" "ExpenseCategory" NOT NULL,
    "status" "ExpenseStatus" NOT NULL DEFAULT 'DRAFT',
    "expenseDate" TIMESTAMP(3) NOT NULL,
    "supplierName" VARCHAR(255),
    "description" TEXT NOT NULL,
    "reference" VARCHAR(120),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'EUR',
    "amountExclTax" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "amountInclTax" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paymentMethod" "ExpensePaymentMethod",
    "reimbursable" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseAttachment" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "uploadedByUserId" TEXT,
    "originalName" VARCHAR(255) NOT NULL,
    "storedName" VARCHAR(255) NOT NULL,
    "filePath" VARCHAR(500) NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "fileSize" BIGINT NOT NULL,
    "sha256" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Expense_associationId_idx" ON "Expense"("associationId");

-- CreateIndex
CREATE INDEX "Expense_associationId_expenseDate_idx" ON "Expense"("associationId", "expenseDate");

-- CreateIndex
CREATE INDEX "Expense_associationId_status_idx" ON "Expense"("associationId", "status");

-- CreateIndex
CREATE INDEX "Expense_associationId_category_idx" ON "Expense"("associationId", "category");

-- CreateIndex
CREATE INDEX "Expense_projectId_idx" ON "Expense"("projectId");

-- CreateIndex
CREATE INDEX "Expense_intervenorId_idx" ON "Expense"("intervenorId");

-- CreateIndex
CREATE INDEX "Expense_createdByUserId_idx" ON "Expense"("createdByUserId");

-- CreateIndex
CREATE INDEX "Expense_reviewedByUserId_idx" ON "Expense"("reviewedByUserId");

-- CreateIndex
CREATE INDEX "Expense_archivedAt_idx" ON "Expense"("archivedAt");

-- CreateIndex
CREATE INDEX "ExpenseAttachment_expenseId_idx" ON "ExpenseAttachment"("expenseId");

-- CreateIndex
CREATE INDEX "ExpenseAttachment_uploadedByUserId_idx" ON "ExpenseAttachment"("uploadedByUserId");

-- CreateIndex
CREATE INDEX "ExpenseAttachment_sha256_idx" ON "ExpenseAttachment"("sha256");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "Association"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_intervenorId_fkey" FOREIGN KEY ("intervenorId") REFERENCES "Intervenor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseAttachment" ADD CONSTRAINT "ExpenseAttachment_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseAttachment" ADD CONSTRAINT "ExpenseAttachment_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
