-- CreateEnum
CREATE TYPE "CompetitorType" AS ENUM ('DIRECT', 'INDIRECT', 'ASPIRATIONAL', 'CREATIVE');

-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "Competitor" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT,
    "type" "CompetitorType" NOT NULL,
    "note" TEXT,
    "addedFrom" TEXT NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Competitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitorAd" (
    "id" TEXT NOT NULL,
    "competitorId" TEXT NOT NULL,
    "inputText" TEXT NOT NULL,
    "inputUrl" TEXT,
    "status" "AnalysisStatus" NOT NULL DEFAULT 'QUEUED',
    "analysis" JSONB,
    "error" TEXT,
    "model" TEXT,
    "promptTokens" INTEGER,
    "outputTokens" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "CompetitorAd_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatternAnalysis" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "status" "AnalysisStatus" NOT NULL DEFAULT 'QUEUED',
    "adCount" INTEGER NOT NULL,
    "result" JSONB,
    "error" TEXT,
    "model" TEXT,
    "promptTokens" INTEGER,
    "outputTokens" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "PatternAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Competitor_brandId_idx" ON "Competitor"("brandId");

-- CreateIndex
CREATE INDEX "CompetitorAd_competitorId_idx" ON "CompetitorAd"("competitorId");

-- CreateIndex
CREATE INDEX "PatternAnalysis_brandId_createdAt_idx" ON "PatternAnalysis"("brandId", "createdAt");

-- AddForeignKey
ALTER TABLE "Competitor" ADD CONSTRAINT "Competitor_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorAd" ADD CONSTRAINT "CompetitorAd_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "Competitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatternAnalysis" ADD CONSTRAINT "PatternAnalysis_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
