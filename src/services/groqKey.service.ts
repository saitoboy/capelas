import prisma from '../utils/prisma';
import { encrypt, maskSecret } from '../utils/crypto';
import { validarChaveGroq } from '../utils/groq';
import { reativarExpiradas, diaUTC } from '../utils/groqKeys';
import { GroqKeyPublica, CreateGroqKeyBody } from '../types';
import { logSuccess } from '../utils/logger';

// ──────────────────────────────────────────────────────────────────────────────
// A chave em si NUNCA sai daqui. `toPublico` só devolve o preview mascarado —
// chave que sai numa resposta de API acaba em log, cache e histórico.
// ──────────────────────────────────────────────────────────────────────────────

// Cota diária de tokens (TPD) do plano — é por conta, então vem do .env. O
// número certo é o que aparece no console.groq.com (Settings › Limits). Sem
// ele, o front não consegue mostrar % e esconde a barra.
const GROQ_TPD = Number(process.env.GROQ_TPD) || 0;

const toPublico = (k: any): GroqKeyPublica => {
  // tokensHoje só vale se for do dia de hoje (UTC); virou o dia sem uso novo,
  // a cota já zerou lá na Groq — mostramos 0 sem precisar escrever no banco.
  const doDia = k.tokensDia?.getTime?.() === diaUTC().getTime();

  return {
    id:         k.id,
    label:      k.label,
    preview:    k.preview,
    status:     k.status,
    resetAt:    k.resetAt,
    lastUsedAt: k.lastUsedAt,
    erroMsg:    k.erroMsg,
    criadoPor:  k.criadoPor,
    createdAt:  k.createdAt,
    tokensHoje: doDia ? k.tokensHoje : 0,
    tpd:        GROQ_TPD || null,
  };
};

// ──────────────────────────────────────────────────────────────────────────────

export const listarChaves = async (): Promise<GroqKeyPublica[]> => {
  await reativarExpiradas();

  const chaves = await prisma.groqKey.findMany({
    orderBy: [
      { status: 'asc' },      // ATIVA < ESGOTADA < INVALIDA, alfabeticamente
      { lastUsedAt: 'desc' },
    ],
  });

  return chaves.map(toPublico);
};

// ──────────────────────────────────────────────────────────────────────────────

export const criarChave = async (
  ra: string,
  body: CreateGroqKeyBody,
): Promise<GroqKeyPublica> => {
  const label = body.label?.trim();
  const key   = body.key?.trim();

  if (!label || !key) {
    const err = new Error('Campos obrigatórios: label, key') as any;
    err.status = 400;
    throw err;
  }

  if (!key.startsWith('gsk_')) {
    const err = new Error('Chave da Groq inválida — deve começar com "gsk_".') as any;
    err.status = 400;
    throw err;
  }

  // Bate na Groq antes de gravar. Chave errada falha aqui, não no meio da
  // coleta de outra pessoa.
  await validarChaveGroq(key);

  const preview = maskSecret(key);

  // Mesma chave cadastrada duas vezes não ajuda em nada — a fila continua com
  // um limite só, e o admin acha que tem duas.
  const jaExiste = await prisma.groqKey.findFirst({ where: { preview } });
  if (jaExiste) {
    const err = new Error('Esta chave já está cadastrada.') as any;
    err.status = 409;
    throw err;
  }

  const chave = await prisma.groqKey.create({
    data: {
      label,
      keyEnc:    encrypt(key),
      preview,
      status:    'ATIVA',
      criadoPor: ra,
    },
  });

  logSuccess(`Chave da Groq cadastrada: "${label}" (${preview}) por ${ra}`, 'groq');
  return toPublico(chave);
};

// ──────────────────────────────────────────────────────────────────────────────

export const removerChave = async (id: string): Promise<void> => {
  const existe = await prisma.groqKey.findUnique({ where: { id } });
  if (!existe) {
    const err = new Error('Chave não encontrada') as any;
    err.status = 404;
    throw err;
  }

  await prisma.groqKey.delete({ where: { id } });
  logSuccess(`Chave da Groq removida: "${existe.label}"`, 'groq');
};

// ──────────────────────────────────────────────────────────────────────────────

export const reativarChave = async (id: string): Promise<GroqKeyPublica> => {
  const existe = await prisma.groqKey.findUnique({ where: { id } });
  if (!existe) {
    const err = new Error('Chave não encontrada') as any;
    err.status = 404;
    throw err;
  }

  const chave = await prisma.groqKey.update({
    where: { id },
    data:  { status: 'ATIVA', resetAt: null, erroMsg: null },
  });

  logSuccess(`Chave da Groq reativada: "${chave.label}"`, 'groq');
  return toPublico(chave);
};
