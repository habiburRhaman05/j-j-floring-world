-- AlterTable
ALTER TABLE "integration_credentials" ADD COLUMN     "leadPipelineId" TEXT,
ADD COLUMN     "leadTag" TEXT DEFAULT 'fb-lead';
