import prisma from '../utils/prisma';
import { CreateSemestreBody, SemestrePublico } from '../types';
import { logSuccess } from '../utils/logger';

// ──────────────────────────────────────────────────────────────────────────────

export const criarSemestre = async (body: CreateSemestreBody): Promise<SemestrePublico> => {
  const { label, publishedAfter, publishedBefore } = body;

  const after  = new Date(publishedAfter);
  const before = new Date(publishedBefore);

  if (isNaN(after.getTime()) || isNaN(before.getTime())) {
    const err = new Error('Datas inválidas — use ISO 8601') as any;
    err.status = 400;
    throw err;
  }

  if (after >= before) {
    const err = new Error('publishedAfter deve ser anterior a publishedBefore') as any;
    err.status = 400;
    throw err;
  }

  const semestre = await prisma.semestre.create({
    data: { label, publishedAfter: after, publishedBefore: before },
  });

  logSuccess(`Semestre criado: ${label}`, 'semestre');
  return semestre;
};

// ──────────────────────────────────────────────────────────────────────────────

export const listarSemestres = async (): Promise<SemestrePublico[]> => {
  return prisma.semestre.findMany({ orderBy: { publishedAfter: 'desc' } });
};

// ──────────────────────────────────────────────────────────────────────────────

export const buscarSemestrePorId = async (id: string): Promise<SemestrePublico> => {
  const semestre = await prisma.semestre.findUnique({ where: { id } });

  if (!semestre) {
    const err = new Error('Semestre não encontrado') as any;
    err.status = 404;
    throw err;
  }

  return semestre;
};

// ──────────────────────────────────────────────────────────────────────────────

export const ativarSemestre = async (id: string): Promise<SemestrePublico> => {
  const existe = await prisma.semestre.findUnique({ where: { id } });
  if (!existe) {
    const err = new Error('Semestre não encontrado') as any;
    err.status = 404;
    throw err;
  }

  // Garante somente 1 ativo por vez
  await prisma.semestre.updateMany({ data: { ativo: false } });
  const semestre = await prisma.semestre.update({
    where: { id },
    data: { ativo: true },
  });

  logSuccess(`Semestre ativado: ${semestre.label}`, 'semestre');
  return semestre;
};

// ──────────────────────────────────────────────────────────────────────────────

export const buscarSemestreAtivo = async (): Promise<SemestrePublico> => {
  const semestre = await prisma.semestre.findFirst({ where: { ativo: true } });

  if (!semestre) {
    const err = new Error('Nenhum semestre ativo no momento') as any;
    err.status = 404;
    throw err;
  }

  return semestre;
};
