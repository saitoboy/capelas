-- AlterTable
ALTER TABLE "capelas" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "texto_biblico" DROP NOT NULL,
ALTER COLUMN "tema" DROP NOT NULL,
ALTER COLUMN "pregador" DROP NOT NULL;

-- Backfill: o placeholder "(não encontrado)" era gravado como se fosse dado
-- real, e não havia como distinguir "a IA não achou" de um valor legítimo.
-- Agora a ausência é NULL, que é o sinal de "falta preencher à mão".
UPDATE "capelas" SET "texto_biblico" = NULL WHERE "texto_biblico" = '(não encontrado)';
UPDATE "capelas" SET "tema"          = NULL WHERE "tema"          = '(não encontrado)';
UPDATE "capelas" SET "pregador"      = NULL WHERE "pregador"      = '(não encontrado)';
