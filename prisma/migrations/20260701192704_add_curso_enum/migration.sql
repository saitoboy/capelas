/*
  Warnings:

  - Changed the type of `curso` on the `usuarios` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "Curso" AS ENUM ('TEOLOGIA');

-- AlterTable
ALTER TABLE "usuarios" DROP COLUMN "curso",
ADD COLUMN     "curso" "Curso" NOT NULL;
