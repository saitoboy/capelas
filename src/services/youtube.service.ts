import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { getSubtitles } from 'youtube-caption-extractor';
import { callGroqJSON } from '../utils/groq';
import { logSuccess } from '../utils/logger';

// ──────────────────────────────────────────────────────────────────────────────
// Proxy para chamadas axios (YouTube Data API)
// ──────────────────────────────────────────────────────────────────────────────

function buildAxiosAgent(): HttpsProxyAgent<string> | undefined {
  const { PROXY_HOST, PROXY_PORT, PROXY_USER, PROXY_PASS } = process.env;
  if (!PROXY_HOST || !PROXY_PORT) return undefined;
  const user = encodeURIComponent(PROXY_USER ?? '');
  const pass = encodeURIComponent(PROXY_PASS ?? '');
  return new HttpsProxyAgent(`http://${user}:${pass}@${PROXY_HOST}:${PROXY_PORT}`);
}

const httpsAgent = buildAxiosAgent();

const ytAxios = axios.create({
  baseURL:    'https://www.googleapis.com/youtube/v3',
  httpsAgent,
  proxy:      false,
});

// Defaults do .env — usados quando a chamada não passa o filtro explicitamente.
const DEFAULT_KEYWORD = process.env.CHAPEL_KEYWORD ?? 'Devoção na Capela';
const DEFAULT_WEEKDAY = Number(process.env.CHAPEL_WEEKDAY ?? 3);
const DEFAULT_CANAL   = process.env.CHANNEL_HANDLE ?? '';

// ──────────────────────────────────────────────────────────────────────────────
// Resultado de coleta
// ──────────────────────────────────────────────────────────────────────────────

export interface ChapelCollected {
  indice:       number;
  data:         string;   // "DD/MM/AAAA"
  dataISO:      string;   // "YYYY-MM-DD"
  videoId:      string;
  url:          string;
  // null = a IA não conseguiu extrair. Fica em branco para o admin preencher
  // à mão depois de assistir ao vídeo. Nunca "(não encontrado)": um placeholder
  // gravado como texto vira dado falso no relatório do aluno.
  textoBiblico: string | null;
  tema:         string | null;
  pregador:     string | null;
  _source:      string;
}

export interface CollectOpts {
  publishedAfter:  string;   // ISO 8601
  publishedBefore: string;   // ISO 8601
  canal?:          string;   // "@souseminariodosul"
  keyword?:        string;
  weekday?:        number;   // 0 = domingo … 6 = sábado
  /** Chamado a cada capela concluída — alimenta o polling do front. */
  onProgress?: (info: {
    etapa:       string;
    processadas: number;
    total:       number;
    item?:       ChapelCollected;
  }) => Promise<void> | void;
}

