-- CreateTable
CREATE TABLE "product_costs" (
    "id" TEXT NOT NULL,
    "ghlProductId" TEXT NOT NULL,
    "ghlPriceId" TEXT NOT NULL,
    "installCost" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "materialCost" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_costs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_costs_ghlProductId_ghlPriceId_key" ON "product_costs"("ghlProductId", "ghlPriceId");
