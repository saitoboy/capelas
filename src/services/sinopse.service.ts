import prisma from '../utils/prisma';
import { callGroq } from '../utils/groq';
import { SinopsePublica } from '../types';
import { logSuccess } from '../utils/logger';

// ──────────────────────────────────────────────────────────────────────────────

const toPublico = (s: any): SinopsePublica => ({
  id:        s.id,
  capelaId:  s.capelaId,
  texto:     s.texto,
  geradoEm:  s.geradoEm,
});

// ──────────────────────────────────────────────────────────────────────────────

export const gerarSinopse = async (capelaId: string): Promise<SinopsePublica> => {
  const capela = await prisma.capela.findUnique({ where: { id: capelaId } });
  if (!capela) {
    const err = new Error('Capela não encontrada') as any;
    err.status = 404;
    throw err;
  }

  const dataFormatada = new Date(capela.data).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC',
  });

  const prompt = `
Com base nos dados da pregação abaixo, escreva uma sinopse de 3 a 5 frases
descrevendo o conteúdo central da mensagem. Não use markdown, não use títulos,
escreva em português formal como parte de um relatório acadêmico.

Dados da pregação:
- Data: ${dataFormatada}
- Texto Bíblico: ${capela.textoBiblico}
- Tema: ${capela.tema}
- Pregador: ${capela.pregador}
`.trim();

  const texto = (await callGroq(prompt)).trim();

  const sinopse = await prisma.sinopse.upsert({
    where:  { capelaId },
    update: { texto, geradoEm: new Date() },
    create: { capelaId, texto },
  });

  logSuccess(`Sinopse gerada: capelaId=${capelaId}`, 'sinopse');
  return toPublico(sinopse);
};

// ──────────────────────────────────────────────────────────────────────────────

export const buscarSinopse = async (capelaId: string): Promise<SinopsePublica> => {
  const sinopse = await prisma.sinopse.findUnique({ where: { capelaId } });
  if (!sinopse) {
    const err = new Error('Sinopse não encontrada') as any;
    err.status = 404;
    throw err;
  }
  return toPublico(sinopse);
};
