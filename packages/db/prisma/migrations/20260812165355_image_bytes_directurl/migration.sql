/*
  Warnings:

  - You are about to drop the column `filePath` on the `CreativeImage` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "CreativeImage" DROP COLUMN "filePath",
ADD COLUMN     "data" BYTEA;
