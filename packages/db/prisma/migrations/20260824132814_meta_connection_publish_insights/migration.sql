/*
  Warnings:

  - A unique constraint covering the columns `[planId,periodStart,periodEnd,source]` on the table `CampaignResult` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "MetaConnectionStatus" AS ENUM ('CONNECTED', 'EXPIRED', 'REVOKED', 'DISCONNECTED');

-- CreateEnum
CREATE TYPE "MetaPublishStatus" AS ENUM ('DRAFT', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ResultSource" AS ENUM ('MANUAL', 'CSV', 'META_API');

-- AlterTable
ALTER TABLE "CampaignPlan" ADD COLUMN     "metaAdId" TEXT,
ADD COLUMN     "metaAdSetId" TEXT,
ADD COLUMN     "metaCampaignId" TEXT,
ADD COLUMN     "metaPublishedAt" TIMESTAMP(3),
ADD COLUMN     "metaTargeting" JSONB,
ADD COLUMN     "specialAdCategories" TEXT[];

-- AlterTable
ALTER TABLE "CampaignResult" ADD COLUMN     "externalRef" TEXT,
ADD COLUMN     "source" "ResultSource" NOT NULL DEFAULT 'MANUAL';

-- AlterTable
ALTER TABLE "CompetitorAd" ADD COLUMN     "adArchiveId" TEXT,
ADD COLUMN     "fromAdLibrary" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "libraryMeta" JSONB;

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "maxDailyBudget" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "MetaConnection" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "metaUserId" TEXT NOT NULL,
    "tokenCipher" BYTEA NOT NULL,
    "tokenIv" BYTEA NOT NULL,
    "tokenTag" BYTEA NOT NULL,
    "tokenExpires" TIMESTAMP(3),
    "scopes" TEXT[],
    "status" "MetaConnectionStatus" NOT NULL DEFAULT 'CONNECTED',
    "lastCheckedAt" TIMESTAMP(3),
    "errorNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaAdAccount" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "actId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "timezoneName" TEXT,
    "accountStatus" INTEGER,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetaAdAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandMetaBinding" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "adAccountId" TEXT NOT NULL,
    "adAccountCurrency" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "instagramActorId" TEXT,
    "pixelId" TEXT,
    "catalogId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandMetaBinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaApiCall" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "brandId" TEXT,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "httpStatus" INTEGER,
    "errorCode" INTEGER,
    "errorSub" INTEGER,
    "fbtraceId" TEXT,
    "durationMs" INTEGER NOT NULL,
    "appUsagePct" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetaApiCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaPublish" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "status" "MetaPublishStatus" NOT NULL DEFAULT 'DRAFT',
    "stage" TEXT NOT NULL DEFAULT 'CAMPAIGN',
    "claimedAt" TIMESTAMP(3),
    "metaCampaignId" TEXT,
    "metaAdSetId" TEXT,
    "metaCreativeId" TEXT,
    "metaAdId" TEXT,
    "request" JSONB,
    "response" JSONB,
    "effectiveStatus" TEXT NOT NULL DEFAULT 'PAUSED',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "MetaPublish_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaInsightSync" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "planId" TEXT,
    "adAccountId" TEXT NOT NULL,
    "since" TIMESTAMP(3) NOT NULL,
    "until" TIMESTAMP(3) NOT NULL,
    "status" "AnalysisStatus" NOT NULL DEFAULT 'QUEUED',
    "rowCount" INTEGER,
    "raw" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "MetaInsightSync_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MetaConnection_workspaceId_key" ON "MetaConnection"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "MetaAdAccount_connectionId_actId_key" ON "MetaAdAccount"("connectionId", "actId");

-- CreateIndex
CREATE UNIQUE INDEX "BrandMetaBinding_brandId_key" ON "BrandMetaBinding"("brandId");

-- CreateIndex
CREATE INDEX "MetaApiCall_workspaceId_createdAt_idx" ON "MetaApiCall"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "MetaPublish_planId_createdAt_idx" ON "MetaPublish"("planId", "createdAt");

-- CreateIndex
CREATE INDEX "MetaInsightSync_brandId_createdAt_idx" ON "MetaInsightSync"("brandId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignResult_planId_periodStart_periodEnd_source_key" ON "CampaignResult"("planId", "periodStart", "periodEnd", "source");

-- AddForeignKey
ALTER TABLE "MetaConnection" ADD CONSTRAINT "MetaConnection_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaAdAccount" ADD CONSTRAINT "MetaAdAccount_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "MetaConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandMetaBinding" ADD CONSTRAINT "BrandMetaBinding_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandMetaBinding" ADD CONSTRAINT "BrandMetaBinding_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "MetaConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaPublish" ADD CONSTRAINT "MetaPublish_planId_fkey" FOREIGN KEY ("planId") REFERENCES "CampaignPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaInsightSync" ADD CONSTRAINT "MetaInsightSync_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
