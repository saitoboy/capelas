import prisma from '../utils/prisma';
import { CapelaPublica, CreateCapelaManualBody } from '../types';
import { logSuccess, logError } from '../utils/logger';
import { collectChapels } from './youtube.service';
import { gerarSinopse } from './sinopse.service';

// ──────────────────────────────────────────────────────────────────────────────

const toPublico = (c: any): CapelaPublica => ({
  id:           c.id,
  semestreId:   c.semestreId,
  indice:       c.indice,
  data:         c.data,
  videoId:      c.videoId,
  url:          c.url,
  textoBiblico: c.textoBiblico,
  tema:         c.tema,
  pregador:     c.pregador,
  source:       c.source,
  createdAt:    c.createdAt,
  sinopse:      c.sinopse ?? null,
});

// ──────────────────────────────────────────────────────────────────────────────

export const criarManual = async (body: CreateCapelaManualBody): Promise<CapelaPublica> => {
  const { semestreId, indice, data, textoBiblico, tema, pregador } = body;

  const semestre = await prisma.semestre.findUnique({ where: { id: semestreId } });
  if (!semestre) {
    const err = new Error('Semestre não encontrado') as any;
    err.status = 404;
    throw err;
  }

  const dataDate = new Date(data);
  if (isNaN(dataDate.getTime())) {
    const err = new Error('Data inválida — use ISO 8601') as any;
    err.status = 400;
    throw err;
  }

  const chapel = await prisma.capela.create({
    data: { semestreId, indice, data: dataDate, textoBiblico, tema, pregador, source: 'manual' },
  });

  logSuccess(`Capela manual criada: semestre=${semestreId} índice=${indice}`, 'capela');
  return toPublico(chapel);
};

// ──────────────────────────────────────────────────────────────────────────────

export const listarPorSemestre = async (semestreId: number): Promise<CapelaPublica[]> => {
  const semestre = await prisma.semestre.findUnique({ where: { id: semestreId } });
  if (!semestre) {
    const err = new Error('Semestre não encontrado') as any;
    err.status = 404;
    throw err;
  }

  const capelas = await prisma.capela.findMany({
    where: { semestreId },
    orderBy: { indice: 'asc' },
    include: { sinopse: true },
  });

  return capelas.map(toPublico);
};

// ──────────────────────────────────────────────────────────────────────────────

export const buscarCapelaPorId = async (id: number): Promise<CapelaPublica> => {
  const capela = await prisma.capela.findUnique({
    where: { id },
    include: { sinopse: true },
  });

  if (!capela) {
    const err = new Error('Capela não encontrada') as any;
    err.status = 404;
    throw err;
  }

  return toPublico(capela);
};

// ──────────────────────────────────────────────────────────────────────────────

export const deletarCapela = async (id: number): Promise<void> => {
  const existe = await prisma.capela.findUnique({ where: { id } });
  if (!existe) {
    const err = new Error('Capela não encontrada') as any;
    err.status = 404;
    throw err;
  }

  await prisma.capela.delete({ where: { id } });
  logSuccess(`Capela deletada: id=${id}`, 'capela');
};

// ──────────────────────────────────────────────────────────────────────────────

export interface ColetarResult {
  inseridas:  number;
  atualizadas: number;
  erros:      { indice: number; motivo: string }[];
}

export const coletarDoYoutube = async (semestreId: number): Promise<ColetarResult> => {
  const semestre = await prisma.semestre.findUnique({ where: { id: semestreId } });
  if (!semestre) {
    const err = new Error('Semestre não encontrado') as any;
    err.status = 404;
    throw err;
  }

  const after  = semestre.publishedAfter.toISOString();
  const before = semestre.publishedBefore.toISOString();

  const chapels = await collectChapels(after, before);

  const result: ColetarResult = { inseridas: 0, atualizadas: 0, erros: [] };

  for (const c of chapels) {
    try {
      const existing = await prisma.capela.findUnique({
        where: { videoId: c.videoId },
      });

      const data = {
        semestreId,
        indice:       c.indice,
        data:         new Date(c.dataISO),
        videoId:      c.videoId,
        url:          c.url,
        textoBiblico: c.textoBiblico,
        tema:         c.tema,
        pregador:     c.pregador,
        source:       'youtube',
      };

      const chapel = await prisma.capela.upsert({
        where:  { videoId: c.videoId },
        update: { textoBiblico: data.textoBiblico, tema: data.tema, pregador: data.pregador, url: data.url },
        create: data,
      });

      if (existing) {
        result.atualizadas++;
      } else {
        result.inseridas++;
        // gera sinopse apenas para capelas novas
        await gerarSinopse(chapel.id);
      }
    } catch (err: any) {
      logError(`Erro ao processar índice ${c.indice}: ${err.message}`, 'chapel');
      result.erros.push({ indice: c.indice, motivo: err.message });
    }
  }

  logSuccess(
    `Coleta concluída — inseridas: ${result.inseridas}, atualizadas: ${result.atualizadas}, erros: ${result.erros.length}`,
    'chapel',
  );
  return result;
};
