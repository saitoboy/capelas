import { Response } from 'express';
import prisma from '../utils/prisma';
import { gerarRelatorio, listarMeus, buscarPorId } from '../services/relatorio.service';
import { AuthRequest } from '../types';
import { logError } from '../utils/logger';

const handleError = (res: Response, err: unknown): void => {
  const e = err as any;
  const status: number = e?.status ?? 500;
  const mensagem: string = status < 500 ? e.message : 'Erro interno do servidor';
  if (status >= 500) logError(e.message, 'relatorio', e);
  res.status(status).json({ mensagem });
};

// ──────────────────────────────────────────────────────────────────────────────

export const postGerar = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const semestreId = req.body.semestreId as string;

    if (!semestreId) {
      res.status(400).json({ mensagem: 'Campo obrigatório: semestreId' });
      return;
    }

    const relatorio = await gerarRelatorio(req.user!.sub, semestreId);
    res.status(201).json(relatorio);
  } catch (err) {
    handleError(res, err);
  }
};

// ──────────────────────────────────────────────────────────────────────────────

export const getMeus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const relatorios = await listarMeus(req.user!.sub);
    res.json(relatorios);
  } catch (err) {
    handleError(res, err);
  }
};

// ──────────────────────────────────────────────────────────────────────────────

export const getById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    if (!id) {
      res.status(400).json({ mensagem: 'ID inválido' });
      return;
    }

    const relatorio = await buscarPorId(id, req.user!.sub, req.user!.isAdmin);
    res.json(relatorio);
  } catch (err) {
    handleError(res, err);
  }
};

// ──────────────────────────────────────────────────────────────────────────────

export const getDocx = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    if (!id) {
      res.status(400).json({ mensagem: 'ID inválido' });
      return;
    }

    // Busca o relatório validando acesso
    const relatorio = await buscarPorId(id, req.user!.sub, req.user!.isAdmin);

    if (relatorio.status !== 'CONCLUIDO') {
      res.status(400).json({ mensagem: `Relatório ainda não concluído (status: ${relatorio.status})` });
      return;
    }

    // Busca o base64 direto do banco (não exposto no tipo público)
    const raw = await prisma.relatorio.findUnique({
      where:  { id },
      select: { docxData: true, alunoRa: true, semestreId: true },
    });

    if (!raw?.docxData) {
      res.status(404).json({ mensagem: 'Arquivo .docx não encontrado no banco' });
      return;
    }

    const buffer   = Buffer.from(raw.docxData, 'base64');
    const filename = `relatorio_${raw.alunoRa}_sem${raw.semestreId}.docx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    handleError(res, err);
  }
};
