import { Response } from 'express';
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
