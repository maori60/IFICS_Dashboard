-- AlterTable
ALTER TABLE "AssociationFinanceSettings" ADD COLUMN     "craSignatureFilePath" VARCHAR(500),
ADD COLUMN     "craSignatureFileSize" BIGINT,
ADD COLUMN     "craSignatureMimeType" VARCHAR(100),
ADD COLUMN     "craSignatureOriginalName" VARCHAR(255),
ADD COLUMN     "craSignatureSha256" VARCHAR(64),
ADD COLUMN     "craSignatureUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "craSignatureUpdatedByUserId" TEXT;
