// Gera um relatório de exemplo a partir do template e confere que os campos
// entraram e o XML segue válido. Rodar: npx tsx scripts/check-docx.ts
import assert from 'assert';
import fs from 'fs';
import JSZip from 'jszip';
import { generateDocx } from '../src/services/docx.service';

(async () => {
  const capelas = Array.from({ length: 22 }, (_, i) => ({
    indice: i + 1, data: new Date(Date.UTC(2026, 7, 4 + i * 7)),
    textoBiblico: i === 3 ? null : `Rm 10:${i + 1}`, tema: `Tema $1 & <${i + 1}>`, pregador: 'Pr. Fulano',
  }));
  const buf = await generateDocx(
    { nome: 'Maria da Silva', ra: '1', semestre: '2º Semestre 2026', curso: 'TEOLOGIA' },
    capelas,
    { reflexao: 'Primeiro parágrafo da reflexão.\nSegundo parágrafo.', liturgica: 'Análise litúrgica única.' },
  );
  const xml = await (await JSZip.loadAsync(buf)).file('word/document.xml')!.async('string');
  const texto = (xml.match(/<w:t[^>]*>[^<]*<\/w:t>/g) ?? []).map((t) => t.replace(/<[^>]+>/g, '')).join('|');

  for (const esperado of ['Maria da Silva', 'Teologia', '2º Semestre 2026', '22', '29/12/2026',
    'Tema $1 &amp; &lt;22&gt;', 'Segundo parágrafo.', 'Análise litúrgica única.', '—']) {
    assert(texto.includes(esperado), `faltou: ${esperado}`);
  }
  assert(!texto.includes('[ Insira seu texto aqui ]'), 'sobrou placeholder');
  assert(!/_{5,}/.test(texto), 'sobrou ______ no cabeçalho');
  assert.equal((xml.match(/<w:tr[ >]/g) ?? []).length, 1 + 1 + 22, 'linhas da tabela');
  fs.writeFileSync(process.argv[2] ?? 'relatorio-exemplo.docx', buf);
  console.log('ok');
})();
