/*
  Warnings:

  - A unique constraint covering the columns `[email]` on the table `usuarios` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `email` to the `usuarios` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable: adiciona email com default temporário para linhas existentes
ALTER TABLE "usuarios" ADD COLUMN "email" VARCHAR(255);
UPDATE "usuarios" SET "email" = ra || '@placeholder.local' WHERE "email" IS NULL;
ALTER TABLE "usuarios" ALTER COLUMN "email" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");
