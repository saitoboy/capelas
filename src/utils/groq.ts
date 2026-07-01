import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { ProxyAgent, setGlobalDispatcher } from 'undici';

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

async function callGroqRaw(prompt: string, opts: GroqOpts = {}): Promise<string> {
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
        Authorization:  `Bearer ${process.env.GROQ_API_KEY}`,
      },
      httpsAgent,
      proxy: false, // evita conflito com variáveis de ambiente de proxy do axios
    }
  );
  return res.data.choices[0].message.content as string;
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
