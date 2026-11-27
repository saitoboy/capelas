import { Request } from 'express';
import { Curso } from '@prisma/client';
export { Curso } from '@prisma/client';

// ──────────────────────────────────────────────────────────────────────────────
// JWT
// ──────────────────────────────────────────────────────────────────────────────

export interface JwtPayload {
  sub: string;   // ra do aluno
  isAdmin: boolean;
}

// Request autenticado — injeta `user` após passar pelo authMiddleware
export interface AuthRequest extends Request {
  user?: JwtPayload;
}

// ──────────────────────────────────────────────────────────────────────────────
// USUÁRIO
// ──────────────────────────────────────────────────────────────────────────────

export interface UsuarioPublico {
  ra: string;
  nome: string;
  email: string;
  curso: Curso;
  isAdmin: boolean;
  createdAt: Date;
}

export interface RegisterBody {
  ra: string;
  nome: string;
  email: string;
  senha: string;
  confirmSenha: string;
  curso: Curso;
}

export interface LoginBody {
  ra: string;
  senha: string;
}

// Admin gerenciando usuários. Diferente do register: o admin escolhe isAdmin e
// não devolve token — ninguém entra logado como a conta que acabou de criar.
export interface AdminCreateUsuarioBody {
  ra: string;
  nome: string;
  email: string;
  senha: string;
  curso: Curso;
  isAdmin?: boolean;
  // A partir do cadastro "conta do JACAD": a senha deve ser a do portal do AVA.
  loginPortal?: string;  // CPF/e-mail do portal, para quem não loga lá pelo RA
  groqKey?: string;      // chave gsk_ criada em console.groq.com/keys
}

/** Resposta do POST /usuario — avisos de portal/chave não bloqueiam a criação. */
export interface AdminCreateUsuarioRes extends UsuarioPublico {
  avaConectado: boolean;
  avisoAva: string | null;
  chaveGroqCadastrada: boolean;
  avisoGroq: string | null;
}

// PATCH: todo campo é opcional. Senha fica de fora — tem rota própria.
export interface AdminUpdateUsuarioBody {
  nome?: string;
  email?: string;
  curso?: Curso;
  isAdmin?: boolean;
}

