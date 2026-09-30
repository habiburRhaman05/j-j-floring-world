-- AlterTable
ALTER TABLE "estimates" ADD COLUMN "publicToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "estimates_publicToken_key" ON "estimates"("publicToken");
