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

const CHAPEL_KEYWORD = process.env.CHAPEL_KEYWORD ?? 'Devoção na Capela';
const CHAPEL_WEEKDAY = Number(process.env.CHAPEL_WEEKDAY ?? 3);

// ──────────────────────────────────────────────────────────────────────────────
// Resultado de coleta
// ──────────────────────────────────────────────────────────────────────────────

export interface ChapelCollected {
  indice:       number;
  data:         string;   // "DD/MM/AAAA"
  dataISO:      string;   // "YYYY-MM-DD"
  videoId:      string;
  url:          string;
  textoBiblico: string;
  tema:         string;
  pregador:     string;
  _source:      string;
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

function isChapelDay(date: Date): boolean {
  return date.getDay() === CHAPEL_WEEKDAY;
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

export async function resolveChannelId(): Promise<string> {
  const handle = (process.env.CHANNEL_HANDLE ?? '').replace('@', '');
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
 * Coleta capelas do YouTube entre as datas fornecidas.
 * @param publishedAfter  ISO 8601, ex: "2026-02-01T00:00:00Z"
 * @param publishedBefore ISO 8601, ex: "2026-07-01T00:00:00Z"
 */
export async function collectChapels(
  publishedAfter:  string,
  publishedBefore: string,
): Promise<ChapelCollected[]> {
  const channelId = await resolveChannelId();
  logSuccess(`Canal encontrado: ${channelId}`, 'youtube');

  const streams = await fetchAllStreams(channelId, publishedAfter, publishedBefore);
  logSuccess(`Streams encontrados: ${streams.length}`, 'youtube');

  const chapels = streams
    .filter(v => {
      const title = v.snippet.title ?? '';
      if (!title.includes(CHAPEL_KEYWORD)) return false;
      const date = parseDateFromTitle(title);
      return date && isChapelDay(date);
    })
    .sort((a: any, b: any) => {
      const da = parseDateFromTitle(a.snippet.title)!;
      const db = parseDateFromTitle(b.snippet.title)!;
      return da.getTime() - db.getTime();
    });

  logSuccess(`Capelas identificadas: ${chapels.length}`, 'youtube');

  const result: ChapelCollected[] = [];

  for (let i = 0; i < chapels.length; i++) {
    const v       = chapels[i];
    const videoId = v.id.videoId as string;
    const date    = parseDateFromTitle(v.snippet.title)!;

    const extracted = await extractChapelData(videoId);

    result.push({
      indice:       i + 1,
      data:         formatDate(date),
      dataISO:      toISODate(date),
      videoId,
      url:          `https://www.youtube.com/watch?v=${videoId}`,
      textoBiblico: extracted.textoBiblico ?? '(não encontrado)',
      tema:         extracted.tema         ?? '(não encontrado)',
      pregador:     extracted.pregador     ?? '(não encontrado)',
      _source:      extracted._source,
    });

    logSuccess(`[${i + 1}/${chapels.length}] ${formatDate(date)} — ${extracted._source}`, 'youtube');
  }

  return result;
}
