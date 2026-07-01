import prisma from '../utils/prisma';
import { FocoCriativo, MbtiTipo, RelatorioPublico, StatusRelatorio } from '../types';
import { logSuccess, logError } from '../utils/logger';
import { callGroq } from '../utils/groq';
import { generateDocx } from './docx.service';

// ──────────────────────────────────────────────────────────────────────────────
// Temperaturas por foco criativo (conforme plano)
// ──────────────────────────────────────────────────────────────────────────────

const FOCO_TEMP: Record<FocoCriativo, number> = {
  'pastoral':          0.9,
  'teológico':         0.7,
  'litúrgico':         0.8,
  'histórico-bíblico': 0.75,
};

// ──────────────────────────────────────────────────────────────────────────────
// Job em background: gera reflexão + análise + docx e atualiza status
// ──────────────────────────────────────────────────────────────────────────────

async function processarRelatorio(relatorioId: number): Promise<void> {
  const relatorio = await prisma.relatorio.findUnique({ where: { id: relatorioId } });
  if (!relatorio) return;

  try {
    const [usuario, semestre, capelas] = await Promise.all([
      prisma.usuario.findUnique({ where: { ra: relatorio.alunoRa } }),
      prisma.semestre.findUnique({ where: { id: relatorio.semestreId } }),
      prisma.capela.findMany({
        where:   { semestreId: relatorio.semestreId },
        orderBy: { indice: 'asc' },
        include: { sinopse: true },
      }),
    ]);

    if (!usuario || !semestre) throw new Error('Dados do aluno ou semestre não encontrados');
    if (capelas.length === 0) throw new Error('Nenhuma capela encontrada para este semestre');

    const temperatura = FOCO_TEMP[relatorio.focoCriativo as FocoCriativo] ?? 0.7;
    const persona = { nome: relatorio.personaNome, tipo: relatorio.personaTipo, tom: '' };

    // Busca o tom atualizado da persona
    const personaDb = await prisma.persona.findUnique({ where: { alunoRa: relatorio.alunoRa } });
    if (personaDb) persona.tom = personaDb.tom;

    const chapelSummary = capelas
      .map(c => `- ${c.data.toLocaleDateString('pt-BR')}: "${c.tema}" | Texto: ${c.textoBiblico} | Pregador: ${c.pregador}`)
      .join('\n');

    // ── Reflexão Teológica ────────────────────────────────────────────────────
    const promptReflexao = `
Você é um seminarista com perfil "${persona.nome}" (tipo Jung: ${persona.tipo}).
Seu tom de escrita é: ${persona.tom}.

Você assistiu às seguintes capelas ao longo do semestre ${semestre.label}:
${chapelSummary}

Escreva a "Reflexão Teológica" do relatório semestral do Laboratório de Teologia e Liturgia.
Mínimo de 20 linhas. Explique como as mensagens contribuíram para sua formação teológica,
destaque temas recorrentes, aprofundamentos bíblicos relevantes e como as pregações afetaram
sua compreensão da fé cristã e da missão da Igreja.
Use seu tom característico. Escreva em português formal, em parágrafos corridos,
sem markdown, sem títulos, sem listas. Só o texto.
`.trim();

    const reflexaoTeologica = (await callGroq(promptReflexao, { temperature: temperatura, maxTokens: 2048 })).trim();

    // ── Análise Litúrgica ─────────────────────────────────────────────────────
    const promptLiturgica = `
Você é um seminarista com perfil "${persona.nome}" (tipo Jung: ${persona.tipo}).
Seu tom de escrita é: ${persona.tom}.

Você assistiu às seguintes capelas ao longo do semestre ${semestre.label}:
${chapelSummary}

Escreva a "Análise Litúrgica" do relatório semestral do Laboratório de Teologia e Liturgia.
Mínimo de 20 linhas. Avalie os elementos litúrgicos das capelas: organização dos cultos,
orações, músicas, leituras, introduções e encerramentos. Reflita sobre como a liturgia
contribuiu para a edificação da comunidade e destaque boas práticas observadas.
Use seu tom característico. Escreva em português formal, em parágrafos corridos,
sem markdown, sem títulos, sem listas. Só o texto.
`.trim();

    const analiseLiturgica = (await callGroq(promptLiturgica, { temperature: temperatura, maxTokens: 2048 })).trim();

    // ── Geração do .docx ──────────────────────────────────────────────────────
    const buffer = await generateDocx(
      { nome: usuario.nome, ra: usuario.ra, semestre: semestre.label, curso: usuario.curso },
      capelas.map(c => ({ indice: c.indice, data: c.data, textoBiblico: c.textoBiblico, tema: c.tema, pregador: c.pregador })),
      { reflexao: reflexaoTeologica, liturgica: analiseLiturgica },
    );

    const docxData = buffer.toString('base64');

    await prisma.relatorio.update({
      where: { id: relatorioId },
      data:  {
        reflexaoTeologica,
        analiseLiturgica,
        docxData,
        status:  'CONCLUIDO',
        erroMsg: null,
      },
    });

    logSuccess(`Relatório concluído: id=${relatorioId} aluno=${relatorio.alunoRa}`, 'relatorio');
  } catch (err: any) {
    logError(`Falha ao processar relatório id=${relatorioId}: ${err.message}`, 'relatorio', err);
    await prisma.relatorio.update({
      where: { id: relatorioId },
      data:  { status: 'ERRO', erroMsg: err.message },
    }).catch(() => {/* ignora erro ao persistir erro */});
  }
}

