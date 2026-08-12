-- CreateTable
CREATE TABLE "CreativeImage" (
    "id" TEXT NOT NULL,
    "creativeId" TEXT NOT NULL,
    "status" "AnalysisStatus" NOT NULL DEFAULT 'QUEUED',
    "prompt" TEXT NOT NULL,
    "filePath" TEXT,
    "mimeType" TEXT,
    "error" TEXT,
    "model" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "CreativeImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CreativeImage_creativeId_idx" ON "CreativeImage"("creativeId");

-- AddForeignKey
ALTER TABLE "CreativeImage" ADD CONSTRAINT "CreativeImage_creativeId_fkey" FOREIGN KEY ("creativeId") REFERENCES "Creative"("id") ON DELETE CASCADE ON UPDATE CASCADE;
