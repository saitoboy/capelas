import prisma from '../utils/prisma';
import {
  CapelaPublica,
  CreateCapelaManualBody,
  UpdateCapelaBody,
  ColetarCapelasBody,
  ColetaPublica,
  ColetaItem,
} from '../types';
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
    data: {
      semestreId,
      indice,
      data:         dataDate,
      textoBiblico: normalizar(textoBiblico),
      tema:         normalizar(tema),
      pregador:     normalizar(pregador),
      source:       'manual',
    },
  });

  logSuccess(`Capela manual criada: semestre=${semestreId} índice=${indice}`, 'capela');
  return toPublico(chapel);
};

// ──────────────────────────────────────────────────────────────────────────────

export const listarPorSemestre = async (semestreId: string): Promise<CapelaPublica[]> => {
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

export const buscarCapelaPorId = async (id: string): Promise<CapelaPublica> => {
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

/**
 * Edição manual dos campos que a IA não conseguiu extrair.
 * Só mexe no que veio no body — omitir um campo o deixa como está.
 * Mandar `null` explicitamente limpa o campo.
 */
export const editarCapela = async (
  id: string,
  body: UpdateCapelaBody,
): Promise<CapelaPublica> => {
  const existe = await prisma.capela.findUnique({ where: { id } });
  if (!existe) {
    const err = new Error('Capela não encontrada') as any;
    err.status = 404;
    throw err;
  }

  const data: Record<string, unknown> = {};

  if ('textoBiblico' in body) data.textoBiblico = normalizar(body.textoBiblico);
  if ('tema'         in body) data.tema         = normalizar(body.tema);
  if ('pregador'     in body) data.pregador     = normalizar(body.pregador);

  if ('data' in body && body.data) {
    const d = new Date(body.data);
    if (isNaN(d.getTime())) {
      const err = new Error('Data inválida — use ISO 8601') as any;
      err.status = 400;
      throw err;
    }
    data.data = d;
  }

  if (Object.keys(data).length === 0) {
    const err = new Error('Nada para atualizar. Envie ao menos um campo: textoBiblico, tema, pregador ou data.') as any;
    err.status = 400;
    throw err;
  }

  const capela = await prisma.capela.update({
    where:   { id },
    data,
    include: { sinopse: true },
  });

  logSuccess(`Capela editada à mão: id=${id} campos=${Object.keys(data).join(', ')}`, 'capela');
  return toPublico(capela);
};

/** String vazia ou só espaços vira null — "preenchido em branco" é o mesmo que vazio. */
const normalizar = (v: string | null | undefined): string | null => {
  if (v === null || v === undefined) return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
};

/** Quais campos ainda faltam preencher à mão. */
const camposFaltando = (c: { textoBiblico: string | null; tema: string | null; pregador: string | null }): string[] => {
  const faltando: string[] = [];
  if (!c.textoBiblico) faltando.push('textoBiblico');
  if (!c.tema)         faltando.push('tema');
  if (!c.pregador)     faltando.push('pregador');
  return faltando;
};

/** Sem tema nem texto bíblico, a IA não tem do que escrever a sinopse — inventaria. */
const temDadosParaSinopse = (c: { textoBiblico: string | null; tema: string | null }): boolean =>
  Boolean(c.tema || c.textoBiblico);

// ──────────────────────────────────────────────────────────────────────────────

export const deletarCapela = async (id: string): Promise<void> => {
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

// ──────────────────────────────────────────────────────────────────────────────
// COLETA — job em background
//
// A coleta faz ~3 chamadas de IA por capela e passa de 40 num semestre inteiro:
// não cabe num request HTTP. Então o POST cria o registro, responde na hora, e
// o processamento roda em `setImmediate` — mesmo padrão do Relatorio. O front
// acompanha por polling em `buscarColeta`.
// ──────────────────────────────────────────────────────────────────────────────

const coletaToPublico = (c: any): ColetaPublica => ({
  id:          c.id,
  semestreId:  c.semestreId,
  status:      c.status,
  etapa:       c.etapa,
  total:       c.total,
  processadas: c.processadas,
  inseridas:   c.inseridas,
  atualizadas: c.atualizadas,
  ignorados:   c.ignorados,
  itens:       (c.itens as ColetaItem[]) ?? [],
  erroMsg:     c.erroMsg,
  createdAt:   c.createdAt,
  updatedAt:   c.updatedAt,
});

export const buscarColeta = async (id: string): Promise<ColetaPublica> => {
  const coleta = await prisma.coleta.findUnique({ where: { id } });
  if (!coleta) {
    const err = new Error('Coleta não encontrada') as any;
    err.status = 404;
    throw err;
  }
  return coletaToPublico(coleta);
};

/**
 * Coletas de um semestre, da mais recente para a mais antiga.
 *
 * Sem isto, o front só acompanharia uma coleta se tivesse guardado o id que o
 * POST devolveu: abrir a tela noutro navegador perderia de vista um job que
 * continua rodando no servidor.
 */
export const listarColetas = async (semestreId: string): Promise<ColetaPublica[]> => {
  const coletas = await prisma.coleta.findMany({
    where:   { semestreId },
    orderBy: { createdAt: 'desc' },
  });

  return coletas.map(coletaToPublico);
};

/**
 * Cria o registro da coleta e dispara o processamento em background.
 * Responde imediatamente — o chamador devolve 202.
 */
export const iniciarColeta = async (body: ColetarCapelasBody): Promise<ColetaPublica> => {
  const { semestreId } = body;

  const semestre = await prisma.semestre.findUnique({ where: { id: semestreId } });
  if (!semestre) {
    const err = new Error('Semestre não encontrado') as any;
    err.status = 404;
    throw err;
  }

  // Uma coleta por semestre de cada vez — duas em paralelo brigariam pelo mesmo
  // upsert de videoId e gastariam token à toa.
  const emAndamento = await prisma.coleta.findFirst({
    where: { semestreId, status: 'GERANDO' },
  });
  if (emAndamento) {
    const err = new Error('Já existe uma coleta em andamento para este semestre.') as any;
    err.status = 409;
    throw err;
  }

  const publishedAfter  = body.publishedAfter  ?? semestre.publishedAfter.toISOString();
  const publishedBefore = body.publishedBefore ?? semestre.publishedBefore.toISOString();

  if (isNaN(new Date(publishedAfter).getTime()) || isNaN(new Date(publishedBefore).getTime())) {
    const err = new Error('Datas inválidas — use ISO 8601') as any;
    err.status = 400;
    throw err;
  }

  const coleta = await prisma.coleta.create({
    data: { semestreId, status: 'GERANDO', etapa: 'Na fila…' },
  });

  logSuccess(`Coleta enfileirada: semestre=${semestreId}`, 'chapel');

  // Não bloqueia a resposta HTTP.
  setImmediate(() => {
    processarColeta(coleta.id, {
      semestreId,
      publishedAfter:  new Date(publishedAfter).toISOString(),
      publishedBefore: new Date(publishedBefore).toISOString(),
      canal:         body.canal,
      keyword:       body.keyword,
      weekday:       body.weekday,
      gerarSinopses: body.gerarSinopses ?? true,
    });
  });

  return coletaToPublico(coleta);
};

// ──────────────────────────────────────────────────────────────────────────────

interface ProcessarOpts {
  semestreId:      string;
  publishedAfter:  string;
  publishedBefore: string;
  canal?:          string;
  keyword?:        string;
  weekday?:        number;
  gerarSinopses:   boolean;
}

/**
 * Numera as capelas do semestre pela data (1, 2, 3…). Uma capela nova pode cair
 * no meio do semestre, e o índice é único por semestre — então passa tudo por
 * negativos antes, para nenhuma troca colidir no meio do caminho.
 */
async function renumerarPorData(semestreId: string): Promise<Map<string, number>> {
  const capelas = await prisma.capela.findMany({
    where:   { semestreId },
    orderBy: [{ data: 'asc' }, { createdAt: 'asc' }],
    select:  { id: true },
  });

  await prisma.$transaction([
    ...capelas.map((c, i) => prisma.capela.update({ where: { id: c.id }, data: { indice: -(i + 1) } })),
    ...capelas.map((c, i) => prisma.capela.update({ where: { id: c.id }, data: { indice: i + 1 } })),
  ]);

  return new Map(capelas.map((c, i) => [c.id, i + 1]));
}

async function processarColeta(coletaId: string, opts: ProcessarOpts): Promise<void> {
  const itens: (ColetaItem & { capelaId?: string })[] = [];
  let inseridas = 0;
  // A coleta só cria: capela já salva (por vídeo ou pela data, caso das
  // lançadas à mão) não é tocada. `atualizadas` passa a contar essas puladas.
  let existentes = 0;

  const salvas = await prisma.capela.findMany({
    where:  { semestreId: opts.semestreId },
    select: { videoId: true, data: true },
  });
  const videos = new Set(salvas.map((c) => c.videoId).filter(Boolean));
  const datas  = new Set(salvas.map((c) => c.data.toISOString().slice(0, 10)));

  try {
    const coletado = await collectChapels({
      publishedAfter:  opts.publishedAfter,
      publishedBefore: opts.publishedBefore,
      canal:   opts.canal,
      keyword: opts.keyword,
      weekday: opts.weekday,
      jaExiste: (videoId, dataISO) => videos.has(videoId) || datas.has(dataISO),

      // Grava o progresso a cada capela — é o que o polling do front lê.
      onProgress: async ({ etapa, processadas, total }) => {
        await prisma.coleta.update({
          where: { id: coletaId },
          data:  { etapa, processadas, total },
        });
      },
    });
    const { chapels, ignorados } = coletado;
    existentes = coletado.existentes;

    await prisma.coleta.update({
      where: { id: coletaId },
      data:  { ignorados, atualizadas: existentes, total: chapels.length, etapa: 'Salvando as capelas…' },
    });

    for (const [n, c] of chapels.entries()) {
      try {
        // Índice provisório fora da faixa usada; renumerarPorData acerta no fim.
        const chapel = await prisma.capela.create({
          data: {
            semestreId:   opts.semestreId,
            indice:       100000 + n,
            data:         new Date(c.dataISO),
            videoId:      c.videoId,
            url:          c.url,
            textoBiblico: c.textoBiblico,
            tema:         c.tema,
            pregador:     c.pregador,
            source:       'youtube',
          },
        });
        inseridas++;

        // Sem nenhum dado extraído, a sinopse sairia inventada. Espera o
        // admin preencher à mão e gerar depois.
        if (opts.gerarSinopses && temDadosParaSinopse(chapel)) {
          await gerarSinopse(chapel.id);
        }

        itens.push({
          capelaId:  chapel.id,
          indice:    c.indice,
          tema:      c.tema,
          source:    c._source,
          faltando:  camposFaltando(c),
        });
      } catch (err: any) {
        logError(`Erro ao processar ${c.data}: ${err.message}`, 'chapel');
        itens.push({
          indice:   c.indice,
          tema:     c.tema,
          source:   c._source,
          faltando: camposFaltando(c),
          erro:     err.message,
        });
      }

      await prisma.coleta.update({
        where: { id: coletaId },
        data:  { inseridas, itens: itens as any },
      });
    }

    await prisma.coleta.update({
      where: { id: coletaId },
      data: {
        status:      'CONCLUIDO',
        etapa:       null,
        processadas: chapels.length,
        inseridas,
        itens:       await comIndiceFinal(opts.semestreId, itens),
      },
    });

    logSuccess(
      `Coleta concluída — novas: ${inseridas}, já salvas: ${existentes}, ignorados: ${ignorados}`,
      'chapel',
    );
  } catch (err: any) {
    // O que já foi salvo continua salvo. "Coletar de novo" retoma: as capelas
    // salvas são puladas, então só o que faltou é buscado.
    logError(`Coleta falhou: ${err.message}`, 'chapel', err);

    await prisma.coleta.update({
      where: { id: coletaId },
      data: {
        status:      'ERRO',
        etapa:       null,
        erroMsg:     err.message,
        inseridas,
        itens:       await comIndiceFinal(opts.semestreId, itens).catch(() => itens as any),
      },
    });
  }
}

/** Renumera o semestre e troca, no log, o índice provisório pelo definitivo. */
async function comIndiceFinal(
  semestreId: string,
  itens: (ColetaItem & { capelaId?: string })[],
): Promise<any> {
  const indices = await renumerarPorData(semestreId);
  return itens.map(({ capelaId, ...item }) => ({
    ...item,
    indice: (capelaId && indices.get(capelaId)) || item.indice,
  }));
}
