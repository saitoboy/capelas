import prisma from './prisma';

/**
 * Numera as capelas do semestre pela data (1, 2, 3…). Uma capela nova pode cair
 * no meio do semestre, e o índice é único por semestre — então passa tudo por
 * negativos antes, para nenhuma troca colidir no meio do caminho.
 *
 * Morre aqui fora (não no capela.service) porque a coleta do YouTube e a
 * sincronização do AVA precisam dela — e um importando o outro geraria ciclo.
 */
export async function renumerarPorData(semestreId: string): Promise<Map<string, number>> {
  const capelas = await prisma.capela.findMany({
    where:   { semestreId },
    orderBy: [{ data: 'asc' }, { createdAt: 'asc' }],
    select:  { id: true },
  });

  await prisma.$transaction([
    ...capelas.map((c, i) => prisma.capela.update({ where: { id: c.id }, data: { indice: -(i + 1) } })),
    ...capelas.map((c, i) => prisma.capela.update({ where: { id: c.id }, data: { indice: i + 1 } })),
  ]);

  return new Map(capelas.map((c, i) => [c.id, i + 1]));
}
