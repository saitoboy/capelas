import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { ProxyAgent, setGlobalDispatcher } from 'undici';
import {
  listarChavesUsaveis,
  registrarUso,
  marcarEsgotada,
  marcarInvalida,
  lerResetAt,
} from './groqKeys';
import { logWarning } from './logger';

// ──────────────────────────────────────────────────────────────────────────────
// Proxy autenticado.
// encodeURIComponent é necessário pois a senha pode conter '@' e outros
// caracteres especiais que quebrariam o parsing da URL pelo ProxyAgent.
// ──────────────────────────────────────────────────────────────────────────────

function buildAgent(): HttpsProxyAgent<string> | undefined {
  const { PROXY_HOST, PROXY_PORT, PROXY_USER, PROXY_PASS } = process.env;
  if (!PROXY_HOST || !PROXY_PORT) return undefined;
  const user = encodeURIComponent(PROXY_USER ?? '');
  const pass = encodeURIComponent(PROXY_PASS ?? '');
  return new HttpsProxyAgent(`http://${user}:${pass}@${PROXY_HOST}:${PROXY_PORT}`);
}

/**
 * Registra o ProxyAgent do undici como dispatcher global.
 * Deve ser chamado uma única vez na inicialização quando há proxy configurado.
 * Necessário porque `youtube-caption-extractor` usa o `fetch` nativo do Node,
 * que ignora o `https-proxy-agent` (esse só funciona com axios/http.request).
 */
export function initUndiciProxy(): void {
  const { PROXY_HOST, PROXY_PORT, PROXY_USER, PROXY_PASS } = process.env;
  if (!PROXY_HOST || !PROXY_PORT) return;
  const token = Buffer.from(`${PROXY_USER ?? ''}:${PROXY_PASS ?? ''}`).toString('base64');
  setGlobalDispatcher(
    new ProxyAgent({
      uri:   `http://${PROXY_HOST}:${PROXY_PORT}`,
      token: `Basic ${token}`,
    })
  );
}

const httpsAgent = buildAgent();

// ──────────────────────────────────────────────────────────────────────────────

interface GroqOpts {
  maxTokens?: number;
  temperature?: number;
}

interface GroqResultado {
  conteudo: string;
  /** total_tokens da resposta — alimenta a cota diária (TPD) da chave. */
  tokens: number;
}

/** Uma tentativa, com uma chave específica. Deixa o erro do axios subir. */
async function postGroq(apiKey: string, prompt: string, opts: GroqOpts): Promise<GroqResultado> {
  const res = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      model:       'llama-3.3-70b-versatile',
      max_tokens:  opts.maxTokens  ?? 1024,
      temperature: opts.temperature ?? 0.7,
      messages: [{ role: 'user', content: prompt }],
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${apiKey}`,
      },
      httpsAgent,
      proxy: false, // evita conflito com variáveis de ambiente de proxy do axios
    }
  );
  return {
    conteudo: res.data.choices[0].message.content as string,
    tokens:   Number(res.data.usage?.total_tokens) || 0,
  };
}

/**
 * Percorre a fila de chaves até uma funcionar.
 *
 * 429 → a chave estourou o limite: marca ESGOTADA com a hora em que volta e
 *       tenta a próxima.
 * 401/403 → a chave é inválida: marca INVALIDA e tenta a próxima.
 * Qualquer outro erro → não é problema de chave, propaga.
 *
 * Acabando a fila, lança 503 — é o que a tela de coleta lê para oferecer
 * "cadastrar chave".
 */
async function callGroqRaw(prompt: string, opts: GroqOpts = {}): Promise<string> {
  const chaves = await listarChavesUsaveis();

  if (chaves.length === 0) {
    const err = new Error(
      'Nenhuma chave da Groq disponível. Cadastre uma em /groq-key.'
    ) as any;
    err.status = 503;
    throw err;
  }

  let ultimoMotivo = '';

  for (const chave of chaves) {
    try {
      const { conteudo, tokens } = await postGroq(chave.key, prompt, opts);
      await registrarUso(chave.id, tokens);
      return conteudo;
    } catch (err: any) {
      const status  = err.response?.status;
      const headers = err.response?.headers;

      if (status === 429) {
        const resetAt = lerResetAt(headers);
        await marcarEsgotada(chave.id, resetAt);
        ultimoMotivo = 'limite de tokens atingido';
        logWarning(`Chave "${chave.label}" esgotada — tentando a próxima`, 'groq');
        continue;
      }

      if (status === 401 || status === 403) {
        const motivo = err.response?.data?.error?.message ?? 'chave recusada pela Groq';
        await marcarInvalida(chave.id, motivo);
        ultimoMotivo = motivo;
        logWarning(`Chave "${chave.label}" inválida — tentando a próxima`, 'groq');
        continue;
      }

      throw err; // erro de rede, 500 da Groq, etc — trocar de chave não resolve
    }
  }

  const err = new Error(
    `Todas as chaves da Groq estão indisponíveis (${ultimoMotivo}). Cadastre uma nova em /groq-key.`
  ) as any;
  err.status = 503;
  throw err;
}

/**
 * Testa uma chave contra a Groq com a chamada mais barata possível.
 * Usada no cadastro — chave errada tem que falhar ali, não no meio da coleta
 * de outra pessoa.
 */
export async function validarChaveGroq(apiKey: string): Promise<void> {
  try {
    await postGroq(apiKey, 'ok', { maxTokens: 1, temperature: 0 });
  } catch (err: any) {
    const status = err.response?.status;

    if (status === 401 || status === 403) {
      const e = new Error('Chave recusada pela Groq — confira se copiou inteira.') as any;
      e.status = 400;
      throw e;
    }
    if (status === 429) {
      // A chave é válida; só já está no limite. Aceita — a fila cuida disso.
      return;
    }

    const e = new Error(`Não foi possível validar a chave: ${err.message}`) as any;
    e.status = 502;
    throw e;
  }
}

export async function callGroq(prompt: string, opts: GroqOpts = {}): Promise<string> {
  return callGroqRaw(prompt, opts);
}

/**
 * Chama a Groq e tenta extrair e parsear o primeiro objeto JSON `{...}` da
 * resposta. Retorna `null` se não encontrar JSON válido.
 */
export async function callGroqJSON<T = Record<string, unknown>>(
  prompt: string,
  opts: GroqOpts = {},
): Promise<T | null> {
  const raw = await callGroqRaw(prompt, opts);
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as T;
  } catch {
    return null;
  }
}
