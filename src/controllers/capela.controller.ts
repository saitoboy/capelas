import { Request, Response } from 'express';
import { criarManual, listarPorSemestre, buscarCapelaPorId, deletarCapela, coletarDoYoutube } from '../services/capela.service';
import { CreateCapelaManualBody } from '../types';
import { logError } from '../utils/logger';

const handleError = (res: Response, err: unknown): void => {
  const e = err as any;
  const status: number = e?.status ?? 500;
  const mensagem: string = status < 500 ? e.message : 'Erro interno do servidor';
  if (status >= 500) logError(e.message, 'capela', e);
  res.status(status).json({ mensagem });
};

// ──────────────────────────────────────────────────────────────────────────────

export const getCapelas = async (req: Request, res: Response): Promise<void> => {
  try {
    const semestreId = Number(req.query.semestreId);
    if (!semestreId || isNaN(semestreId)) {
      res.status(400).json({ mensagem: 'Query obrigatória: semestreId' });
      return;
    }
    const capelas = await listarPorSemestre(semestreId);
    res.json(capelas);
  } catch (err) {
    handleError(res, err);
  }
};

// ──────────────────────────────────────────────────────────────────────────────

export const getCapelaById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ mensagem: 'ID inválido' });
      return;
    }
    const capela = await buscarCapelaPorId(id);
    res.json(capela);
  } catch (err) {
    handleError(res, err);
  }
};

// ──────────────────────────────────────────────────────────────────────────────

export const postCapelaManual = async (req: Request, res: Response): Promise<void> => {
  try {
    const { semestreId, indice, data, textoBiblico, tema, pregador } = req.body as CreateCapelaManualBody;

    if (!semestreId || !indice || !data || !textoBiblico || !tema || !pregador) {
      res.status(400).json({ mensagem: 'Campos obrigatórios: semestreId, indice, data, textoBiblico, tema, pregador' });
      return;
    }

    const chapel = await criarManual({ semestreId: Number(semestreId), indice: Number(indice), data, textoBiblico, tema, pregador });
    res.status(201).json(chapel);
  } catch (err) {
    handleError(res, err);
  }
};

// ──────────────────────────────────────────────────────────────────────────────

export const postColetarCapelas = async (req: Request, res: Response): Promise<void> => {
  try {
    const semestreId = Number(req.body.semestreId);
    if (!semestreId || isNaN(semestreId)) {
      res.status(400).json({ mensagem: 'Campo obrigatório: semestreId (número)' });
      return;
    }
    const resultado = await coletarDoYoutube(semestreId);
    res.json(resultado);
  } catch (err) {
    handleError(res, err);
  }
};

// ──────────────────────────────────────────────────────────────────────────────

export const deleteCapelaById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ mensagem: 'ID inválido' });
      return;
    }
    await deletarCapela(id);
    res.status(204).send();
  } catch (err) {
    handleError(res, err);
  }
};
