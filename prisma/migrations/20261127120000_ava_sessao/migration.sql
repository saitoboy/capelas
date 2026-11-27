-- Sessão do AVA por usuário: cookies do portal JACAD + Brightspace cifrados em
-- repouso (AES-256-GCM). A senha do portal nunca fica no banco — quando a
-- sessão expira, o usuário reconecta em POST /ava/conectar.
-- CreateTable
CREATE TABLE "ava_sessoes" (
    "id" UUID NOT NULL,
    "aluno_ra" VARCHAR(20) NOT NULL,
    "cookies_enc" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ava_sessoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ava_sessoes_aluno_ra_key" ON "ava_sessoes"("aluno_ra");

-- AddForeignKey
ALTER TABLE "ava_sessoes" ADD CONSTRAINT "ava_sessoes_aluno_ra_fkey" FOREIGN KEY ("aluno_ra") REFERENCES "usuarios"("ra") ON DELETE CASCADE ON UPDATE CASCADE;
