import {
  Document, Packer, Paragraph, TextRun,
  Table, TableRow, TableCell, ImageRun,
  AlignmentType, BorderStyle, WidthType,
  ShadingType, VerticalAlign,
} from 'docx';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';

// ──────────────────────────────────────────────────────────────────────────────

const CELL_MARGINS = { top: 80, bottom: 80, left: 120, right: 120 };
const BORDER       = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
const BORDERS      = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };

const HEADER_SHADING    = { fill: '2E75B6', type: ShadingType.CLEAR };
const ROW_SHADING_ODD   = { fill: 'D9E8F5', type: ShadingType.CLEAR };
const ROW_SHADING_EVEN  = { fill: 'FFFFFF', type: ShadingType.CLEAR };

// Larguras das colunas (total 9360 DXA ≈ A4 com margens de 2 cm)
// Nº | Data | Texto Bíblico | Tema | Pregador
const COL_WIDTHS = [600, 1200, 2000, 2760, 2800];

// ──────────────────────────────────────────────────────────────────────────────

function headerCell(text: string, widthDxa: number): TableCell {
  return new TableCell({
    borders: BORDERS,
    width: { size: widthDxa, type: WidthType.DXA },
    shading: HEADER_SHADING,
    margins: CELL_MARGINS,
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text, bold: true, color: 'FFFFFF', size: 20, font: 'Arial' })],
      }),
    ],
  });
}

function dataCell(text: string, widthDxa: number, shading: typeof ROW_SHADING_ODD): TableCell {
  return new TableCell({
    borders: BORDERS,
    width: { size: widthDxa, type: WidthType.DXA },
    shading,
    margins: CELL_MARGINS,
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        children: [new TextRun({ text: text || '', size: 20, font: 'Arial' })],
      }),
    ],
  });
}

function textToParagraphs(text: string): Paragraph[] {
  return text.split('\n').map(
    line => new Paragraph({
      spacing: { after: 160 },
      children: [new TextRun({ text: line, size: 22, font: 'Arial' })],
    }),
  );
}

// ──────────────────────────────────────────────────────────────────────────────

async function fetchLogoBuffer(): Promise<Buffer | null> {
  try {
    const { PROXY_HOST, PROXY_PORT, PROXY_USER, PROXY_PASS, LOGO_URL } = process.env;
    if (!LOGO_URL) return null;

    let httpsAgent: HttpsProxyAgent<string> | undefined;
    if (PROXY_HOST && PROXY_PORT) {
      const user = encodeURIComponent(PROXY_USER ?? '');
      const pass = encodeURIComponent(PROXY_PASS ?? '');
      httpsAgent = new HttpsProxyAgent(`http://${user}:${pass}@${PROXY_HOST}:${PROXY_PORT}`);
    }

    const res = await axios.get(LOGO_URL, {
      responseType: 'arraybuffer',
      httpsAgent,
      proxy: false,
    });
    return Buffer.from(res.data);
  } catch {
    return null;
  }
}

// ──────────────────────────────────────────────────────────────────────────────

export interface AlunoInfo {
  nome:     string;
  ra:       string;
  semestre: string;
  curso:    string;
}

export interface ChapelRow {
  indice:       number;
  data:         Date | string;
  textoBiblico: string;
  tema:         string;
  pregador:     string;
}

export interface Reflections {
  reflexao:  string;
  liturgica: string;
}

// ──────────────────────────────────────────────────────────────────────────────

export async function generateDocx(
  alunoInfo:   AlunoInfo,
  chapels:     ChapelRow[],
  reflections: Reflections,
): Promise<Buffer> {
  const logoBuffer = await fetchLogoBuffer();

  // ── Cabeçalho ────────────────────────────────────────────────────────────────
  const headerChildren: Paragraph[] = [];

  if (logoBuffer) {
    headerChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing:   { after: 200 },
        children:  [
          new ImageRun({
            data: logoBuffer,
            transformation: { width: 220, height: 60 },
            type: 'png',
          }),
        ],
      }),
    );
  }

  headerChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing:   { after: 60 },
      children:  [
        new TextRun({
          text: 'Relatório do Laboratório de Teologia e Liturgia',
          bold: true, size: 28, font: 'Arial',
        }),
      ],
    }),
  );

  // ── Dados do aluno ────────────────────────────────────────────────────────────
  const infoBlock = [
    `Nome: ${alunoInfo.nome}`,
    `RA: ${alunoInfo.ra}`,
    `Semestre: ${alunoInfo.semestre}`,
    `Curso: ${alunoInfo.curso}`,
  ].map(line =>
    new Paragraph({
      spacing: { after: 80 },
      children: [new TextRun({ text: line, size: 22, font: 'Arial' })],
    }),
  );

  // ── Tabela ───────────────────────────────────────────────────────────────────
  const tableHeaderRow = new TableRow({
    tableHeader: true,
    children: [
      headerCell('Nº',               COL_WIDTHS[0]),
      headerCell('Data da Capela',   COL_WIDTHS[1]),
      headerCell('Texto Bíblico',    COL_WIDTHS[2]),
      headerCell('Tema',             COL_WIDTHS[3]),
      headerCell('Nome do Pregador', COL_WIDTHS[4]),
    ],
  });

  const tableDataRows = chapels.map((c, i) => {
    const shading = i % 2 === 0 ? ROW_SHADING_ODD : ROW_SHADING_EVEN;
    const dataStr = c.data instanceof Date
      ? c.data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : String(c.data);
    return new TableRow({
      children: [
        dataCell(String(c.indice), COL_WIDTHS[0], shading),
        dataCell(dataStr,          COL_WIDTHS[1], shading),
        dataCell(c.textoBiblico,   COL_WIDTHS[2], shading),
        dataCell(c.tema,           COL_WIDTHS[3], shading),
        dataCell(c.pregador,       COL_WIDTHS[4], shading),
      ],
    });
  });

  const chapelTable = new Table({
    width:        { size: COL_WIDTHS.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: COL_WIDTHS,
    rows:         [tableHeaderRow, ...tableDataRows],
  });

  // ── Reflexão e Análise ────────────────────────────────────────────────────────
  const reflexaoSection = [
    new Paragraph({
      spacing: { before: 400, after: 160 },
      children: [new TextRun({ text: '1. Reflexão Teológica', bold: true, size: 26, font: 'Arial' })],
    }),
    ...textToParagraphs(reflections.reflexao),
  ];

  const liturgicaSection = [
    new Paragraph({
      spacing: { before: 400, after: 160 },
      children: [new TextRun({ text: '2. Análise Litúrgica', bold: true, size: 26, font: 'Arial' })],
    }),
    ...textToParagraphs(reflections.liturgica),
  ];

  // ── Montagem ──────────────────────────────────────────────────────────────────
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size:   { width: 11906, height: 16838 },          // A4
            margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 }, // ~2 cm
          },
        },
        children: [
          ...headerChildren,
          new Paragraph({ spacing: { after: 200 }, children: [] }),
          ...infoBlock,
          new Paragraph({ spacing: { after: 200 }, children: [] }),
          new Paragraph({
            spacing: { after: 160 },
            children: [new TextRun({ text: 'Capelas do Semestre', bold: true, size: 26, font: 'Arial' })],
          }),
          chapelTable,
          ...reflexaoSection,
          ...liturgicaSection,
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}
