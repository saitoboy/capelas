-- AlterTable
-- Contagem de tokens gastos por chave dentro da cota diária (TPD) da Groq.
-- tokens_dia guarda o dia (UTC) a que tokens_hoje se refere; quando o dia vira,
-- o serviço zera o contador na próxima chamada.
ALTER TABLE "groq_keys" ADD COLUMN     "tokens_hoje" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tokens_dia" DATE;
