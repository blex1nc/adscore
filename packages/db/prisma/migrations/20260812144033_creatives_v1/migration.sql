-- CreateEnum
CREATE TYPE "CreativeApproval" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "CreativeGeneration" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "status" "AnalysisStatus" NOT NULL DEFAULT 'QUEUED',
    "instruction" TEXT,
    "offer" TEXT,
    "error" TEXT,
    "model" TEXT,
    "promptTokens" INTEGER,
    "outputTokens" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "CreativeGeneration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Creative" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "generationId" TEXT NOT NULL,
    "approval" "CreativeApproval" NOT NULL DEFAULT 'PENDING',
    "strategy" TEXT NOT NULL,
    "hook" TEXT NOT NULL,
    "primaryText" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "description" TEXT,
    "cta" TEXT NOT NULL,
    "targetNote" TEXT,
    "why" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "editedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Creative_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CreativeGeneration_brandId_createdAt_idx" ON "CreativeGeneration"("brandId", "createdAt");

-- CreateIndex
CREATE INDEX "Creative_brandId_createdAt_idx" ON "Creative"("brandId", "createdAt");

-- AddForeignKey
ALTER TABLE "CreativeGeneration" ADD CONSTRAINT "CreativeGeneration_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Creative" ADD CONSTRAINT "Creative_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Creative" ADD CONSTRAINT "Creative_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "CreativeGeneration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
