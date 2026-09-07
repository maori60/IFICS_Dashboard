-- CreateEnum
CREATE TYPE "DataClassification" AS ENUM ('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "MfaResetStatus" AS ENUM ('PENDING', 'APPROVED', 'USED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('INFO', 'SUCCESS', 'WARNING', 'ACTION', 'SECURITY');

-- CreateEnum
CREATE TYPE "BillingDocumentKind" AS ENUM ('QUOTE', 'INVOICE');

-- CreateEnum
CREATE TYPE "BillingDocumentStatus" AS ENUM ('DRAFT', 'ISSUED', 'SENT', 'ACCEPTED', 'REJECTED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AuditOutcome" AS ENUM ('SUCCESS', 'FAILURE');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'WAITING_REQUESTER', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "TicketCategory" AS ENUM ('ADMIN', 'BILLING', 'CONTRACT', 'PROJECT', 'PLATFORM', 'DOCUMENT', 'IT', 'HR', 'SECURITY', 'OTHER');

-- CreateEnum
CREATE TYPE "ContentKind" AS ENUM ('PAGE', 'ARTICLE', 'NEWS', 'RND', 'ACTIVITY_REPORT');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'REVIEW', 'APPROVED', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PartnerType" AS ENUM ('INSTITUTIONAL', 'COLLECTIVITY', 'COMPANY', 'PATRON', 'OPERATIONAL', 'TECHNICAL');

-- CreateEnum
CREATE TYPE "PartnerPipelineStage" AS ENUM ('IDENTIFIED', 'CONTACTED', 'MEETING', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('NEW', 'QUALIFYING', 'CONTACTED', 'STUDY', 'NEGOTIATION', 'ACCEPTED', 'REJECTED', 'CONVERTED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('NEW', 'REVIEW', 'INTERVIEW', 'ACCEPTED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SoftwareStatus" AS ENUM ('EXPERIMENTAL', 'BETA', 'STABLE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('STOCK', 'ASSIGNED', 'MAINTENANCE', 'RETIRED', 'LOST');

-- CreateEnum
CREATE TYPE "RndStatus" AS ENUM ('IDEA', 'EXPLORATION', 'PROTOTYPE', 'PILOT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "HrEmploymentType" AS ENUM ('EMPLOYEE', 'VOLUNTEER', 'INTERN', 'APPRENTICE', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "ContactRequestStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'RESOLVED', 'ARCHIVED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "IntervenorDocumentStatus" ADD VALUE 'UNDER_REVIEW';
ALTER TYPE "IntervenorDocumentStatus" ADD VALUE 'TO_RENEW';
ALTER TYPE "IntervenorDocumentStatus" ADD VALUE 'EXPIRED';
ALTER TYPE "IntervenorDocumentStatus" ADD VALUE 'ARCHIVED';

-- AlterTable
ALTER TABLE "Association" ADD COLUMN     "currency" VARCHAR(3) NOT NULL DEFAULT 'EUR',
ADD COLUMN     "locale" VARCHAR(20) NOT NULL DEFAULT 'fr-FR',
ADD COLUMN     "maintenanceEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "maintenanceEndsAt" TIMESTAMP(3),
ADD COLUMN     "maintenanceMessage" TEXT,
ADD COLUMN     "maintenanceStartsAt" TIMESTAMP(3),
ADD COLUMN     "timezone" VARCHAR(100) NOT NULL DEFAULT 'Europe/Paris';

-- AlterTable
ALTER TABLE "IntervenorAccountingDocument" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "sha256" VARCHAR(64),
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "IntervenorDocument" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "issuedAt" TIMESTAMP(3),
ADD COLUMN     "lastExpiryReminderDays" INTEGER,
ADD COLUMN     "sha256" VARCHAR(64),
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "classification" "DataClassification" NOT NULL DEFAULT 'INTERNAL',
ADD COLUMN     "reference" VARCHAR(50),
ALTER COLUMN "plannedBudget" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "actualBudget" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "totalIntervenorCost" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "materialCost" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "printingCost" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "otherCost" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "estimatedNetMargin" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "actualNetMargin" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "sessionUnitPrice" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "ProjectDocument" ADD COLUMN     "sha256" VARCHAR(64),
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "ProjectReport" ADD COLUMN     "currentVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "submittedAt" TIMESTAMP(3),
ADD COLUMN     "title" VARCHAR(255),
ADD COLUMN     "validatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Role" ADD COLUMN     "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "accessExpiresAt" TIMESTAMP(3),
ADD COLUMN     "clientId" TEXT,
ADD COLUMN     "mfaConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mfaRecoveryCodesHash" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "mfaSecretCiphertext" TEXT,
ADD COLUMN     "mfaSecretIv" TEXT,
ADD COLUMN     "mfaSecretTag" TEXT,
ADD COLUMN     "passwordChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "mfaVerifiedAt" TIMESTAMP(3),
    "ipHash" VARCHAR(64),
    "userAgent" VARCHAR(500),
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "ipHash" VARCHAR(64),
    "success" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "associationId" TEXT NOT NULL,
    "userId" TEXT,
    "action" VARCHAR(100) NOT NULL,
    "outcome" "AuditOutcome" NOT NULL DEFAULT 'SUCCESS',
    "entityType" VARCHAR(100),
    "entityId" VARCHAR(191),
    "requestId" VARCHAR(100),
    "ipHash" VARCHAR(64),
    "userAgent" VARCHAR(500),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL DEFAULT 'INFO',
    "title" VARCHAR(180) NOT NULL,
    "message" TEXT NOT NULL,
    "href" VARCHAR(500),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectReportVersion" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "version" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectReportVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingDocument" (
    "id" TEXT NOT NULL,
    "associationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "projectId" TEXT,
    "createdByUserId" TEXT,
    "sourceQuoteId" TEXT,
    "kind" "BillingDocumentKind" NOT NULL,
    "number" VARCHAR(60) NOT NULL,
    "status" "BillingDocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'EUR',
    "subject" VARCHAR(255),
    "notes" TEXT,
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingLine" (
    "id" TEXT NOT NULL,
    "billingDocumentId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingSequence" (
    "id" TEXT NOT NULL,
    "associationId" TEXT NOT NULL,
    "kind" "BillingDocumentKind" NOT NULL,
    "year" INTEGER NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "associationId" TEXT NOT NULL,
    "number" VARCHAR(40) NOT NULL,
    "requesterUserId" TEXT,
    "requesterEmail" VARCHAR(255),
    "projectId" TEXT,
    "category" "TicketCategory" NOT NULL DEFAULT 'OTHER',
    "priority" "TicketPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "TicketStatus" NOT NULL DEFAULT 'NEW',
    "subject" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "assigneeUserId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketComment" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorUserId" TEXT,
    "body" TEXT NOT NULL,
    "internal" BOOLEAN NOT NULL DEFAULT false,
    "attachments" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketSequence" (
    "id" TEXT NOT NULL,
    "associationId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CmsEntry" (
    "id" TEXT NOT NULL,
    "associationId" TEXT NOT NULL,
    "kind" "ContentKind" NOT NULL,
    "slug" VARCHAR(180) NOT NULL,
    "titleFr" VARCHAR(255) NOT NULL,
    "titleEn" VARCHAR(255),
    "excerptFr" TEXT,
    "excerptEn" TEXT,
    "bodyFr" TEXT NOT NULL,
    "bodyEn" TEXT,
    "heroImageUrl" VARCHAR(500),
    "gallery" JSONB,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "authorUserId" TEXT,
    "reviewedByUserId" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CmsEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL,
    "associationId" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "type" "PartnerType" NOT NULL,
    "stage" "PartnerPipelineStage" NOT NULL DEFAULT 'IDENTIFIED',
    "website" VARCHAR(500),
    "logoUrl" VARCHAR(500),
    "descriptionFr" TEXT,
    "descriptionEn" TEXT,
    "publicEnabled" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerContact" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "firstName" VARCHAR(100) NOT NULL,
    "lastName" VARCHAR(100) NOT NULL,
    "jobTitle" VARCHAR(150),
    "email" VARCHAR(255),
    "phone" VARCHAR(30),
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerInteraction" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "authorUserId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" VARCHAR(80) NOT NULL,
    "summary" TEXT NOT NULL,
    "nextAction" TEXT,
    "nextActionAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerMessage" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "authorUserId" TEXT,
    "body" TEXT NOT NULL,
    "internal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectPublication" (
    "id" TEXT NOT NULL,
    "associationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "slug" VARCHAR(180) NOT NULL,
    "titleFr" VARCHAR(255) NOT NULL,
    "titleEn" VARCHAR(255),
    "summaryFr" TEXT NOT NULL,
    "summaryEn" TEXT,
    "imageUrl" VARCHAR(500),
    "territory" VARCHAR(150),
    "publicStatus" VARCHAR(80),
    "publicEnabled" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectPublication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntervenorPublicProfile" (
    "id" TEXT NOT NULL,
    "associationId" TEXT NOT NULL,
    "intervenorId" TEXT NOT NULL,
    "displayName" VARCHAR(200),
    "bioFr" TEXT,
    "bioEn" TEXT,
    "photoUrl" VARCHAR(500),
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "certifications" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "links" JSONB,
    "publicEnabled" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntervenorPublicProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectProposal" (
    "id" TEXT NOT NULL,
    "associationId" TEXT NOT NULL,
    "organizationName" VARCHAR(200) NOT NULL,
    "contactName" VARCHAR(200) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(30),
    "territory" VARCHAR(150),
    "audience" TEXT,
    "issue" TEXT NOT NULL,
    "proposalType" VARCHAR(150),
    "timeframe" VARCHAR(150),
    "budget" DECIMAL(12,2),
    "participantCount" INTEGER,
    "comment" TEXT,
    "attachmentPath" VARCHAR(500),
    "status" "ProposalStatus" NOT NULL DEFAULT 'NEW',
    "assignedUserId" TEXT,
    "convertedProjectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactRequest" (
    "id" TEXT NOT NULL,
    "associationId" TEXT NOT NULL,
    "reason" VARCHAR(100) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "organization" VARCHAR(200),
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(30),
    "message" TEXT NOT NULL,
    "status" "ContactRequestStatus" NOT NULL DEFAULT 'NEW',
    "assignedUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobOpening" (
    "id" TEXT NOT NULL,
    "associationId" TEXT NOT NULL,
    "slug" VARCHAR(180) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "contractType" VARCHAR(100),
    "location" VARCHAR(150),
    "descriptionFr" TEXT NOT NULL,
    "descriptionEn" TEXT,
    "status" "JobStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobOpening_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobApplication" (
    "id" TEXT NOT NULL,
    "openingId" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(30),
    "message" TEXT,
    "cvPath" VARCHAR(500),
    "status" "ApplicationStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SoftwareCategory" (
    "id" TEXT NOT NULL,
    "associationId" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SoftwareCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SoftwareItem" (
    "id" TEXT NOT NULL,
    "associationId" TEXT NOT NULL,
    "categoryId" TEXT,
    "name" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(180) NOT NULL,
    "descriptionFr" TEXT NOT NULL,
    "descriptionEn" TEXT,
    "audience" TEXT,
    "features" JSONB,
    "platforms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "license" VARCHAR(120),
    "openSource" BOOLEAN NOT NULL DEFAULT false,
    "repoUrl" VARCHAR(500),
    "docsUrl" VARCHAR(500),
    "videoUrl" VARCHAR(500),
    "status" "SoftwareStatus" NOT NULL DEFAULT 'EXPERIMENTAL',
    "publicEnabled" BOOLEAN NOT NULL DEFAULT false,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SoftwareItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SoftwareVersion" (
    "id" TEXT NOT NULL,
    "softwareId" TEXT NOT NULL,
    "version" VARCHAR(50) NOT NULL,
    "changelog" TEXT,
    "filePath" VARCHAR(500),
    "sha256" VARCHAR(64),
    "fileSize" BIGINT,
    "status" "SoftwareStatus" NOT NULL DEFAULT 'EXPERIMENTAL',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SoftwareVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RndProject" (
    "id" TEXT NOT NULL,
    "associationId" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "ownerUserId" TEXT,
    "status" "RndStatus" NOT NULL DEFAULT 'IDEA',
    "budget" DECIMAL(12,2),
    "repoUrl" VARCHAR(500),
    "documentationUrl" VARCHAR(500),
    "testResults" TEXT,
    "publicEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RndProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkTask" (
    "id" TEXT NOT NULL,
    "associationId" TEXT NOT NULL,
    "projectId" TEXT,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" "TaskPriority" NOT NULL DEFAULT 'NORMAL',
    "assigneeUserId" TEXT,
    "dueDate" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "associationId" TEXT NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepartmentMembership" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "position" VARCHAR(150),
    "isManager" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DepartmentMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrProfile" (
    "id" TEXT NOT NULL,
    "associationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "employmentType" "HrEmploymentType" NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "managerUserId" TEXT,
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrAbsence" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "type" VARCHAR(100) NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" VARCHAR(40) NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrAbsence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrTraining" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "provider" VARCHAR(200),
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "certificatePath" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrTraining_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrReview" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "reviewerUserId" TEXT,
    "reviewDate" TIMESTAMP(3) NOT NULL,
    "summary" TEXT NOT NULL,
    "objectives" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "associationId" TEXT NOT NULL,
    "inventoryTag" VARCHAR(100) NOT NULL,
    "type" VARCHAR(100) NOT NULL,
    "brand" VARCHAR(100),
    "model" VARCHAR(150),
    "serialNumber" VARCHAR(150),
    "status" "AssetStatus" NOT NULL DEFAULT 'STOCK',
    "assignedUserId" TEXT,
    "location" VARCHAR(200),
    "purchaseDate" TIMESTAMP(3),
    "warrantyUntil" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" TEXT NOT NULL,
    "associationId" TEXT NOT NULL,
    "key" VARCHAR(120) NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MfaResetRequest" (
    "id" TEXT NOT NULL,
    "associationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "MfaResetStatus" NOT NULL DEFAULT 'PENDING',
    "tokenHash" VARCHAR(64),
    "approvedByUserId" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MfaResetRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_tokenHash_key" ON "AuthSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthSession_userId_idx" ON "AuthSession"("userId");

-- CreateIndex
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");

-- CreateIndex
CREATE INDEX "AuthSession_revokedAt_idx" ON "AuthSession"("revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");

-- CreateIndex
CREATE INDEX "LoginAttempt_email_createdAt_idx" ON "LoginAttempt"("email", "createdAt");

-- CreateIndex
CREATE INDEX "LoginAttempt_ipHash_createdAt_idx" ON "LoginAttempt"("ipHash", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_associationId_createdAt_idx" ON "AuditLog"("associationId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectReportVersion_createdByUserId_idx" ON "ProjectReportVersion"("createdByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectReportVersion_reportId_version_key" ON "ProjectReportVersion"("reportId", "version");

-- CreateIndex
CREATE INDEX "BillingDocument_associationId_kind_status_idx" ON "BillingDocument"("associationId", "kind", "status");

-- CreateIndex
CREATE INDEX "BillingDocument_clientId_idx" ON "BillingDocument"("clientId");

-- CreateIndex
CREATE INDEX "BillingDocument_projectId_idx" ON "BillingDocument"("projectId");

-- CreateIndex
CREATE INDEX "BillingDocument_sourceQuoteId_idx" ON "BillingDocument"("sourceQuoteId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingDocument_associationId_number_key" ON "BillingDocument"("associationId", "number");

-- CreateIndex
CREATE INDEX "BillingLine_billingDocumentId_idx" ON "BillingLine"("billingDocumentId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingLine_billingDocumentId_position_key" ON "BillingLine"("billingDocumentId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "BillingSequence_associationId_kind_year_key" ON "BillingSequence"("associationId", "kind", "year");

-- CreateIndex
CREATE INDEX "SupportTicket_associationId_status_priority_idx" ON "SupportTicket"("associationId", "status", "priority");

-- CreateIndex
CREATE INDEX "SupportTicket_requesterUserId_idx" ON "SupportTicket"("requesterUserId");

-- CreateIndex
CREATE INDEX "SupportTicket_assigneeUserId_idx" ON "SupportTicket"("assigneeUserId");

-- CreateIndex
CREATE INDEX "SupportTicket_projectId_idx" ON "SupportTicket"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "SupportTicket_associationId_number_key" ON "SupportTicket"("associationId", "number");

-- CreateIndex
CREATE INDEX "TicketComment_ticketId_createdAt_idx" ON "TicketComment"("ticketId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TicketSequence_associationId_year_key" ON "TicketSequence"("associationId", "year");

-- CreateIndex
CREATE INDEX "CmsEntry_associationId_kind_status_idx" ON "CmsEntry"("associationId", "kind", "status");

-- CreateIndex
CREATE INDEX "CmsEntry_publishedAt_idx" ON "CmsEntry"("publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CmsEntry_associationId_kind_slug_key" ON "CmsEntry"("associationId", "kind", "slug");

-- CreateIndex
CREATE INDEX "Partner_associationId_type_idx" ON "Partner"("associationId", "type");

-- CreateIndex
CREATE INDEX "Partner_associationId_stage_idx" ON "Partner"("associationId", "stage");

-- CreateIndex
CREATE INDEX "PartnerContact_partnerId_idx" ON "PartnerContact"("partnerId");

-- CreateIndex
CREATE INDEX "PartnerInteraction_partnerId_occurredAt_idx" ON "PartnerInteraction"("partnerId", "occurredAt");

-- CreateIndex
CREATE INDEX "PartnerInteraction_nextActionAt_idx" ON "PartnerInteraction"("nextActionAt");

-- CreateIndex
CREATE INDEX "PartnerMessage_partnerId_createdAt_idx" ON "PartnerMessage"("partnerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectPublication_projectId_key" ON "ProjectPublication"("projectId");

-- CreateIndex
CREATE INDEX "ProjectPublication_associationId_publicEnabled_idx" ON "ProjectPublication"("associationId", "publicEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectPublication_associationId_slug_key" ON "ProjectPublication"("associationId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "IntervenorPublicProfile_intervenorId_key" ON "IntervenorPublicProfile"("intervenorId");

-- CreateIndex
CREATE INDEX "IntervenorPublicProfile_associationId_publicEnabled_idx" ON "IntervenorPublicProfile"("associationId", "publicEnabled");

-- CreateIndex
CREATE INDEX "ProjectProposal_associationId_status_idx" ON "ProjectProposal"("associationId", "status");

-- CreateIndex
CREATE INDEX "ProjectProposal_email_idx" ON "ProjectProposal"("email");

-- CreateIndex
CREATE INDEX "ContactRequest_associationId_status_idx" ON "ContactRequest"("associationId", "status");

-- CreateIndex
CREATE INDEX "JobOpening_associationId_status_idx" ON "JobOpening"("associationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "JobOpening_associationId_slug_key" ON "JobOpening"("associationId", "slug");

-- CreateIndex
CREATE INDEX "JobApplication_openingId_status_idx" ON "JobApplication"("openingId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SoftwareCategory_associationId_slug_key" ON "SoftwareCategory"("associationId", "slug");

-- CreateIndex
CREATE INDEX "SoftwareItem_associationId_status_publicEnabled_idx" ON "SoftwareItem"("associationId", "status", "publicEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "SoftwareItem_associationId_slug_key" ON "SoftwareItem"("associationId", "slug");

-- CreateIndex
CREATE INDEX "SoftwareVersion_softwareId_publishedAt_idx" ON "SoftwareVersion"("softwareId", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SoftwareVersion_softwareId_version_key" ON "SoftwareVersion"("softwareId", "version");

-- CreateIndex
CREATE INDEX "RndProject_associationId_status_idx" ON "RndProject"("associationId", "status");

-- CreateIndex
CREATE INDEX "WorkTask_associationId_status_priority_idx" ON "WorkTask"("associationId", "status", "priority");

-- CreateIndex
CREATE INDEX "WorkTask_projectId_idx" ON "WorkTask"("projectId");

-- CreateIndex
CREATE INDEX "WorkTask_assigneeUserId_idx" ON "WorkTask"("assigneeUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Department_associationId_code_key" ON "Department"("associationId", "code");

-- CreateIndex
CREATE INDEX "DepartmentMembership_userId_idx" ON "DepartmentMembership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DepartmentMembership_departmentId_userId_key" ON "DepartmentMembership"("departmentId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "HrProfile_userId_key" ON "HrProfile"("userId");

-- CreateIndex
CREATE INDEX "HrProfile_associationId_employmentType_idx" ON "HrProfile"("associationId", "employmentType");

-- CreateIndex
CREATE INDEX "HrAbsence_profileId_startDate_idx" ON "HrAbsence"("profileId", "startDate");

-- CreateIndex
CREATE INDEX "HrTraining_profileId_expiresAt_idx" ON "HrTraining"("profileId", "expiresAt");

-- CreateIndex
CREATE INDEX "HrReview_profileId_reviewDate_idx" ON "HrReview"("profileId", "reviewDate");

-- CreateIndex
CREATE INDEX "Asset_associationId_status_idx" ON "Asset"("associationId", "status");

-- CreateIndex
CREATE INDEX "Asset_assignedUserId_idx" ON "Asset"("assignedUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_associationId_inventoryTag_key" ON "Asset"("associationId", "inventoryTag");

-- CreateIndex
CREATE UNIQUE INDEX "SystemSetting_associationId_key_key" ON "SystemSetting"("associationId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "MfaResetRequest_tokenHash_key" ON "MfaResetRequest"("tokenHash");

-- CreateIndex
CREATE INDEX "MfaResetRequest_associationId_status_requestedAt_idx" ON "MfaResetRequest"("associationId", "status", "requestedAt");

-- CreateIndex
CREATE INDEX "MfaResetRequest_userId_status_idx" ON "MfaResetRequest"("userId", "status");

-- CreateIndex
CREATE INDEX "MfaResetRequest_expiresAt_idx" ON "MfaResetRequest"("expiresAt");

-- CreateIndex
CREATE INDEX "IntervenorAccountingDocument_archivedAt_idx" ON "IntervenorAccountingDocument"("archivedAt");

-- CreateIndex
CREATE INDEX "IntervenorAccountingDocument_sha256_idx" ON "IntervenorAccountingDocument"("sha256");

-- CreateIndex
CREATE INDEX "IntervenorDocument_archivedAt_idx" ON "IntervenorDocument"("archivedAt");

-- CreateIndex
CREATE INDEX "IntervenorDocument_expiresAt_idx" ON "IntervenorDocument"("expiresAt");

-- CreateIndex
CREATE INDEX "IntervenorDocument_sha256_idx" ON "IntervenorDocument"("sha256");

-- CreateIndex
CREATE UNIQUE INDEX "Project_associationId_reference_key" ON "Project"("associationId", "reference");

-- CreateIndex
CREATE INDEX "ProjectDocument_sha256_idx" ON "ProjectDocument"("sha256");

-- CreateIndex
CREATE INDEX "User_clientId_idx" ON "User"("clientId");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "User_accessExpiresAt_idx" ON "User"("accessExpiresAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "Association"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectReportVersion" ADD CONSTRAINT "ProjectReportVersion_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "ProjectReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectReportVersion" ADD CONSTRAINT "ProjectReportVersion_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingDocument" ADD CONSTRAINT "BillingDocument_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "Association"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingDocument" ADD CONSTRAINT "BillingDocument_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingDocument" ADD CONSTRAINT "BillingDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingDocument" ADD CONSTRAINT "BillingDocument_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingDocument" ADD CONSTRAINT "BillingDocument_sourceQuoteId_fkey" FOREIGN KEY ("sourceQuoteId") REFERENCES "BillingDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingLine" ADD CONSTRAINT "BillingLine_billingDocumentId_fkey" FOREIGN KEY ("billingDocumentId") REFERENCES "BillingDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingSequence" ADD CONSTRAINT "BillingSequence_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "Association"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketComment" ADD CONSTRAINT "TicketComment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerContact" ADD CONSTRAINT "PartnerContact_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerInteraction" ADD CONSTRAINT "PartnerInteraction_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerMessage" ADD CONSTRAINT "PartnerMessage_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_openingId_fkey" FOREIGN KEY ("openingId") REFERENCES "JobOpening"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoftwareItem" ADD CONSTRAINT "SoftwareItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "SoftwareCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoftwareVersion" ADD CONSTRAINT "SoftwareVersion_softwareId_fkey" FOREIGN KEY ("softwareId") REFERENCES "SoftwareItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentMembership" ADD CONSTRAINT "DepartmentMembership_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrAbsence" ADD CONSTRAINT "HrAbsence_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "HrProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrTraining" ADD CONSTRAINT "HrTraining_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "HrProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrReview" ADD CONSTRAINT "HrReview_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "HrProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
