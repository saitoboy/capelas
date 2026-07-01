/*
  Warnings:

  - You are about to drop the column `docx_path` on the `relatorios` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "relatorios" DROP COLUMN "docx_path",
ADD COLUMN     "docx_data" TEXT;
