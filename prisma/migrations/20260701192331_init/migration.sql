-- CreateTable
CREATE TABLE "usuarios" (
    "ra" VARCHAR(20) NOT NULL,
    "nome" VARCHAR(200) NOT NULL,
    "senha_hash" VARCHAR(255) NOT NULL,
    "curso" VARCHAR(100) NOT NULL,
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("ra")
);

-- CreateTable
CREATE TABLE "personas" (
    "id" SERIAL NOT NULL,
    "aluno_ra" VARCHAR(20) NOT NULL,
    "tipo" CHAR(4) NOT NULL,
    "nome" VARCHAR(100) NOT NULL,
    "tom" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "personas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "semestres" (
    "id" SERIAL NOT NULL,
    "label" VARCHAR(50) NOT NULL,
    "published_after" TIMESTAMP(3) NOT NULL,
    "published_before" TIMESTAMP(3) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "semestres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capelas" (
    "id" SERIAL NOT NULL,
    "semestre_id" INTEGER NOT NULL,
    "indice" INTEGER NOT NULL,
    "data" DATE NOT NULL,
    "video_id" VARCHAR(20),
    "url" VARCHAR(100),
    "texto_biblico" VARCHAR(200) NOT NULL,
    "tema" VARCHAR(400) NOT NULL,
    "pregador" VARCHAR(200) NOT NULL,
    "source" VARCHAR(20) NOT NULL DEFAULT 'youtube',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "capelas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sinopses" (
    "id" SERIAL NOT NULL,
    "capela_id" INTEGER NOT NULL,
    "texto" TEXT NOT NULL,
    "gerado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sinopses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relatorios" (
    "id" SERIAL NOT NULL,
    "aluno_ra" VARCHAR(20) NOT NULL,
    "semestre_id" INTEGER NOT NULL,
    "persona_tipo" CHAR(4) NOT NULL,
    "persona_nome" VARCHAR(100) NOT NULL,
    "foco_criativo" VARCHAR(30),
    "reflexao_teologica" TEXT,
    "analise_liturgica" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDENTE',
    "erro_msg" TEXT,
    "docx_path" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "relatorios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "personas_aluno_ra_key" ON "personas"("aluno_ra");

-- CreateIndex
CREATE UNIQUE INDEX "semestres_label_key" ON "semestres"("label");

-- CreateIndex
CREATE UNIQUE INDEX "capelas_semestre_id_indice_key" ON "capelas"("semestre_id", "indice");

-- CreateIndex
CREATE UNIQUE INDEX "sinopses_capela_id_key" ON "sinopses"("capela_id");

-- CreateIndex
CREATE UNIQUE INDEX "relatorios_aluno_ra_semestre_id_key" ON "relatorios"("aluno_ra", "semestre_id");

-- AddForeignKey
ALTER TABLE "personas" ADD CONSTRAINT "personas_aluno_ra_fkey" FOREIGN KEY ("aluno_ra") REFERENCES "usuarios"("ra") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capelas" ADD CONSTRAINT "capelas_semestre_id_fkey" FOREIGN KEY ("semestre_id") REFERENCES "semestres"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sinopses" ADD CONSTRAINT "sinopses_capela_id_fkey" FOREIGN KEY ("capela_id") REFERENCES "capelas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relatorios" ADD CONSTRAINT "relatorios_aluno_ra_fkey" FOREIGN KEY ("aluno_ra") REFERENCES "usuarios"("ra") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relatorios" ADD CONSTRAINT "relatorios_semestre_id_fkey" FOREIGN KEY ("semestre_id") REFERENCES "semestres"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