export interface CollectResult {
  chapels: ChapelCollected[];
  /** Vídeos do canal que os filtros descartaram — sem isto, some capela em silêncio. */
  ignorados: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers de data
// ──────────────────────────────────────────────────────────────────────────────

function parseDateFromTitle(title: string): Date | null {
  const match = title.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  return new Date(`${yyyy}-${mm}-${dd}T12:00:00`);
}

function isChapelDay(date: Date, weekday: number): boolean {
  return date.getDay() === weekday;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function toISODate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// ──────────────────────────────────────────────────────────────────────────────
// YouTube Data API
// ──────────────────────────────────────────────────────────────────────────────

export async function resolveChannelId(canal?: string): Promise<string> {
  const handle = (canal ?? DEFAULT_CANAL).replace('@', '');
  const res = await ytAxios.get('/channels', {
    params: { part: 'id', forHandle: handle, key: process.env.YOUTUBE_API_KEY },
  });
  const items: any[] = res.data.items ?? [];
  if (items.length === 0) throw new Error(`Canal '${handle}' não encontrado.`);
  return items[0].id as string;
}

export async function fetchAllStreams(
  channelId:       string,
  publishedAfter:  string,
  publishedBefore: string,
): Promise<any[]> {
  const videos: any[] = [];
  let pageToken: string | null = null;

  do {
    const res: { data: any } = await ytAxios.get('/search', {
      params: {
        part:           'snippet',
        channelId,
        type:           'video',
        eventType:      'completed',
        maxResults:     50,
        key:            process.env.YOUTUBE_API_KEY,
        publishedAfter,
        publishedBefore,
        ...(pageToken ? { pageToken } : {}),
      },
    });
    videos.push(...(res.data.items ?? []));
    pageToken = res.data.nextPageToken ?? null;
  } while (pageToken);

  return videos;
}

export async function fetchTopLevelComments(
  videoId:     string,
  maxComments = 100,
): Promise<string[]> {
  const comments: string[] = [];
  let pageToken: string | null = null;

  try {
    do {
      const res: { data: any } = await ytAxios.get('/commentThreads', {
        params: {
          part:       'snippet',
          videoId,
          maxResults: 100,
          order:      'relevance',
          key:        process.env.YOUTUBE_API_KEY,
          ...(pageToken ? { pageToken } : {}),
        },
      });
      for (const item of res.data.items ?? []) {
        const text: string = item.snippet.topLevelComment.snippet.textDisplay
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<[^>]+>/g, '');
        comments.push(text.trim());
      }
      pageToken = res.data.nextPageToken ?? null;
    } while (pageToken && comments.length < maxComments);
  } catch (err: any) {
    if (err.response?.data?.error?.errors?.[0]?.reason === 'commentsDisabled') {
      return comments;
    }
    throw err;
  }

  return comments.slice(0, maxComments);
}

export async function fetchTranscriptText(videoId: string): Promise<string | null> {
  for (const lang of ['pt', 'pt-BR', 'en']) {
    try {
      const subs = await getSubtitles({ videoID: videoId, lang });
      if (subs && subs.length > 0) return subs.map(s => s.text).join(' ');
    } catch {
      // tenta o próximo idioma
    }
  }
  return null;
}

// ──────────────────────────────────────────────────────────────────────────────
// Extração via Groq
// ──────────────────────────────────────────────────────────────────────────────

interface ExtractedFields {
  textoBiblico: string | null;
  tema:         string | null;
  pregador:     string | null;
}

const EMPTY_FIELDS: ExtractedFields = { textoBiblico: null, tema: null, pregador: null };
const REQUIRED: (keyof ExtractedFields)[] = ['textoBiblico', 'tema', 'pregador'];

function isComplete(obj: ExtractedFields): boolean {
  return REQUIRED.every(f => obj[f] && (obj[f] as string).trim().length > 0);
}

function mergeResults(primary: ExtractedFields, fallback: ExtractedFields): ExtractedFields {
  return {
    textoBiblico: primary.textoBiblico || fallback.textoBiblico || null,
    tema:         primary.tema         || fallback.tema         || null,
    pregador:     primary.pregador     || fallback.pregador     || null,
  };
}

export async function extractFieldsWithGroq(
  sourceText:  string,
  sourceLabel: string,
): Promise<ExtractedFields> {
  if (!sourceText?.trim()) return EMPTY_FIELDS;

  const prompt = `
Você vai analisar ${sourceLabel} de uma capela (culto) de um seminário de teologia,
e extrair 3 informações específicas, se estiverem presentes:

1. "textoBiblico": a referência bíblica usada na pregação (ex: "João 3:16", "Eclesiastes 3", "Êxodo 3:1-12")
2. "tema": o tema/título da pregação (ex: "Estações da Vida", "Heróis da Fé: Moisés")
3. "pregador": o nome de quem pregou (ex: "Pastor Richard Blackaby", "Seminarista Flávio Massacessi")

Regras importantes:
- Responda APENAS com um objeto JSON, sem nenhum texto antes ou depois.
- Cada campo deve conter SOMENTE o valor relevante, limpo, sem rótulos como "Texto:" ou "Tema:".
- Se o pregador tiver cargo/título (Pastor, Seminarista, Professor, Reverendo), inclua junto ao nome.
- Se alguma informação não estiver claramente presente, use null para aquele campo (não invente).
- Ignore links, emojis, saudações e comentários irrelevantes (ex: "Amém", "Deus é bom").

Formato exato da resposta:
{"textoBiblico": "..." ou null, "tema": "..." ou null, "pregador": "..." ou null}

Texto para analisar:
"""
${sourceText.slice(0, 6000)}
"""
`.trim();

  const parsed = await callGroqJSON<ExtractedFields>(prompt, { maxTokens: 400 });
  if (!parsed) return EMPTY_FIELDS;

  return {
    textoBiblico: parsed.textoBiblico || null,
    tema:         parsed.tema         || null,
    pregador:     parsed.pregador     || null,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Pipeline por vídeo: comentários → Groq → fallback transcrição → Groq
// ──────────────────────────────────────────────────────────────────────────────

async function extractChapelData(
  videoId: string,
): Promise<ExtractedFields & { _source: string }> {
  const comments     = await fetchTopLevelComments(videoId);
  const commentsText = comments.join('\n---\n');
  let result         = await extractFieldsWithGroq(commentsText, 'comentários de um vídeo do YouTube');
  let source         = 'comentarios';

  if (!isComplete(result)) {
    const transcript = await fetchTranscriptText(videoId);
    if (transcript) {
      const fromTranscript = await extractFieldsWithGroq(
        transcript,
        'a transcrição/legenda automática de um vídeo de uma pregação',
      );
      result = mergeResults(result, fromTranscript);
      source = isComplete(result) ? 'comentarios+transcricao' : 'parcial';
    } else {
      source = isComplete(result) ? 'comentarios' : 'incompleto';
    }
  }

  return { ...result, _source: source };
}

// ──────────────────────────────────────────────────────────────────────────────
// Entry point público
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Coleta capelas do YouTube no período e com os filtros dados.
 *
 * É a operação mais cara do sistema: faz ~3 chamadas de IA por capela
 * (comentários → Groq → transcrição → Groq → sinopse). Por isso reporta
 * progresso via `onProgress` e é sempre chamada de dentro de um job.
 */
export async function collectChapels(opts: CollectOpts): Promise<CollectResult> {
  const {
    publishedAfter,
    publishedBefore,
    canal,
    keyword    = DEFAULT_KEYWORD,
    weekday    = DEFAULT_WEEKDAY,
    onProgress,
  } = opts;

  await onProgress?.({ etapa: 'Localizando o canal no YouTube…', processadas: 0, total: 0 });

  const channelId = await resolveChannelId(canal);
  logSuccess(`Canal encontrado: ${channelId}`, 'youtube');

  await onProgress?.({ etapa: 'Buscando vídeos no período…', processadas: 0, total: 0 });

  const streams = await fetchAllStreams(channelId, publishedAfter, publishedBefore);
  logSuccess(`Streams encontrados: ${streams.length}`, 'youtube');

  // Vídeos descartados aqui não somem em silêncio: o total volta como
  // `ignorados` e a tela do admin mostra "N vídeos ignorados".
  const chapels = streams
    .filter(v => {
      const title = v.snippet.title ?? '';
      if (!title.includes(keyword)) return false;
      const date = parseDateFromTitle(title);
      return date !== null && isChapelDay(date, weekday);
    })
    .sort((a: any, b: any) => {
      const da = parseDateFromTitle(a.snippet.title)!;
      const db = parseDateFromTitle(b.snippet.title)!;
      return da.getTime() - db.getTime();
    });

  const ignorados = streams.length - chapels.length;
  const total     = chapels.length;

  logSuccess(`Capelas identificadas: ${total} (ignorados: ${ignorados})`, 'youtube');

  await onProgress?.({ etapa: `${total} capelas identificadas.`, processadas: 0, total });

  const result: ChapelCollected[] = [];

  for (let i = 0; i < total; i++) {
    const v       = chapels[i];
    const videoId = v.id.videoId as string;
    const date    = parseDateFromTitle(v.snippet.title)!;

    await onProgress?.({
      etapa:       `Extraindo dados da capela ${i + 1} de ${total}…`,
      processadas: i,
      total,
    });

    const extracted = await extractChapelData(videoId);

    const item: ChapelCollected = {
      indice:       i + 1,
      data:         formatDate(date),
      dataISO:      toISODate(date),
      videoId,
      url:          `https://www.youtube.com/watch?v=${videoId}`,
      textoBiblico: extracted.textoBiblico, // null quando a IA não achou —
      tema:         extracted.tema,         // o admin preenche à mão depois
      pregador:     extracted.pregador,
      _source:      extracted._source,
    };

    result.push(item);

    await onProgress?.({
      etapa:       `Capela ${i + 1} de ${total} processada.`,
      processadas: i + 1,
      total,
      item,
    });

    logSuccess(`[${i + 1}/${total}] ${formatDate(date)} — ${extracted._source}`, 'youtube');
  }

  return { chapels: result, ignorados };
}
