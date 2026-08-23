-- CreateEnum
CREATE TYPE "EvolutionStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EvolutionStage" AS ENUM ('GENERATE', 'LINT', 'JUDGE', 'SELECT', 'DONE');

-- CreateEnum
CREATE TYPE "CandidateOrigin" AS ENUM ('SEED', 'MUTATION', 'CROSSOVER', 'ELITE');

-- CreateEnum
CREATE TYPE "BrandAssetKind" AS ENUM ('LOGO', 'PRODUCT_IMAGE', 'OTHER');

-- AlterTable
ALTER TABLE "Brand" ADD COLUMN     "brandVoice" TEXT,
ADD COLUMN     "products" JSONB,
ADD COLUMN     "usp" TEXT;

-- AlterTable
ALTER TABLE "CampaignPlan" ADD COLUMN     "publishNote" TEXT,
ADD COLUMN     "publishedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "EvolutionRun" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "status" "EvolutionStatus" NOT NULL DEFAULT 'QUEUED',
    "goal" TEXT NOT NULL,
    "offer" TEXT,
    "instruction" TEXT,
    "config" JSONB NOT NULL,
    "currentRound" INTEGER NOT NULL DEFAULT 0,
    "maxRounds" INTEGER NOT NULL,
    "winnerCreativeId" TEXT,
    "summary" JSONB,
    "error" TEXT,
    "model" TEXT,
    "promptTokens" INTEGER,
    "outputTokens" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "EvolutionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvolutionRound" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "stage" "EvolutionStage" NOT NULL DEFAULT 'GENERATE',
    "judgeInput" JSONB,
    "judgeOutput" JSONB,
    "claimedAt" TIMESTAMP(3),
    "generateAttempts" INTEGER NOT NULL DEFAULT 0,
    "promptTokens" INTEGER,
    "outputTokens" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "EvolutionRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvolutionCandidate" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "parentId" TEXT,
    "origin" "CandidateOrigin" NOT NULL,
    "strategy" TEXT NOT NULL,
    "hook" TEXT NOT NULL,
    "primaryText" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "description" TEXT,
    "cta" TEXT NOT NULL,
    "targetNote" TEXT,
    "why" TEXT NOT NULL,
    "lintScore" INTEGER NOT NULL,
    "lintIssues" JSONB NOT NULL,
    "judgeScore" DECIMAL(5,2),
    "judgeBreakdown" JSONB,
    "totalScore" DECIMAL(5,2),
    "rank" INTEGER,
    "survived" BOOLEAN NOT NULL DEFAULT false,
    "eliminatedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvolutionCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublishKit" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "kit" JSONB NOT NULL,
    "checklist" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublishKit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandAsset" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "kind" "BrandAssetKind" NOT NULL,
    "name" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrandAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EvolutionRun_brandId_createdAt_idx" ON "EvolutionRun"("brandId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EvolutionRound_runId_index_key" ON "EvolutionRound"("runId", "index");

-- CreateIndex
CREATE INDEX "EvolutionCandidate_runId_roundId_idx" ON "EvolutionCandidate"("runId", "roundId");

-- CreateIndex
CREATE INDEX "PublishKit_planId_idx" ON "PublishKit"("planId");

-- CreateIndex
CREATE INDEX "BrandAsset_brandId_idx" ON "BrandAsset"("brandId");

-- AddForeignKey
ALTER TABLE "EvolutionRun" ADD CONSTRAINT "EvolutionRun_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvolutionRound" ADD CONSTRAINT "EvolutionRound_runId_fkey" FOREIGN KEY ("runId") REFERENCES "EvolutionRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvolutionCandidate" ADD CONSTRAINT "EvolutionCandidate_runId_fkey" FOREIGN KEY ("runId") REFERENCES "EvolutionRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvolutionCandidate" ADD CONSTRAINT "EvolutionCandidate_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "EvolutionRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishKit" ADD CONSTRAINT "PublishKit_planId_fkey" FOREIGN KEY ("planId") REFERENCES "CampaignPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandAsset" ADD CONSTRAINT "BrandAsset_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
