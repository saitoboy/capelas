import axios, { AxiosInstance } from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import prisma from '../utils/prisma';
import { encrypt, decrypt } from '../utils/crypto';
import { logInfo, logSuccess, logWarning } from '../utils/logger';
import { renumerarPorData } from './capela.service';
import { CapelaAva, CapelaCriadaAva, SincronizacaoAvaResultado } from '../types';

// ──────────────────────────────────────────────────────────────────────────────
// AVA (Portal JACAD → Brightspace/D2L) com sessão por usuário
//
// O YouTube nem sempre tem todos os cultos — quando um não vai pro canal, o app
// fica com menos capelas que o AVA. O AVA (Brightspace) é a fonte oficial das
// datas. Como a API Valence do D2L exige registro de app pela faculdade, e a
// chave da API JACAD exige admin do sistema desktop, o caminho é o mesmo do
// aluno: login no portal JACAD (form HTML, sem captcha) → link SSO → sessão D2L.
//
// As credenciais do app valem no portal (login aceita RA/e-mail/CPF), então
// cada usuário conecta o portal com a própria senha — que nunca é guardada.
// No login do app (a senha ainda está na memória) a API loga no portal e salva
// só os COOKIES, cifrados AES-256-GCM como as chaves da Groq. Sessão expirou:
// o usuário reconecta informando a senha de novo (POST /ava/conectar).
//
// Tudo com axios + cookie jar: sem Chromium no Docker.
//
// Sem proxy de propósito: o axios-cookiejar-support gerencia os agents para
// reter os cookies, e a sync roda em produção, onde não há proxy. Na rede
// corporativa local o Squid bloqueia esses domínios (407) — testar em produção.
// ──────────────────────────────────────────────────────────────────────────────

const JACAD_BASE = process.env.AVA_JACAD_BASE ?? 'https://batistas.jacad.com.br';
const D2L_BASE   = process.env.AVA_D2L_BASE   ?? 'https://batistas.brightspace.com';
// Saem da URL da unidade "Capelas" no AVA: /d2l/le/lessons/43874/units/391427
const ORG_UNIT   = process.env.AVA_ORG_UNIT   ?? '43874';
const UNIT_ID    = process.env.AVA_UNIT       ?? '391427';
const KEYWORD    = process.env.CHAPEL_KEYWORD ?? 'Devoção na Capela';

/** Erro operacional da integração. Usa 4xx de propósito: o handleError do
 *  controller esconde mensagens de status >= 500, e o admin precisa ler no
 *  front em qual etapa falhou para agir (senha, SSO, layout...).
 *  Uso: `throw erroAva('...')` — o throw explícito deixa o TS fazer narrowing. */
const erroAva = (mensagem: string, status = 400): Error => {
  const err = new Error(mensagem) as any;
  err.status = status;
  return err;
};

/** minúsculo, sem acento, espaços colapsados — "Devoção" casa com "Devocao". */
const normalizar = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

function criarCliente(jar?: CookieJar): AxiosInstance {
  const client = wrapper(axios.create({
    withCredentials: true,
    proxy: false,
    timeout: 30000,
    maxRedirects: 10,
    // D2L às vezes serve conteúdo diferente para clients não-browser.
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' },
  }));
  // A v7 da lib estende só AxiosRequestConfig (declaration merging) — nem
  // CreateAxiosDefaults nem o tipo de `defaults` conhecem `jar`. O cast fica
  // nesta linha; em runtime o wrapper lê defaults.jar em todos os requests.
  (client.defaults as any).jar = jar ?? new CookieJar();
  return client;
}

// ──────────────────────────────────────────────────────────────────────────────
// LOGIN NO PORTAL JACAD
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Form clássico: POST /aluno-v2/login/do/ com login.login + login.password
 * (reCAPTCHA desabilitado no portal — por isso axios puro basta).
 * Devolve o HTML da página pós-login (home do portal ou tela de erro).
 */
async function loginJacad(client: AxiosInstance, login: string, senha: string): Promise<string> {
  const urlLogin = `${JACAD_BASE}/academico/aluno-v2/`;
  const pagina = await client.get(urlLogin);
  const html = String(pagina.data);

  // O action pode vir com ;jsessionid=... embutido — usar como vem.
  const action = html.match(/action="([^"]*login\/do[^"]*)"/i)?.[1];
  if (!action) {
    throw erroAva('A tela de login do JACAD não veio como esperado. Se estiver na rede corporativa, o proxy bloqueia este domínio (407) — rode em produção.');
  }

  const body = new URLSearchParams({
    'login.login':    login,
    'login.password': senha,
  });
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };

  let resp = await client.post(new URL(action, urlLogin).toString(), body.toString(), {
    headers, validateStatus: () => true,
  });

  // Em algumas instalações o action omite o prefixo /academico do context path.
  if (resp.status === 404 && !action.startsWith('/academico')) {
    logInfo('Login retornou 404 no action direto; tentando com prefixo /academico', 'ava');
    resp = await client.post(`${JACAD_BASE}/academico${action}`, body.toString(), {
      headers, validateStatus: () => true,
    });
  }

  const posLogin = String(resp.data);
  // Login falhou = o portal devolve o form de novo (com mensagem de erro).
  if (posLogin.includes('name="login.password"')) {
    throw erroAva('O JACAD recusou o login do portal (RA/e-mail/CPF ou senha inválidos).', 401);
  }

  return posLogin;
}

