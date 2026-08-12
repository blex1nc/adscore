-- CreateTable
CREATE TABLE "CampaignResult" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "spend" DECIMAL(12,2) NOT NULL,
    "impressions" INTEGER NOT NULL,
    "clicks" INTEGER NOT NULL,
    "reach" INTEGER,
    "purchases" INTEGER,
    "revenue" DECIMAL(12,2),
    "notes" TEXT,
    "analysisStatus" "AnalysisStatus",
    "analysis" JSONB,
    "analysisError" TEXT,
    "model" TEXT,
    "promptTokens" INTEGER,
    "outputTokens" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Learning" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "sampleNote" TEXT NOT NULL,
    "sourceResultId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Learning_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CampaignResult_planId_createdAt_idx" ON "CampaignResult"("planId", "createdAt");

-- CreateIndex
CREATE INDEX "Learning_brandId_createdAt_idx" ON "Learning"("brandId", "createdAt");

-- AddForeignKey
ALTER TABLE "CampaignResult" ADD CONSTRAINT "CampaignResult_planId_fkey" FOREIGN KEY ("planId") REFERENCES "CampaignPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Learning" ADD CONSTRAINT "Learning_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
