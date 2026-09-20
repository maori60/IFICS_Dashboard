/*
  Warnings:

  - A unique constraint covering the columns `[id,reportId]` on the table `CraDocument` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "CraClientAccess" DROP CONSTRAINT "CraClientAccess_documentId_fkey";

-- DropForeignKey
ALTER TABLE "CraClientAccess" DROP CONSTRAINT "CraClientAccess_reportId_fkey";

-- CreateIndex
CREATE UNIQUE INDEX "CraDocument_id_reportId_key" ON "CraDocument"("id", "reportId");

-- AddForeignKey
ALTER TABLE "CraClientAccess" ADD CONSTRAINT "CraClientAccess_documentId_reportId_fkey" FOREIGN KEY ("documentId", "reportId") REFERENCES "CraDocument"("id", "reportId") ON DELETE RESTRICT ON UPDATE CASCADE;