export interface TrocarSenhaBody {
  senha: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// PERSONA
// ──────────────────────────────────────────────────────────────────────────────

export type MbtiTipo =
  | 'INTJ' | 'INTP' | 'ENTJ' | 'ENTP'
  | 'INFJ' | 'INFP' | 'ENFJ' | 'ENFP'
  | 'ISTJ' | 'ISFJ' | 'ESTJ' | 'ESFJ'
  | 'ISTP' | 'ISFP' | 'ESTP' | 'ESFP';

export interface PersonaPublica {
  id: string;
  alunoRa: string;
  tipo: MbtiTipo;
  nome: string;
  tom: string;
  updatedAt: Date;
}

export interface PresetPersonaBody {
  tipo: MbtiTipo;
}

export interface TestePersonaBody {
  respostas: ('A' | 'B')[];  // array de exatamente 8 itens
}

// ──────────────────────────────────────────────────────────────────────────────
// SEMESTRE
// ──────────────────────────────────────────────────────────────────────────────

export interface SemestrePublico {
  id: string;
  label: string;
  publishedAfter: Date;
  publishedBefore: Date;
  ativo: boolean;
  createdAt: Date;
}

export interface CreateSemestreBody {
  label: string;
  publishedAfter: string;   // ISO 8601
  publishedBefore: string;  // ISO 8601
}

// ──────────────────────────────────────────────────────────────────────────────
// CAPELA
// ──────────────────────────────────────────────────────────────────────────────

export interface CapelaPublica {
  id: string;
  semestreId: string;
  indice: number;
  data: Date;
  videoId: string | null;
  url: string | null;
  // null = a IA não extraiu; falta o admin preencher à mão (PATCH /capela/:id).
  textoBiblico: string | null;
  tema: string | null;
  pregador: string | null;
  source: string;
  createdAt: Date;
  sinopse?: SinopsePublica | null;
}

export interface CreateCapelaManualBody {
  semestreId: string;
  indice: number;
  data: string;                   // ISO 8601 date
  textoBiblico?: string | null;   // opcionais — dá para criar a capela e
  tema?: string | null;           // preencher depois
  pregador?: string | null;
}

/**
 * Edição manual. Campo omitido fica como está; `null` explícito limpa o campo.
 */
export interface UpdateCapelaBody {
  textoBiblico?: string | null;
  tema?: string | null;
  pregador?: string | null;
  data?: string;                  // ISO 8601 date
}

export interface ColetarCapelasBody {
  semestreId: string;
  // Todos opcionais — omitidos, caem nas datas do semestre e nos defaults do .env.
  publishedAfter?:  string;  // ISO 8601
  publishedBefore?: string;  // ISO 8601
  canal?:           string;  // "@souseminariodosul"
  keyword?:         string;  // "Devoção na Capela"
  weekday?:         number;  // 0 = domingo … 6 = sábado
  gerarSinopses?:   boolean; // default: true
}

// ──────────────────────────────────────────────────────────────────────────────
// SINCRONIZAÇÃO COM O AVA (JACAD + Brightspace)
// ──────────────────────────────────────────────────────────────────────────────

export interface SincronizarAvaBody {
  semestreId: string;
}

/** Conexão do portal: a senha vai no body e NUNCA é guardada —
 *  só os cookies de sessão, cifrados (model AvaSessao).
 *  `login` é opcional: o identificador do portal (CPF, RA ou e-mail) para quem
 *  não loga lá pelo RA do app. Salvo cifrado após a primeira conexão bem-sucedida. */
export interface ConectarAvaBody {
  senha: string;
  login?: string;
}

/** O que GET /ava/conectar devolve — sem nunca expor os cookies. */
export interface AvaSessaoPublica {
  conectado: boolean;
  conectadoEm: Date | null;  // última conexão/reconexão bem-sucedida
}

/** Um tópico de capela lido no sumário do AVA. */
export interface CapelaAva {
  titulo:  string;  // "Devoção na Capela - 04/08/2026"
  dataISO: string;  // "2026-08-04"
}

export interface CapelaCriadaAva extends CapelaAva {
  id:     string;
  indice: number;   // índice definitivo após a renumeração por data
}

export interface SincronizacaoAvaResultado {
  semestreId:      string;
  totalAva:        number;  // capelas do AVA dentro do período do semestre
  foraDoSemestre:  number;  // capelas do AVA fora do período (ignoradas)
  jaExistiam:      number;  // já estavam no app (cruzamento por data) — não tocadas
  criadas:         CapelaCriadaAva[];
  /** Datas (ISO) que estão no app mas não no AVA. Só informativo — nada é apagado. */
  soNoApp:         string[];
}

// ──────────────────────────────────────────────────────────────────────────────
// COLETA (job em background)
// ──────────────────────────────────────────────────────────────────────────────

export type StatusColeta = 'GERANDO' | 'CONCLUIDO' | 'ERRO';

/** Uma linha do log da coleta — é o que a tela do admin mostra. */
export interface ColetaItem {
  indice: number;
  tema:   string | null;
  /** De onde o dado veio: comentarios | comentarios+transcricao | parcial | incompleto */
  source: string;
  /** Campos que a IA não extraiu e o admin precisa preencher à mão. */
  faltando: string[];
  erro?:  string;
}

export interface ColetaPublica {
  id:          string;
  semestreId:  string;
  status:      StatusColeta;
  etapa:       string | null;
  total:       number;
  processadas: number;
  inseridas:   number;
  atualizadas: number;
  /** Vídeos descartados pelos filtros (sem data no título, dia da semana errado). */
  ignorados:   number;
  itens:       ColetaItem[];
  erroMsg:     string | null;
  createdAt:   Date;
  updatedAt:   Date;
}

// ──────────────────────────────────────────────────────────────────────────────
// CHAVES DA GROQ
// ──────────────────────────────────────────────────────────────────────────────

export type GroqKeyStatus = 'ATIVA' | 'ESGOTADA' | 'INVALIDA';

/** A chave em si nunca aparece aqui — só o preview mascarado. */
export interface GroqKeyPublica {
  id:         string;
  label:      string;
  preview:    string;          // "gsk_…4f2a"
  status:     GroqKeyStatus;
  resetAt:    Date | null;     // quando uma ESGOTADA volta
  lastUsedAt: Date | null;
  erroMsg:    string | null;
  criadoPor:  string;
  createdAt:  Date;
  tokensHoje: number;         // tokens gastos hoje (cota diária TPD)
  tpd:        number | null;  // limite diário do plano; null = GROQ_TPD não configurado
}

export interface CreateGroqKeyBody {
  label: string;
  key:   string;
}

// ──────────────────────────────────────────────────────────────────────────────
// SINOPSE
// ──────────────────────────────────────────────────────────────────────────────

export interface SinopsePublica {
  id: string;
  capelaId: string;
  texto: string;
  geradoEm: Date;
}

// ──────────────────────────────────────────────────────────────────────────────
// RELATÓRIO
// ──────────────────────────────────────────────────────────────────────────────

export type StatusRelatorio = 'PENDENTE' | 'GERANDO' | 'CONCLUIDO' | 'ERRO';

export type FocoCriativo = 'pastoral' | 'teológico' | 'litúrgico' | 'histórico-bíblico';

export interface RelatorioPublico {
  id: string;
  alunoRa: string;
  semestreId: string;
  personaTipo: string;
  personaNome: string;
  focoCriativo: FocoCriativo | null;
  reflexaoTeologica: string | null;
  analiseLiturgica: string | null;
  status: StatusRelatorio;
  erroMsg: string | null;
  createdAt: Date;
  updatedAt: Date;
}
