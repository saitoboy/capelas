import { MbtiTipo } from '../types';

// ──────────────────────────────────────────────────────────────────────────────
// Perguntas mockadas do teste de persona
//
// IMPORTANTE: a ordem deste array precisa bater exatamente com a ordem de
// dimensões usada em `derivarTipo` (persona.service.ts):
//   [0] E/I   [1] E/I   [2] S/N   [3] S/N   [4] T/F   [5] T/F   [6] J/P   [7] J/P
//
// opcaoA sempre corresponde à primeira letra da dimensão (E, S, T, J)
// opcaoB sempre corresponde à segunda letra da dimensão (I, N, F, P)
// ──────────────────────────────────────────────────────────────────────────────

export interface PersonaPergunta {
  id: number;
  dimensao: string;       // apenas informativo, ex: "E/I"
  pergunta: string;
  opcaoA: string;
  opcaoB: string;
}

export const PERSONA_PERGUNTAS: PersonaPergunta[] = [
  {
    id: 1,
    dimensao: 'E/I',
    pergunta: 'Quando você chega para o culto, o que costuma fazer primeiro?',
    opcaoA: 'Cumprimento várias pessoas e puxo conversa antes de sentar',
    opcaoB: 'Prefiro sentar logo e ficar em silêncio, observando o ambiente',
  },
  {
    id: 2,
    dimensao: 'E/I',
    pergunta: 'Durante os momentos de oração em grupo, você...',
    opcaoA: 'Gosto de orar em voz alta ou compartilhar pedidos com os outros',
    opcaoB: 'Prefiro orar internamente, sem verbalizar para o grupo',
  },
  {
    id: 3,
    dimensao: 'S/N',
    pergunta: 'Na hora da pregação, o que mais prende sua atenção?',
    opcaoA: 'Exemplos práticos e aplicações diretas para o dia a dia',
    opcaoB: 'As conexões teológicas e ideias mais amplas por trás da mensagem',
  },
  {
    id: 4,
    dimensao: 'S/N',
    pergunta: 'Quando alguém explica um texto bíblico, você prefere...',
    opcaoA: 'Entender o contexto histórico e os fatos concretos do texto',
    opcaoB: 'Explorar interpretações simbólicas e significados possíveis',
  },
  {
    id: 5,
    dimensao: 'T/F',
    pergunta: 'Se um colega compartilha uma dificuldade durante a comunhão, você...',
    opcaoA: 'Tento ajudar com um conselho prático e objetivo',
    opcaoB: 'Acolho emocionalmente, demonstrando empatia antes de tudo',
  },
  {
    id: 6,
    dimensao: 'T/F',
    pergunta: 'Para você, o que define um "bom culto"?',
    opcaoA: 'A mensagem foi clara, organizada e bem fundamentada',
    opcaoB: 'Eu senti algo especial e me emocionei durante o culto',
  },
  {
    id: 7,
    dimensao: 'J/P',
    pergunta: 'Sobre sua participação nas atividades da capela, você...',
    opcaoA: 'Gosto de me planejar e saber com antecedência a programação',
    opcaoB: 'Prefiro ir me ajustando conforme o culto acontece',
  },
  {
    id: 8,
    dimensao: 'J/P',
    pergunta: 'Quando o culto muda de última hora (outro pregador, ordem diferente), você...',
    opcaoA: 'Fico incomodado e prefiro que tudo siga o combinado',
    opcaoB: 'Não me importo, me adapto fácil e até gosto da surpresa',
  },
];

// Tipo auxiliar para o front, se precisar validar antes de enviar pro backend
export type RespostaPersona = 'A' | 'B';

export const totalPerguntas = PERSONA_PERGUNTAS.length; // deve ser sempre 8
