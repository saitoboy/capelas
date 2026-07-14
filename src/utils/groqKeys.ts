import prisma from './prisma';
import { decrypt } from './crypto';
import { logInfo, logSuccess, logError } from './logger';

// ──────────────────────────────────────────────────────────────────────────────
// Fila de chaves da Groq.
//
// A cada chamada, usa a chave ATIVA menos usada recentemente (round-robin
// natural via lastUsedAt). Quando a Groq responde 429 (limite de tokens), a
// chave vira ESGOTADA com a hora em que volta; quando responde 401/403, vira
// INVALIDA. Em ambos os casos a chamada é repetida na próxima chave da fila.
//
// Sem nenhuma chave no banco, cai no GROQ_API_KEY do .env — é o que mantém a
// retrocompatibilidade enquanto ninguém cadastra a primeira.
// ──────────────────────────────────────────────────────────────────────────────

export type GroqKeyStatus = 'ATIVA' | 'ESGOTADA' | 'INVALIDA';

export interface ChaveUsavel {
  id: string | null;   // null = chave do .env (fallback), não está no banco
  label: string;
  key: string;
}

/**
 * Devolve chaves ESGOTADA cujo resetAt já passou para ATIVA.
 * Chamada antes de cada busca — evita depender de cron.
 */
export async function reativarExpiradas(): Promise<number> {
  const { count } = await prisma.groqKey.updateMany({
    where: {
      status:  'ESGOTADA',
      resetAt: { not: null, lte: new Date() },
    },
    data: { status: 'ATIVA', resetAt: null, erroMsg: null },
  });

  if (count > 0) logSuccess(`${count} chave(s) da Groq reativada(s)`, 'groq');
  return count;
}

/**
 * Chaves disponíveis, na ordem em que devem ser tentadas.
 * Nunca lança: se não houver nenhuma no banco, devolve a do .env.
 */
export async function listarChavesUsaveis(): Promise<ChaveUsavel[]> {
  await reativarExpiradas();

  const chaves = await prisma.groqKey.findMany({
    where:   { status: 'ATIVA' },
    orderBy: [
      { lastUsedAt: { sort: 'asc', nulls: 'first' } }, // nunca usada vai primeiro
      { createdAt: 'asc' },
    ],
  });

  const usaveis: ChaveUsavel[] = [];

  for (const c of chaves) {
    try {
      usaveis.push({ id: c.id, label: c.label, key: decrypt(c.keyEnc) });
    } catch (err: any) {
      // Chave que não descriptografa é chave perdida — provavelmente a
      // APP_ENCRYPTION_KEY mudou. Marca e segue: não pode derrubar a fila.
      logError(`Falha ao descriptografar a chave "${c.label}": ${err.message}`, 'groq');
      await marcarInvalida(c.id, 'Falha ao descriptografar — a APP_ENCRYPTION_KEY mudou?');
    }
  }

  // Fallback: nenhuma chave cadastrada no banco ainda.
  if (usaveis.length === 0) {
    const envKey = process.env.GROQ_API_KEY;
    if (envKey) usaveis.push({ id: null, label: '.env', key: envKey });
  }

  return usaveis;
}

// ──────────────────────────────────────────────────────────────────────────────

export async function registrarUso(id: string | null): Promise<void> {
  if (!id) return; // chave do .env não tem registro
  await prisma.groqKey.update({
    where: { id },
    data:  { lastUsedAt: new Date() },
  });
}

export async function marcarEsgotada(id: string | null, resetAt: Date): Promise<void> {
  if (!id) return;
  await prisma.groqKey.update({
    where: { id },
    data:  { status: 'ESGOTADA', resetAt, erroMsg: 'Limite de tokens atingido' },
  });
  logInfo(`Chave esgotada até ${resetAt.toLocaleTimeString('pt-BR')}`, 'groq');
}

export async function marcarInvalida(id: string | null, motivo: string): Promise<void> {
  if (!id) return;
  await prisma.groqKey.update({
    where: { id },
    data:  { status: 'INVALIDA', resetAt: null, erroMsg: motivo },
  });
  logError(`Chave marcada como inválida: ${motivo}`, 'groq');
}

// ──────────────────────────────────────────────────────────────────────────────

/**
 * Quando a Groq volta 429, ela diz em quanto tempo o limite reseta — via header
 * `retry-after` (segundos) ou `x-ratelimit-reset-tokens` ("7.66s", "2m59.56s").
 * Sem nenhum dos dois, assume 1 hora: é melhor pecar por esperar demais do que
 * martelar a mesma chave estourada.
 */
export function lerResetAt(headers: Record<string, any> | undefined): Date {
  const agora = Date.now();

  const retryAfter = Number(headers?.['retry-after']);
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return new Date(agora + retryAfter * 1000);
  }

  const reset = headers?.['x-ratelimit-reset-tokens'] ?? headers?.['x-ratelimit-reset-requests'];
  const segundos = parseDuracao(typeof reset === 'string' ? reset : '');
  if (segundos > 0) return new Date(agora + segundos * 1000);

  return new Date(agora + 60 * 60 * 1000);
}

/** Converte a duração da Groq ("7.66s", "2m59.56s", "1h2m3s") em segundos. */
function parseDuracao(valor: string): number {
  if (!valor) return 0;

  const match = valor.match(/(?:(\d+(?:\.\d+)?)h)?(?:(\d+(?:\.\d+)?)m(?!s))?(?:(\d+(?:\.\d+)?)m?s)?/);
  if (!match) return 0;

  const [, h, m, s] = match;
  const total = (Number(h) || 0) * 3600 + (Number(m) || 0) * 60 + (Number(s) || 0);

  return Number.isFinite(total) ? total : 0;
}
