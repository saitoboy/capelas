-- Migration: Change all integer PKs/FKs to UUID (TEXT)
-- Data migration: generates UUIDs for existing rows and propagates to FKs.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Step 1: Add UUID columns ─────────────────────────────────────────────────

ALTER TABLE "personas"   ADD COLUMN "id_new"          TEXT;
ALTER TABLE "semestres"  ADD COLUMN "id_new"          TEXT;
ALTER TABLE "capelas"    ADD COLUMN "id_new"          TEXT;
ALTER TABLE "capelas"    ADD COLUMN "semestre_id_new" TEXT;
ALTER TABLE "sinopses"   ADD COLUMN "id_new"          TEXT;
ALTER TABLE "sinopses"   ADD COLUMN "capela_id_new"   TEXT;
ALTER TABLE "relatorios" ADD COLUMN "id_new"          TEXT;
ALTER TABLE "relatorios" ADD COLUMN "semestre_id_new" TEXT;

-- ─── Step 2: Generate UUIDs for each existing row ─────────────────────────────

UPDATE "personas"   SET "id_new" = gen_random_uuid()::TEXT;
UPDATE "semestres"  SET "id_new" = gen_random_uuid()::TEXT;
UPDATE "capelas"    SET "id_new" = gen_random_uuid()::TEXT;
UPDATE "sinopses"   SET "id_new" = gen_random_uuid()::TEXT;
UPDATE "relatorios" SET "id_new" = gen_random_uuid()::TEXT;

-- ─── Step 3: Propagate UUIDs into FK columns ──────────────────────────────────

UPDATE "capelas" c
SET "semestre_id_new" = s."id_new"
FROM "semestres" s
WHERE c."semestre_id" = s."id";

UPDATE "sinopses" sn
SET "capela_id_new" = c."id_new"
FROM "capelas" c
WHERE sn."capela_id" = c."id";

UPDATE "relatorios" r
SET "semestre_id_new" = s."id_new"
FROM "semestres" s
WHERE r."semestre_id" = s."id";

-- ─── Step 4: Drop FK constraints and indexes on old int columns ───────────────

ALTER TABLE "capelas"    DROP CONSTRAINT "capelas_semestre_id_fkey";
ALTER TABLE "sinopses"   DROP CONSTRAINT "sinopses_capela_id_fkey";
ALTER TABLE "relatorios" DROP CONSTRAINT "relatorios_semestre_id_fkey";

DROP INDEX IF EXISTS "capelas_semestre_id_indice_key";
DROP INDEX IF EXISTS "sinopses_capela_id_key";
DROP INDEX IF EXISTS "relatorios_aluno_ra_semestre_id_key";

-- ─── Step 5: Swap personas.id ─────────────────────────────────────────────────

ALTER TABLE "personas" DROP CONSTRAINT "personas_pkey";
ALTER TABLE "personas" DROP COLUMN "id";
ALTER TABLE "personas" RENAME COLUMN "id_new" TO "id";
ALTER TABLE "personas" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE "personas" ADD CONSTRAINT "personas_pkey" PRIMARY KEY ("id");

-- ─── Step 6: Swap semestres.id ────────────────────────────────────────────────

ALTER TABLE "semestres" DROP CONSTRAINT "semestres_pkey";
ALTER TABLE "semestres" DROP COLUMN "id";
ALTER TABLE "semestres" RENAME COLUMN "id_new" TO "id";
ALTER TABLE "semestres" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE "semestres" ADD CONSTRAINT "semestres_pkey" PRIMARY KEY ("id");

-- ─── Step 7: Swap capelas.id and capelas.semestre_id ──────────────────────────

ALTER TABLE "capelas" DROP CONSTRAINT "capelas_pkey";
ALTER TABLE "capelas" DROP COLUMN "id";
ALTER TABLE "capelas" RENAME COLUMN "id_new" TO "id";
ALTER TABLE "capelas" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE "capelas" ADD CONSTRAINT "capelas_pkey" PRIMARY KEY ("id");

ALTER TABLE "capelas" DROP COLUMN "semestre_id";
ALTER TABLE "capelas" RENAME COLUMN "semestre_id_new" TO "semestre_id";
ALTER TABLE "capelas" ALTER COLUMN "semestre_id" SET NOT NULL;
ALTER TABLE "capelas" ADD CONSTRAINT "capelas_semestre_id_fkey"
  FOREIGN KEY ("semestre_id") REFERENCES "semestres"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "capelas_semestre_id_indice_key" ON "capelas"("semestre_id", "indice");

-- ─── Step 8: Swap sinopses.id and sinopses.capela_id ─────────────────────────

ALTER TABLE "sinopses" DROP CONSTRAINT "sinopses_pkey";
ALTER TABLE "sinopses" DROP COLUMN "id";
ALTER TABLE "sinopses" RENAME COLUMN "id_new" TO "id";
ALTER TABLE "sinopses" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE "sinopses" ADD CONSTRAINT "sinopses_pkey" PRIMARY KEY ("id");

ALTER TABLE "sinopses" DROP COLUMN "capela_id";
ALTER TABLE "sinopses" RENAME COLUMN "capela_id_new" TO "capela_id";
ALTER TABLE "sinopses" ALTER COLUMN "capela_id" SET NOT NULL;
CREATE UNIQUE INDEX "sinopses_capela_id_key" ON "sinopses"("capela_id");
ALTER TABLE "sinopses" ADD CONSTRAINT "sinopses_capela_id_fkey"
  FOREIGN KEY ("capela_id") REFERENCES "capelas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Step 9: Swap relatorios.id and relatorios.semestre_id ───────────────────

ALTER TABLE "relatorios" DROP CONSTRAINT "relatorios_pkey";
ALTER TABLE "relatorios" DROP COLUMN "id";
ALTER TABLE "relatorios" RENAME COLUMN "id_new" TO "id";
ALTER TABLE "relatorios" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE "relatorios" ADD CONSTRAINT "relatorios_pkey" PRIMARY KEY ("id");

ALTER TABLE "relatorios" DROP COLUMN "semestre_id";
ALTER TABLE "relatorios" RENAME COLUMN "semestre_id_new" TO "semestre_id";
ALTER TABLE "relatorios" ALTER COLUMN "semestre_id" SET NOT NULL;
ALTER TABLE "relatorios" ADD CONSTRAINT "relatorios_semestre_id_fkey"
  FOREIGN KEY ("semestre_id") REFERENCES "semestres"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "relatorios_aluno_ra_semestre_id_key" ON "relatorios"("aluno_ra", "semestre_id");
