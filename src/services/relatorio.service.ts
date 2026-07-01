import prisma from '../utils/prisma';
import { FocoCriativo, MbtiTipo, RelatorioPublico, StatusRelatorio } from '../types';
import { logSuccess } from '../utils/logger';

// ──────────────────────────────────────────────────────────────────────────────

const FOCOS: FocoCriativo[] = ['pastoral', 'teológico', 'litúrgico', 'histórico-bíblico'];

const sortearFoco = (ultimo: string | null): FocoCriativo => {
  const disponiveis = FOCOS.filter(f => f !== ultimo);
  return disponiveis[Math.floor(Math.random() * disponiveis.length)];
};

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
      status:            'PENDENTE',
      erroMsg:           null,
      docxPath:          null,
    },
    create: {
      alunoRa:     ra,
      semestreId,
      personaTipo: persona.tipo,
      personaNome: persona.nome,
      focoCriativo,
      status:      'PENDENTE',
    },
  });

  logSuccess(`Relatório enfileirado: aluno=${ra} semestre=${semestreId} foco=${focoCriativo}`, 'relatorio');

  // TODO: disparar job assíncrono de geração por IA aqui

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
