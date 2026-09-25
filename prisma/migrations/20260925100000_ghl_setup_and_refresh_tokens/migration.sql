-- CreateEnum
CREATE TYPE "AppRole" AS ENUM ('admin', 'sales_rep', 'csr', 'installer');
-- AlterTable
ALTER TABLE "integration_credentials" ADD COLUMN     "setupCompletedAt" TIMESTAMP(3);
-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "authMethod" TEXT NOT NULL DEFAULT 'password',
ADD COLUMN     "familyId" TEXT;
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "ghlRole" TEXT,
ADD COLUMN     "role" "AppRole";
-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "familyStartedAt" TIMESTAMP(3) NOT NULL,
    "authMethod" TEXT NOT NULL DEFAULT 'password',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");
-- CreateIndex
CREATE INDEX "refresh_tokens_familyId_idx" ON "refresh_tokens"("familyId");
-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");
-- CreateIndex
CREATE INDEX "sessions_familyId_idx" ON "sessions"("familyId");
-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
