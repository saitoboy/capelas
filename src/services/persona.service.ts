import prisma from '../utils/prisma';
import { MbtiTipo, PersonaPublica, PresetPersonaBody, TestePersonaBody } from '../types';
import { logSuccess } from '../utils/logger';

// ──────────────────────────────────────────────────────────────────────────────
// Mapa de nome e tom por tipo MBTI
// ──────────────────────────────────────────────────────────────────────────────

const PERSONA_MAP: Record<MbtiTipo, { nome: string; tom: string }> = {
  INTJ: { nome: 'O Arquiteto',      tom: 'estratégico e direto'       },
  INTP: { nome: 'O Lógico',         tom: 'analítico e curioso'        },
  ENTJ: { nome: 'O Comandante',     tom: 'assertivo e visionário'     },
  ENTP: { nome: 'O Inovador',       tom: 'debatedor e criativo'       },
  INFJ: { nome: 'O Advogado',       tom: 'empático e idealista'       },
  INFP: { nome: 'O Mediador',       tom: 'reflexivo e poético'        },
  ENFJ: { nome: 'O Protagonista',   tom: 'inspirador e acolhedor'     },
  ENFP: { nome: 'O Ativista',       tom: 'entusiasta e expressivo'    },
  ISTJ: { nome: 'O Inspetor',       tom: 'metódico e confiável'       },
  ISFJ: { nome: 'O Defensor',       tom: 'cuidadoso e leal'           },
  ESTJ: { nome: 'O Executivo',      tom: 'organizado e pragmático'    },
  ESFJ: { nome: 'O Cônsul',         tom: 'prestativo e sociável'      },
  ISTP: { nome: 'O Virtuoso',       tom: 'prático e observador'       },
  ISFP: { nome: 'O Aventureiro',    tom: 'gentil e espontâneo'        },
  ESTP: { nome: 'O Empreendedor',   tom: 'energético e ousado'        },
  ESFP: { nome: 'O Animador',       tom: 'divertido e espontâneo'     },
};

// ──────────────────────────────────────────────────────────────────────────────
// Derivação de tipo a partir do teste (8 respostas A/B, 2 por dimensão)
// Dimensões: [E/I, E/I, S/N, S/N, T/F, T/F, J/P, J/P]
// A = primeira letra, B = segunda letra de cada dimensão
// ──────────────────────────────────────────────────────────────────────────────

const derivarTipo = (respostas: ('A' | 'B')[]): MbtiTipo => {
  const dimensoes: [string, string][] = [
    ['E', 'I'], // pergunta 1
    ['E', 'I'], // pergunta 2
    ['S', 'N'], // pergunta 3
    ['S', 'N'], // pergunta 4
    ['T', 'F'], // pergunta 5
    ['T', 'F'], // pergunta 6
    ['J', 'P'], // pergunta 7
    ['J', 'P'], // pergunta 8
  ];

  const contagem = [0, 0, 0, 0]; // E, S, T, J
  for (let i = 0; i < 8; i++) {
    if (respostas[i] === 'A') contagem[Math.floor(i / 2)]++;
  }

  const tipo =
    (contagem[0] >= 1 ? 'E' : 'I') +
    (contagem[1] >= 1 ? 'S' : 'N') +
    (contagem[2] >= 1 ? 'T' : 'F') +
    (contagem[3] >= 1 ? 'J' : 'P');

  return tipo as MbtiTipo;
};

// ──────────────────────────────────────────────────────────────────────────────

const upsertPersona = async (ra: string, tipo: MbtiTipo): Promise<PersonaPublica> => {
  const { nome, tom } = PERSONA_MAP[tipo];

  const persona = await prisma.persona.upsert({
    where: { alunoRa: ra },
    update: { tipo, nome, tom },
    create: { alunoRa: ra, tipo, nome, tom },
  });

  return persona as unknown as PersonaPublica;
};

// ──────────────────────────────────────────────────────────────────────────────

export const definirPorPreset = async (ra: string, body: PresetPersonaBody): Promise<PersonaPublica> => {
  const persona = await upsertPersona(ra, body.tipo);
  logSuccess(`Persona preset definida: ${ra} → ${body.tipo}`, 'persona');
  return persona;
};

// ──────────────────────────────────────────────────────────────────────────────

export const definirPorTeste = async (ra: string, body: TestePersonaBody): Promise<PersonaPublica> => {
  if (body.respostas.length !== 8) {
    const err = new Error('São necessárias exatamente 8 respostas') as any;
    err.status = 400;
    throw err;
  }

  const tipo = derivarTipo(body.respostas);
  const persona = await upsertPersona(ra, tipo);
  logSuccess(`Persona por teste definida: ${ra} → ${tipo}`, 'persona');
  return persona;
};

// ──────────────────────────────────────────────────────────────────────────────

export const buscarPersona = async (ra: string): Promise<PersonaPublica> => {
  const persona = await prisma.persona.findUnique({ where: { alunoRa: ra } });

  if (!persona) {
    const err = new Error('Persona não encontrada') as any;
    err.status = 404;
    throw err;
  }

  return persona as unknown as PersonaPublica;
};