const sortearFoco = (ultimo: string | null): FocoCriativo => {
  const disponiveis = FOCOS.filter(f => f !== ultimo);
  return disponiveis[Math.floor(Math.random() * disponiveis.length)];
};

// ──────────────────────────────────────────────────────────────────────────────

const FOCOS: FocoCriativo[] = ['pastoral', 'teológico', 'litúrgico', 'histórico-bíblico'];

const toPublico = (r: any): RelatorioPublico => ({
  id:                r.id,
  alunoRa:           r.alunoRa,
  semestreId:        r.semestreId,
  personaTipo:       r.personaTipo,
  personaNome:       r.personaNome,
  focoCriativo:      r.focoCriativo as FocoCriativo | null,
  reflexaoTeologica: r.reflexaoTeologica,
  analiseLiturgica:  r.analiseLiturgica,
  status:            r.status as StatusRelatorio,
  erroMsg:           r.erroMsg,
  createdAt:         r.createdAt,
  updatedAt:         r.updatedAt,
});

// ──────────────────────────────────────────────────────────────────────────────

export const gerarRelatorio = async (ra: string, semestreId: number): Promise<RelatorioPublico> => {
  // Valida persona
  const persona = await prisma.persona.findUnique({ where: { alunoRa: ra } });
  if (!persona) {
    const err = new Error('Defina sua persona antes de gerar o relatório') as any;
    err.status = 422;
    throw err;
  }

  // Valida semestre
  const semestre = await prisma.semestre.findUnique({ where: { id: semestreId } });
  if (!semestre) {
    const err = new Error('Semestre não encontrado') as any;
    err.status = 404;
    throw err;
  }

  // Busca relatório anterior para evitar repetir foco
  const anterior = await prisma.relatorio.findUnique({
    where: { uk_aluno_semestre: { alunoRa: ra, semestreId } },
    select: { focoCriativo: true },
  });

  const focoCriativo = sortearFoco(anterior?.focoCriativo ?? null);

  // Upsert — cada geração sobrescreve o anterior
  const relatorio = await prisma.relatorio.upsert({
    where: { uk_aluno_semestre: { alunoRa: ra, semestreId } },
    update: {
      personaTipo:       persona.tipo,
      personaNome:       persona.nome,
      focoCriativo,
      reflexaoTeologica: null,
      analiseLiturgica:  null,
      status:            'GERANDO',
      erroMsg:           null,
      docxData:          null,
    },
    create: {
      alunoRa:     ra,
      semestreId,
      personaTipo: persona.tipo,
      personaNome: persona.nome,
      focoCriativo,
      status:      'GERANDO',
    },
  });

  logSuccess(`Relatório enfileirado: aluno=${ra} semestre=${semestreId} foco=${focoCriativo}`, 'relatorio');

  // Dispara o job em background sem bloquear a resposta HTTP
  setImmediate(() => { processarRelatorio(relatorio.id); });

  return toPublico(relatorio);
};

// ──────────────────────────────────────────────────────────────────────────────

export const listarMeus = async (ra: string): Promise<RelatorioPublico[]> => {
  const relatorios = await prisma.relatorio.findMany({
    where: { alunoRa: ra },
    orderBy: { createdAt: 'desc' },
  });
  return relatorios.map(toPublico);
};

// ──────────────────────────────────────────────────────────────────────────────

export const buscarPorId = async (id: number, ra: string, isAdmin: boolean): Promise<RelatorioPublico> => {
  const relatorio = await prisma.relatorio.findUnique({ where: { id } });

  if (!relatorio) {
    const err = new Error('Relatório não encontrado') as any;
    err.status = 404;
    throw err;
  }

  if (!isAdmin && relatorio.alunoRa !== ra) {
    const err = new Error('Acesso negado') as any;
    err.status = 403;
    throw err;
  }

  return toPublico(relatorio);
};
