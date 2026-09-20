-- AlterEnum
ALTER TYPE "CraStatus" ADD VALUE 'REVIEWED';

-- AlterTable
ALTER TABLE "CraReport" ADD COLUMN     "correctionReason" VARCHAR(2000),
ADD COLUMN     "correctionRequestedAt" TIMESTAMP(3),
ADD COLUMN     "correctionRequestedById" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT;
