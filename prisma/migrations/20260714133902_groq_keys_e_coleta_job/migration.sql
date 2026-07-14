-- CreateTable
CREATE TABLE "coletas" (
    "id" TEXT NOT NULL,
    "semestre_id" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'GERANDO',
    "etapa" VARCHAR(160),
    "total" INTEGER NOT NULL DEFAULT 0,
    "processadas" INTEGER NOT NULL DEFAULT 0,
    "inseridas" INTEGER NOT NULL DEFAULT 0,
    "atualizadas" INTEGER NOT NULL DEFAULT 0,
    "ignorados" INTEGER NOT NULL DEFAULT 0,
    "itens" JSONB,
    "erro_msg" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coletas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "groq_keys" (
    "id" TEXT NOT NULL,
    "label" VARCHAR(60) NOT NULL,
    "key_enc" TEXT NOT NULL,
    "preview" VARCHAR(20) NOT NULL,
    "status" VARCHAR(12) NOT NULL DEFAULT 'ATIVA',
    "reset_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "erro_msg" TEXT,
    "criado_por" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "groq_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "coletas_semestre_id_idx" ON "coletas"("semestre_id");

-- CreateIndex
CREATE INDEX "groq_keys_status_last_used_at_idx" ON "groq_keys"("status", "last_used_at");

-- AddForeignKey
ALTER TABLE "coletas" ADD CONSTRAINT "coletas_semestre_id_fkey" FOREIGN KEY ("semestre_id") REFERENCES "semestres"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groq_keys" ADD CONSTRAINT "groq_keys_criado_por_fkey" FOREIGN KEY ("criado_por") REFERENCES "usuarios"("ra") ON DELETE CASCADE ON UPDATE CASCADE;