// ──────────────────────────────────────────────────────────────────────────────
// LINK SSO → SESSÃO NO BRIGHTSPACE
// ──────────────────────────────────────────────────────────────────────────────

/** Links do AVA na home do portal: diretos (brightspace.com) ou rotas internas
 *  que redirecionam para lá. Botões JS (onclick) também entram na varredura. */
function linksAva(homeHtml: string): string[] {
  const urls = new Set<string>();

  for (const m of homeHtml.matchAll(/https?:\/\/[^\s"'<>\\]*brightspace\.com[^\s"'<>\\]*/gi)) {
    urls.add(m[0]);
  }
  for (const m of homeHtml.matchAll(/(?:href|onclick)\s*=\s*"([^"]+)"/gi)) {
    const alvo = m[1];
    const interno = alvo.match(/(?:location(?:\.href)?\s*=\s*)?['"]?([^'";]*(?:ava|ambiente-virtual)[^'";]*)['"]?/i);
    if (interno && !alvo.includes('brightspace.com')) urls.add(interno[1]);
  }

  return [...urls];
}

async function abrirSessaoD2L(client: AxiosInstance, candidatos: string[]): Promise<void> {
  if (candidatos.length === 0) {
    throw erroAva('Nenhum link do AVA encontrado na home do portal JACAD. O layout do portal pode ter mudado — verifique os logs e o HTML da home.');
  }

  for (const link of candidatos) {
    const url = new URL(link, JACAD_BASE).toString();
    logInfo(`Tentando SSO para o AVA: ${url}`, 'ava');
    const resp = await client.get(url, { validateStatus: () => true });
    const finalUrl: string = resp.request?.res?.responseUrl ?? url;

    if (finalUrl.includes('brightspace.com') && !finalUrl.includes('/d2l/login')) {
      logSuccess('Sessão criada no Brightspace', 'ava');
      return;
    }
  }

  throw erroAva('O portal não redirecionou autenticado para o Brightspace (caiu em /d2l/login ou fora do domínio). O fluxo de SSO pode ter mudado.');
}

// ──────────────────────────────────────────────────────────────────────────────
// LEITURA DAS CAPELAS NO SUMÁRIO DO CURSO (content/toc)
// ──────────────────────────────────────────────────────────────────────────────

/** A API interna /d2l/api/le é a mesma que o front do AVA usa com a sessão web.
 *  A versão varia por instalação — tenta da mais nova para a mais antiga. */
async function lerToc(client: AxiosInstance): Promise<any> {
  let ultimoStatus = 0;
  for (const v of ['1.69', '1.60', '1.51', '1.46', '1.26', '1.9']) {
    const resp = await client.get(`${D2L_BASE}/d2l/api/le/${v}/${ORG_UNIT}/content/toc`, {
      validateStatus: () => true,
    });
    if (resp.status === 200 && resp.data && typeof resp.data === 'object') {
      return resp.data;
    }
    ultimoStatus = resp.status;
    logInfo(`content/toc v${v} → ${resp.status}`, 'ava');
  }
  throw erroAva(`O Brightspace não liberou o sumário do curso (último status ${ultimoStatus}). Confira AVA_ORG_UNIT (${ORG_UNIT}) e se a sessão SSO foi criada.`);
}

const acharModuloPorId = (mod: any, id: string): any => {
  if (String(mod?.ModuleId ?? '') === id) return mod;
  for (const filho of mod?.Modules ?? []) {
    const achou = acharModuloPorId(filho, id);
    if (achou) return achou;
  }
  return null;
};

/**
 * Tópicos "Devoção na Capela - DD/MM/AAAA" → { titulo, dataISO }, dedup por data.
 * Exportada pura para teste sem rede.
 */
export function extrairCapelasDoToc(toc: any): CapelaAva[] {
  // Se a unidade configurada existir, olha só ela; senão varre o curso inteiro.
  let raiz = toc;
  if (UNIT_ID) {
    const unidade = acharModuloPorId(toc, UNIT_ID);
    if (unidade) {
      raiz = unidade;
    } else {
      logWarning(`Unidade ${UNIT_ID} não encontrada no toc — varrendo o curso inteiro`, 'ava');
    }
  }

  const kw = normalizar(KEYWORD);
  const porData = new Map<string, CapelaAva>();

  const visitar = (mod: any): void => {
    for (const topico of mod?.Topics ?? []) {
      const titulo = String(topico?.Title ?? '').trim();
      const data = titulo.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (!data || !normalizar(titulo).includes(kw)) continue;
      const dataISO = `${data[3]}-${data[2]}-${data[1]}`;
      if (!porData.has(dataISO)) porData.set(dataISO, { titulo, dataISO });
    }
    for (const filho of mod?.Modules ?? []) visitar(filho);
  };
  visitar(raiz);

  return [...porData.values()].sort((a, b) => a.dataISO.localeCompare(b.dataISO));
}

// ──────────────────────────────────────────────────────────────────────────────
// SESSÃO POR USUÁRIO — conectar / reconectar / desconectar / status
// ──────────────────────────────────────────────────────────────────────────────

const salvarSessao = async (ra: string, client: AxiosInstance, loginUsado: string): Promise<void> => {
  // O jar acumula cookies dos dois domínios (JACAD e Brightspace) — serializado,
  // restaura a sessão completa sem nova senha. O login do portal que funcionou
  // também fica salvo (cifrado): na reconexão automática do login do app ele
  // volta como primeira tentativa, antes de RA/e-mail.
  const cookiesEnc = encrypt(JSON.stringify(((client.defaults as any).jar as CookieJar).serializeSync()));
  await prisma.avaSessao.upsert({
    where: { alunoRa: ra },
    create: { alunoRa: ra, cookiesEnc, loginPortalEnc: encrypt(loginUsado) },
    update: { cookiesEnc, loginPortalEnc: encrypt(loginUsado) },
  });
};

/** Logins candidatos na conexão: o que o usuário informou (CPF, por exemplo),
 *  o que já funcionou antes, o RA do app e o e-mail — sem repetidos. */
async function loginsDeConexao(ra: string, senha: string, email?: string, loginManual?: string): Promise<string[]> {
  const sessao = await prisma.avaSessao.findUnique({ where: { alunoRa: ra }, select: { loginPortalEnc: true } });
  const salvo = sessao?.loginPortalEnc ? decrypt(sessao.loginPortalEnc) : null;
  return [...new Set([loginManual, salvo, ra, email].filter((l): l is string => Boolean(l)))];
}

/**
 * Valida as credenciais no portal JACAD (tenta o login informado — CPF, por
 * exemplo — depois o que já funcionou, o RA e o e-mail do app), cria a sessão
 * do Brightspace e salva os cookies cifrados. Chama o serviço de usuário
 * logado — e automaticamente no login do app.
 */
export const conectarPortal = async (ra: string, senha: string, email?: string, loginManual?: string): Promise<void> => {
  const tentativas = await loginsDeConexao(ra, senha, email, loginManual);

  for (const login of tentativas) {
    const client = criarCliente();
    try {
      const homeHtml = await loginJacad(client, login, senha);
      // SSO logo na conexão — na sync basta o lerToc direto.
      await abrirSessaoD2L(client, linksAva(homeHtml)).catch((e) =>
        logWarning(`Login no portal OK, mas o SSO falhou agora (a sync tenta refazer): ${e.message}`, 'ava'),
      );
      await salvarSessao(ra, client, login);
      logSuccess(`Portal conectado: ${ra} (login do portal: ${login})`, 'ava');
      return;
    } catch (e: any) {
      if (login === tentativas[tentativas.length - 1]) throw e;
      logInfo(`Login com ${login} recusado — tentando próximo`, 'ava');
    }
  }
};

export const desconectarPortal = async (ra: string): Promise<void> => {
  await prisma.avaSessao.deleteMany({ where: { alunoRa: ra } });
  logSuccess(`Portal desconectado: ${ra}`, 'ava');
};

export const statusPortal = async (ra: string): Promise<{ conectado: boolean; conectadoEm: Date | null }> => {
  const sessao = await prisma.avaSessao.findUnique({ where: { alunoRa: ra } });
  return { conectado: Boolean(sessao), conectadoEm: sessao?.updatedAt ?? null };
};

/** Sessão cifrada → cliente com os cookies restaurados. */
async function clienteDaSessao(ra: string): Promise<AxiosInstance> {
  const sessao = await prisma.avaSessao.findUnique({ where: { alunoRa: ra } });
  if (!sessao) {
    throw erroAva('Este usuário não conectou o portal do AVA. Conecte em POST /ava/conectar informando a senha do portal (a senha não fica salva — a sessão foi criada no login do app).', 401);
  }

  try {
    const jar = CookieJar.fromJSON(decrypt(sessao.cookiesEnc));
    return criarCliente(jar);
  } catch (e: any) {
    // Chave de cifragão trocada ou cookie corrompido: sessão ilegível.
    await desconectarPortal(ra);
    throw erroAva('A sessão do AVA estava corrompida (e já foi removida). Reconecte em POST /ava/conectar.', 401);
  }
}

/**
 * Garante o toc com a sessão salva, sem pedir senha de novo:
 * 1) tenta lerToc direto (sessão D2L salva ainda vale);
 * 2) falhou, refaz o SSO usando a sessão JACAD salva;
 * 3) a home do portal voltou ao form de login → sessão expirou de verdade:
 *    só o usuário resolvendo, com a senha dele (POST /ava/conectar).
 */
async function obterTocComSessao(client: AxiosInstance): Promise<any> {
  try {
    return await lerToc(client);
  } catch {
    logInfo('Sessão do Brightspace não serviu — tentando refazer o SSO pelo portal', 'ava');
  }

  const resp = await client.get(`${JACAD_BASE}/academico/aluno-v2/`, { validateStatus: () => true });
  const homeHtml = String(resp.data);
  if (homeHtml.includes('name="login.password"')) {
    throw erroAva('A sessão do portal expirou. Reconecte em POST /ava/conectar informando a senha do portal.', 401);
  }

  await abrirSessaoD2L(client, linksAva(homeHtml));
  return await lerToc(client);
}

// ──────────────────────────────────────────────────────────────────────────────
// SINCRONIZAÇÃO — cria no app as capelas que só existem no AVA
// ──────────────────────────────────────────────────────────────────────────────

export const sincronizarComAva = async (semestreId: string, ra: string): Promise<SincronizacaoAvaResultado> => {
  const semestre = await prisma.semestre.findUnique({ where: { id: semestreId } });
  if (!semestre) throw erroAva('Semestre não encontrado', 404);

  const client = await clienteDaSessao(ra);
  const toc = await obterTocComSessao(client);

  const ava = extrairCapelasDoToc(toc);
  if (ava.length === 0) {
    throw erroAva(`Nenhum tópico "${KEYWORD} - DD/MM/AAAA" encontrado no AVA. Sync abortada para não devolver um diff vazio enganoso — confira AVA_ORG_UNIT/AVA_UNIT e CHAPEL_KEYWORD.`);
  }

  // O curso pode listar capelas de outros períodos — vale o intervalo do semestre.
  const doSemestre = ava.filter((c) => {
    const d = new Date(c.dataISO);
    return d >= semestre.publishedAfter && d <= semestre.publishedBefore;
  });

  const salvas = await prisma.capela.findMany({
    where:  { semestreId },
    select: { data: true },
  });
  const datasSalvas = new Set(salvas.map((c) => c.data.toISOString().slice(0, 10)));

  const criadas: (CapelaAva & { id: string })[] = [];
  for (const [n, c] of doSemestre.entries()) {
    if (datasSalvas.has(c.dataISO)) continue;

    // Sem vídeo/tema/pregador: o AVA só garante a data. O admin completa depois
    // com PATCH /capela/:id; sinopse só depois de preencher (regra já existente).
    // Índice provisório fora da faixa; renumerarPorData acerta no fim.
    const capela = await prisma.capela.create({
      data: {
        semestreId,
        indice: 200000 + n,
        data:   new Date(c.dataISO), // meia-noite UTC — mesma convenção da coleta YouTube
        source: 'ava',
      },
    });
    criadas.push({ ...c, id: capela.id });
    logSuccess(`Capela criada a partir do AVA: ${c.titulo} (${c.dataISO})`, 'ava');
  }

  const indices = criadas.length > 0 ? await renumerarPorData(semestreId) : null;
  const criadasFinal: CapelaCriadaAva[] = criadas.map((c) => ({
    ...c,
    indice: indices?.get(c.id) ?? 0,
  }));

  // Diff inverso (informativo): datas no app que o AVA não lista. Nada é apagado.
  const datasAva = new Set(doSemestre.map((c) => c.dataISO));
  const soNoApp = [...datasSalvas].filter((d) => !datasAva.has(d)).sort();

  logSuccess(
    `Sync AVA concluída (${ra}) — no AVA: ${doSemestre.length}, criadas: ${criadas.length}, já existiam: ${doSemestre.length - criadas.length}, só no app: ${soNoApp.length}`,
    'ava',
  );

  return {
    semestreId,
    totalAva:        doSemestre.length,
    foraDoSemestre:  ava.length - doSemestre.length,
    jaExistiam:      doSemestre.length - criadas.length,
    criadas:         criadasFinal,
    soNoApp,
  };
};
