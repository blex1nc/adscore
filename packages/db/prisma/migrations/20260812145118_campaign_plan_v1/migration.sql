-- CreateEnum
CREATE TYPE "BudgetType" AS ENUM ('DAILY', 'LIFETIME');

-- CreateTable
CREATE TABLE "CampaignPlan" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "status" "AnalysisStatus" NOT NULL DEFAULT 'QUEUED',
    "goal" TEXT NOT NULL,
    "budgetType" "BudgetType" NOT NULL,
    "budgetAmount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "durationDays" INTEGER,
    "notes" TEXT,
    "result" JSONB,
    "error" TEXT,
    "model" TEXT,
    "promptTokens" INTEGER,
    "outputTokens" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "CampaignPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_PlanCreatives" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_PlanCreatives_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "CampaignPlan_brandId_createdAt_idx" ON "CampaignPlan"("brandId", "createdAt");

-- CreateIndex
CREATE INDEX "_PlanCreatives_B_index" ON "_PlanCreatives"("B");

-- AddForeignKey
ALTER TABLE "CampaignPlan" ADD CONSTRAINT "CampaignPlan_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PlanCreatives" ADD CONSTRAINT "_PlanCreatives_A_fkey" FOREIGN KEY ("A") REFERENCES "CampaignPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PlanCreatives" ADD CONSTRAINT "_PlanCreatives_B_fkey" FOREIGN KEY ("B") REFERENCES "Creative"("id") ON DELETE CASCADE ON UPDATE CASCADE;
