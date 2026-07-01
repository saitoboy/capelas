import { Request, Response } from 'express';
import { gerarSinopse, buscarSinopse } from '../services/sinopse.service';
import { logError } from '../utils/logger';

const handleError = (res: Response, err: unknown): void => {
  const e = err as any;
  const status: number = e?.status ?? 500;
  const mensagem: string = status < 500 ? e.message : 'Erro interno do servidor';
  if (status >= 500) logError(e.message, 'sinopse', e);
  res.status(status).json({ mensagem });
};

// ──────────────────────────────────────────────────────────────────────────────

export const postGerar = async (req: Request, res: Response): Promise<void> => {
  try {
    const capelaId = Number(req.params.capelaId);
    if (isNaN(capelaId)) {
      res.status(400).json({ mensagem: 'ID inválido' });
      return;
    }
    const sinopse = await gerarSinopse(capelaId);
    res.status(201).json(sinopse);
  } catch (err) {
    handleError(res, err);
  }
};

// ──────────────────────────────────────────────────────────────────────────────

export const getById = async (req: Request, res: Response): Promise<void> => {
  try {
    const capelaId = Number(req.params.capelaId);
    if (isNaN(capelaId)) {
      res.status(400).json({ mensagem: 'ID inválido' });
      return;
    }
    const sinopse = await buscarSinopse(capelaId);
    res.json(sinopse);
  } catch (err) {
    handleError(res, err);
  }
};
