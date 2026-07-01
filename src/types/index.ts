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
  curso: Curso;
  isAdmin: boolean;
  createdAt: Date;
}

export interface RegisterBody {
  ra: string;
  nome: string;
  senha: string;
  curso: Curso;
}

export interface LoginBody {
  ra: string;
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
  id: number;
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
  id: number;
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
  id: number;
  semestreId: number;
  indice: number;
  data: Date;
  videoId: string | null;
  url: string | null;
  textoBiblico: string;
  tema: string;
  pregador: string;
  source: string;
  createdAt: Date;
  sinopse?: SinopsePublica | null;
}

export interface CreateCapelaManualBody {
  semestreId: number;
  indice: number;
  data: string;        // ISO 8601 date
  textoBiblico: string;
  tema: string;
  pregador: string;
}

export interface ColetarCapelasBody {
  semestreId: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// SINOPSE
// ──────────────────────────────────────────────────────────────────────────────

export interface SinopsePublica {
  id: number;
  capelaId: number;
  texto: string;
  geradoEm: Date;
}

// ──────────────────────────────────────────────────────────────────────────────
// RELATÓRIO
// ──────────────────────────────────────────────────────────────────────────────

export type StatusRelatorio = 'PENDENTE' | 'GERANDO' | 'CONCLUIDO' | 'ERRO';

export type FocoCriativo = 'pastoral' | 'teológico' | 'litúrgico' | 'histórico-bíblico';

export interface RelatorioPublico {
  id: number;
  alunoRa: string;
  semestreId: number;
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
