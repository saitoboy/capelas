import { Request, Response } from 'express';
import {
  criarSemestre,
  listarSemestres,
  buscarSemestrePorId,
  ativarSemestre,
  buscarSemestreAtivo,
} from '../services/semestre.service';
import { AuthRequest, CreateSemestreBody } from '../types';
import { logError } from '../utils/logger';

const handleError = (res: Response, err: unknown): void => {
  const e = err as any;
  const status: number = e?.status ?? 500;
  const mensagem: string = status < 500 ? e.message : 'Erro interno do servidor';
  if (status >= 500) logError(e.message, 'semestre', e);
  res.status(status).json({ mensagem });
};

// ──────────────────────────────────────────────────────────────────────────────

export const postSemestre = async (req: Request, res: Response): Promise<void> => {
  try {
    const { label, publishedAfter, publishedBefore } = req.body as CreateSemestreBody;

    if (!label || !publishedAfter || !publishedBefore) {
      res.status(400).json({ mensagem: 'Campos obrigatórios: label, publishedAfter, publishedBefore' });
      return;
    }

    const semestre = await criarSemestre({ label, publishedAfter, publishedBefore });
    res.status(201).json(semestre);
  } catch (err) {
    handleError(res, err);
  }
};

// ──────────────────────────────────────────────────────────────────────────────

export const getSemestres = async (_req: Request, res: Response): Promise<void> => {
  try {
    const semestres = await listarSemestres();
    res.json(semestres);
  } catch (err) {
    handleError(res, err);
  }
};

// ──────────────────────────────────────────────────────────────────────────────

export const getSemestreAtivo = async (_req: Request, res: Response): Promise<void> => {
  try {
    const semestre = await buscarSemestreAtivo();
    res.json(semestre);
  } catch (err) {
    handleError(res, err);
  }
};

// ──────────────────────────────────────────────────────────────────────────────

export const getSemestreById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    if (!id) {
      res.status(400).json({ mensagem: 'ID inválido' });
      return;
    }
    const semestre = await buscarSemestrePorId(id);
    res.json(semestre);
  } catch (err) {
    handleError(res, err);
  }
};

// ──────────────────────────────────────────────────────────────────────────────

export const patchAtivar = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    if (!id) {
      res.status(400).json({ mensagem: 'ID inválido' });
      return;
    }
    const semestre = await ativarSemestre(id);
    res.json(semestre);
  } catch (err) {
    handleError(res, err);
  }
};
