import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';

// O relatório sai do próprio Template oficial da disciplina (assets/), só com
// os campos preenchidos — o professor exige o modelo dele, não uma imitação.
// Template novo? Troque o arquivo; os marcadores abaixo são os textos dele.
const MODELO = path.join(__dirname, '../../assets/relatorio-modelo.docx');

export interface AlunoInfo {
  nome:     string;
  ra:       string;
  semestre: string;
  curso:    string;
}

export interface ChapelRow {
  indice:       number;
  data:         Date | string;
  textoBiblico: string | null;
  tema:         string | null;
  pregador:     string | null;
}

export interface Reflections {
  reflexao:  string;
  liturgica: string;
}

// ──────────────────────────────────────────────────────────────────────────────

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Campo não preenchido vira travessão na tabela — nunca "null" escrito no DOCX. */
const ou = (v: string | null | undefined): string => v?.trim() || '—';

const dataBr = (d: Date | string): string =>
  new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' });

const cursoBonito = (c: string): string => c.charAt(0) + c.slice(1).toLowerCase();

function falhar(marcador: string): never {
  throw new Error(`Template do relatório mudou: não achei "${marcador}"`);
}

/** Troca o texto da 1ª <w:t> da célula (ou preenche o run vazio dela). */
function preencherCelula(tc: string, texto: string): string {
  if (/<w:t[ >]/.test(tc)) {
    return tc.replace(/(<w:t[^>]*>)[^<]*(<\/w:t>)/, (_m, a, b) => a + esc(texto) + b);
  }
  // Célula vazia do modelo: o run não tem formatação, então herda a do parágrafo.
  const rPr = tc.match(/<w:pPr>[\s\S]*?<w:rPr>([\s\S]*?)<\/w:rPr>/)?.[1] ?? '';
  return tc.replace(
    /<w:r [^>]*><w:rPr><w:rtl w:val="0"\/><\/w:rPr><\/w:r>/,
    () => `<w:r><w:rPr>${rPr}</w:rPr><w:t xml:space="preserve">${esc(texto)}</w:t></w:r>`,
  );
}

/** Tabela de capelas: a linha 1 do modelo vira molde, uma cópia por capela. */
function preencherTabela(xml: string, capelas: ChapelRow[]): string {
  const ini = xml.lastIndexOf('<w:tbl>', xml.indexOf('Pregador(a)'));
  if (ini < 0 || xml.indexOf('Pregador(a)') < 0) falhar('Pregador(a)');
  const fim = xml.indexOf('</w:tbl>', ini);
  const tabela = xml.slice(ini, fim);

  const linhas = tabela.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g) ?? [];
  if (linhas.length < 2) falhar('linhas da tabela de capelas');
  const [cabecalho, molde] = linhas as [string, string];

  const novas = capelas.map((c) => {
    const valores = [String(c.indice), dataBr(c.data), ou(c.textoBiblico), ou(c.tema), ou(c.pregador)];
    let i = 0;
    return molde.replace(/<w:tc>[\s\S]*?<\/w:tc>/g, (tc) => preencherCelula(tc, valores[i++] ?? ''));
  });

  const antes = tabela.slice(0, tabela.indexOf(cabecalho));
  return xml.slice(0, ini) + antes + cabecalho + novas.join('') + xml.slice(fim);
}

/** Troca o parágrafo "[ Insira seu texto aqui ]" por um parágrafo por linha do texto. */
function preencherTexto(xml: string, texto: string): string {
  const alvo = '[ Insira seu texto aqui ]';
  const pos = xml.indexOf(alvo);
  if (pos < 0) falhar(alvo);
  const ini = xml.lastIndexOf('<w:p ', pos);
  const fim = xml.indexOf('</w:p>', pos) + '</w:p>'.length;

  // Mesmo recuo do modelo, mas em cor de texto normal e sem o fundo de "placeholder".
  const molde = xml
    .slice(ini, fim)
    .replace(/94a3b8/g, '1e293b')
    .replace(/<w:shd w:fill="fafafa" w:val="clear"\/>/g, '')
    .replace(/<w:sz w:val="18"\/><w:szCs w:val="18"\/>/g, '<w:sz w:val="22"/><w:szCs w:val="22"/>')
    .replace('<w:rPr>', '<w:jc w:val="both"/><w:rPr>');

  const paragrafos = texto
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => molde.replace(alvo, () => esc(l)));

  return xml.slice(0, ini) + paragrafos.join('') + xml.slice(fim);
}

// ──────────────────────────────────────────────────────────────────────────────

export async function generateDocx(
  alunoInfo:   AlunoInfo,
  chapels:     ChapelRow[],
  reflections: Reflections,
): Promise<Buffer> {
  const zip = await JSZip.loadAsync(fs.readFileSync(MODELO));
  let xml = await zip.file('word/document.xml')!.async('string');

  // Cabeçalho: os 3 primeiros "______" são Nome, Curso e Semestre/Ano, nessa ordem.
  const cabecalho = [alunoInfo.nome, cursoBonito(alunoInfo.curso), alunoInfo.semestre];
  let n = 0;
  xml = xml.replace(/(<w:t[^>]*>)_{5,}(<\/w:t>)/g, (m, a, b) =>
    n < cabecalho.length ? `${a}${esc(cabecalho[n++])}${b}` : m,
  );
  if (n < cabecalho.length) falhar('Nome do Estudante / Curso / Semestre');

  xml = preencherTabela(xml, chapels);
  xml = preencherTexto(xml, reflections.reflexao);  // 2. Reflexão Teológica
  xml = preencherTexto(xml, reflections.liturgica); // 3. Análise Litúrgica

  zip.file('word/document.xml', xml);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
