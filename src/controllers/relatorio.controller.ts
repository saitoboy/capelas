import { Response } from 'express';
import fs from 'fs';
import path from 'path';
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
    const semestreId = Number(req.body.semestreId);

    if (!semestreId || isNaN(semestreId)) {
      res.status(400).json({ mensagem: 'Campo obrigatório: semestreId (número)' });
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
    const id = Number(req.params.id);

    if (isNaN(id)) {
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
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ mensagem: 'ID inválido' });
      return;
    }

    const relatorio = await buscarPorId(id, req.user!.sub, req.user!.isAdmin);

    if (relatorio.status !== 'CONCLUIDO') {
      res.status(400).json({ mensagem: `Relatório ainda não concluído (status: ${relatorio.status})` });
      return;
    }
    if (!relatorio.docxPath || !fs.existsSync(relatorio.docxPath)) {
      res.status(404).json({ mensagem: 'Arquivo .docx não encontrado' });
      return;
    }

    const filename = path.basename(relatorio.docxPath);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    fs.createReadStream(relatorio.docxPath).pipe(res);
  } catch (err) {
    handleError(res, err);
  }
};
