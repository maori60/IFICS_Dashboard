/*
  Warnings:

  - You are about to alter the column `name` on the `Association` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(150)`.
  - You are about to alter the column `legalName` on the `Association` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `logoUrl` on the `Association` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(500)`.
  - You are about to alter the column `primaryColor` on the `Association` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(20)`.
  - You are about to alter the column `secondaryColor` on the `Association` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(20)`.
  - You are about to alter the column `billingName` on the `Association` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `billingAddress` on the `Association` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `billingPostalCode` on the `Association` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(20)`.
  - You are about to alter the column `billingCity` on the `Association` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(120)`.
  - You are about to alter the column `billingCountry` on the `Association` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `billingEmail` on the `Association` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `billingPhone` on the `Association` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(30)`.
  - You are about to alter the column `siret` on the `Association` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(30)`.
  - You are about to alter the column `name` on the `Client` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(150)`.
  - You are about to alter the column `serviceName` on the `Client` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(150)`.
  - You are about to alter the column `email` on the `Client` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `phone1` on the `Client` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(30)`.
  - You are about to alter the column `phone2` on the `Client` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(30)`.
  - You are about to alter the column `siret` on the `Client` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(30)`.
  - You are about to alter the column `addressLine1` on the `Client` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `addressLine2` on the `Client` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `postalCode` on the `Client` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(20)`.
  - You are about to alter the column `city` on the `Client` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(120)`.
  - You are about to alter the column `country` on the `Client` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `billingAddressLine1` on the `Client` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `billingAddressLine2` on the `Client` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `billingPostalCode` on the `Client` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(20)`.
  - You are about to alter the column `billingCity` on the `Client` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(120)`.
  - You are about to alter the column `billingCountry` on the `Client` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `firstName` on the `ClientContact` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `lastName` on the `ClientContact` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `jobTitle` on the `ClientContact` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `email` on the `ClientContact` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `phone1` on the `ClientContact` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(30)`.
  - You are about to alter the column `phone2` on the `ClientContact` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(30)`.
  - You are about to alter the column `firstName` on the `Intervenor` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `lastName` on the `Intervenor` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `email` on the `Intervenor` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `phone` on the `Intervenor` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(30)`.
  - You are about to alter the column `specialty` on the `Intervenor` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(150)`.
  - You are about to alter the column `siret` on the `Intervenor` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(30)`.
  - You are about to alter the column `ribIban` on the `Intervenor` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(34)`.
  - You are about to alter the column `ribBic` on the `Intervenor` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(11)`.
  - You are about to alter the column `addressLine1` on the `Intervenor` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `addressLine2` on the `Intervenor` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `postalCode` on the `Intervenor` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(20)`.
  - You are about to alter the column `city` on the `Intervenor` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(120)`.
  - You are about to alter the column `country` on the `Intervenor` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `title` on the `Project` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `title` on the `ProjectDocument` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `originalName` on the `ProjectDocument` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `storedName` on the `ProjectDocument` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `filePath` on the `ProjectDocument` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(500)`.
  - You are about to alter the column `mimeType` on the `ProjectDocument` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `name` on the `Role` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `code` on the `Role` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `firstName` on the `User` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `lastName` on the `User` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `email` on the `User` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `phone` on the `User` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(30)`.
  - You are about to alter the column `resetToken` on the `User` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - A unique constraint covering the columns `[associationId,email]` on the table `Intervenor` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[associationId,name]` on the table `Role` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[resetToken]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "AccountingDocumentType" AS ENUM ('QUOTE', 'INVOICE');

-- CreateEnum
CREATE TYPE "AccountingDocumentStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REFUSED');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED', 'VALIDATED', 'REFUSED');

-- CreateEnum
CREATE TYPE "IntervenorDocumentType" AS ENUM ('IDENTITY', 'SIRENE', 'RC_PRO', 'CONTRACT', 'CONVENTION', 'SIGNED_CONVENTION', 'OTHER');

-- CreateEnum
CREATE TYPE "IntervenorDocumentStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REFUSED');

-- DropIndex
DROP INDEX "Client_status_idx";

-- DropIndex
DROP INDEX "Intervenor_status_idx";

-- DropIndex
DROP INDEX "Project_status_idx";

-- AlterTable
ALTER TABLE "Association" ALTER COLUMN "name" SET DATA TYPE VARCHAR(150),
ALTER COLUMN "legalName" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "logoUrl" SET DATA TYPE VARCHAR(500),
ALTER COLUMN "primaryColor" SET DATA TYPE VARCHAR(20),
ALTER COLUMN "secondaryColor" SET DATA TYPE VARCHAR(20),
ALTER COLUMN "billingName" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "billingAddress" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "billingPostalCode" SET DATA TYPE VARCHAR(20),
ALTER COLUMN "billingCity" SET DATA TYPE VARCHAR(120),
ALTER COLUMN "billingCountry" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "billingEmail" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "billingPhone" SET DATA TYPE VARCHAR(30),
ALTER COLUMN "siret" SET DATA TYPE VARCHAR(30);

-- AlterTable
ALTER TABLE "Client" ALTER COLUMN "name" SET DATA TYPE VARCHAR(150),
ALTER COLUMN "serviceName" SET DATA TYPE VARCHAR(150),
ALTER COLUMN "email" DROP NOT NULL,
ALTER COLUMN "email" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "phone1" SET DATA TYPE VARCHAR(30),
ALTER COLUMN "phone2" SET DATA TYPE VARCHAR(30),
ALTER COLUMN "siret" SET DATA TYPE VARCHAR(30),
ALTER COLUMN "addressLine1" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "addressLine2" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "postalCode" SET DATA TYPE VARCHAR(20),
ALTER COLUMN "city" SET DATA TYPE VARCHAR(120),
ALTER COLUMN "country" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "billingAddressLine1" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "billingAddressLine2" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "billingPostalCode" SET DATA TYPE VARCHAR(20),
ALTER COLUMN "billingCity" SET DATA TYPE VARCHAR(120),
ALTER COLUMN "billingCountry" SET DATA TYPE VARCHAR(100);

-- AlterTable
ALTER TABLE "ClientContact" ALTER COLUMN "firstName" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "lastName" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "jobTitle" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "email" DROP NOT NULL,
ALTER COLUMN "email" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "phone1" SET DATA TYPE VARCHAR(30),
ALTER COLUMN "phone2" SET DATA TYPE VARCHAR(30);

-- AlterTable
ALTER TABLE "Intervenor" ALTER COLUMN "firstName" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "lastName" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "email" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "phone" SET DATA TYPE VARCHAR(30),
ALTER COLUMN "specialty" SET DATA TYPE VARCHAR(150),
ALTER COLUMN "siret" SET DATA TYPE VARCHAR(30),
ALTER COLUMN "ribIban" SET DATA TYPE VARCHAR(34),
ALTER COLUMN "ribBic" SET DATA TYPE VARCHAR(11),
ALTER COLUMN "addressLine1" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "addressLine2" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "postalCode" SET DATA TYPE VARCHAR(20),
ALTER COLUMN "city" SET DATA TYPE VARCHAR(120),
ALTER COLUMN "country" SET DATA TYPE VARCHAR(100);

-- AlterTable
ALTER TABLE "Project" ALTER COLUMN "title" SET DATA TYPE VARCHAR(255);

-- AlterTable
ALTER TABLE "ProjectDocument" ALTER COLUMN "title" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "originalName" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "storedName" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "filePath" SET DATA TYPE VARCHAR(500),
ALTER COLUMN "mimeType" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "fileSize" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "Role" ALTER COLUMN "name" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "code" SET DATA TYPE VARCHAR(50);

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "firstName" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "lastName" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "email" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "phone" SET DATA TYPE VARCHAR(30),
ALTER COLUMN "resetToken" SET DATA TYPE VARCHAR(255);

-- CreateTable
CREATE TABLE "IntervenorDocument" (
    "id" TEXT NOT NULL,
    "intervenorId" TEXT NOT NULL,
    "reviewedByUserId" TEXT,
    "type" "IntervenorDocumentType" NOT NULL,
    "status" "IntervenorDocumentStatus" NOT NULL DEFAULT 'PENDING',
    "title" VARCHAR(255),
    "originalName" VARCHAR(255) NOT NULL,
    "storedName" VARCHAR(255) NOT NULL,
    "filePath" VARCHAR(500) NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "fileSize" BIGINT NOT NULL,
    "adminComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "IntervenorDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntervenorAccountingDocument" (
    "id" TEXT NOT NULL,
    "intervenorId" TEXT NOT NULL,
    "projectId" TEXT,
    "reviewedByUserId" TEXT,
    "type" "AccountingDocumentType" NOT NULL,
    "status" "AccountingDocumentStatus" NOT NULL DEFAULT 'PENDING',
    "title" VARCHAR(255),
    "description" TEXT,
    "periodMonth" INTEGER,
    "periodYear" INTEGER,
    "originalName" VARCHAR(255) NOT NULL,
    "storedName" VARCHAR(255) NOT NULL,
    "filePath" VARCHAR(500) NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "fileSize" BIGINT NOT NULL,
    "adminComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "IntervenorAccountingDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectReport" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "intervenorId" TEXT,
    "reviewedByUserId" TEXT,
    "sessionDate" TIMESTAMP(3) NOT NULL,
    "studentsCount" INTEGER,
    "status" "ReportStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "pdfPath" VARCHAR(500),
    "comment" TEXT,
    "refusalReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "ProjectReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IntervenorDocument_intervenorId_idx" ON "IntervenorDocument"("intervenorId");

-- CreateIndex
CREATE INDEX "IntervenorDocument_status_idx" ON "IntervenorDocument"("status");

-- CreateIndex
CREATE INDEX "IntervenorDocument_reviewedByUserId_idx" ON "IntervenorDocument"("reviewedByUserId");

-- CreateIndex
CREATE INDEX "IntervenorAccountingDocument_intervenorId_idx" ON "IntervenorAccountingDocument"("intervenorId");

-- CreateIndex
CREATE INDEX "IntervenorAccountingDocument_projectId_idx" ON "IntervenorAccountingDocument"("projectId");

-- CreateIndex
CREATE INDEX "IntervenorAccountingDocument_status_idx" ON "IntervenorAccountingDocument"("status");

-- CreateIndex
CREATE INDEX "IntervenorAccountingDocument_type_idx" ON "IntervenorAccountingDocument"("type");

-- CreateIndex
CREATE INDEX "IntervenorAccountingDocument_periodYear_periodMonth_idx" ON "IntervenorAccountingDocument"("periodYear", "periodMonth");

-- CreateIndex
CREATE INDEX "IntervenorAccountingDocument_reviewedByUserId_idx" ON "IntervenorAccountingDocument"("reviewedByUserId");

-- CreateIndex
CREATE INDEX "ProjectReport_projectId_idx" ON "ProjectReport"("projectId");

-- CreateIndex
CREATE INDEX "ProjectReport_intervenorId_idx" ON "ProjectReport"("intervenorId");

-- CreateIndex
CREATE INDEX "ProjectReport_status_idx" ON "ProjectReport"("status");

-- CreateIndex
CREATE INDEX "ProjectReport_reviewedByUserId_idx" ON "ProjectReport"("reviewedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectReport_projectId_intervenorId_sessionDate_key" ON "ProjectReport"("projectId", "intervenorId", "sessionDate");

-- CreateIndex
CREATE INDEX "Client_associationId_status_idx" ON "Client"("associationId", "status");

-- CreateIndex
CREATE INDEX "Client_siret_idx" ON "Client"("siret");

-- CreateIndex
CREATE INDEX "Intervenor_associationId_status_idx" ON "Intervenor"("associationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Intervenor_associationId_email_key" ON "Intervenor"("associationId", "email");

-- CreateIndex
CREATE INDEX "Project_associationId_status_idx" ON "Project"("associationId", "status");

-- CreateIndex
CREATE INDEX "ProjectDocument_projectId_visibility_idx" ON "ProjectDocument"("projectId", "visibility");

-- CreateIndex
CREATE UNIQUE INDEX "Role_associationId_name_key" ON "Role"("associationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "User_resetToken_key" ON "User"("resetToken");

-- AddForeignKey
ALTER TABLE "IntervenorDocument" ADD CONSTRAINT "IntervenorDocument_intervenorId_fkey" FOREIGN KEY ("intervenorId") REFERENCES "Intervenor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntervenorDocument" ADD CONSTRAINT "IntervenorDocument_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntervenorAccountingDocument" ADD CONSTRAINT "IntervenorAccountingDocument_intervenorId_fkey" FOREIGN KEY ("intervenorId") REFERENCES "Intervenor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntervenorAccountingDocument" ADD CONSTRAINT "IntervenorAccountingDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntervenorAccountingDocument" ADD CONSTRAINT "IntervenorAccountingDocument_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectReport" ADD CONSTRAINT "ProjectReport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectReport" ADD CONSTRAINT "ProjectReport_intervenorId_fkey" FOREIGN KEY ("intervenorId") REFERENCES "Intervenor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectReport" ADD CONSTRAINT "ProjectReport_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
