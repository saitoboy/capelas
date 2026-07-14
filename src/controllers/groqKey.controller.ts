import { Response } from 'express';
import { listarChaves, criarChave, removerChave, reativarChave } from '../services/groqKey.service';
import { AuthRequest, CreateGroqKeyBody } from '../types';
import { logError } from '../utils/logger';

const handleError = (res: Response, err: unknown): void => {
  const e = err as any;
  const status: number = e?.status ?? 500;
  const mensagem: string = status < 500 ? e.message : 'Erro interno do servidor';
  if (status >= 500) logError(e.message, 'groq', e);
  res.status(status).json({ mensagem });
};

// ──────────────────────────────────────────────────────────────────────────────

export const getChaves = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const chaves = await listarChaves();
    res.json(chaves);
  } catch (err) {
    handleError(res, err);
  }
};

// ──────────────────────────────────────────────────────────────────────────────

export const postChave = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { label, key } = req.body as CreateGroqKeyBody;
    const chave = await criarChave(req.user!.sub, { label, key });
    res.status(201).json(chave);
  } catch (err) {
    handleError(res, err);
  }
};

// ──────────────────────────────────────────────────────────────────────────────

export const deleteChave = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    if (!id) {
      res.status(400).json({ mensagem: 'ID inválido' });
      return;
    }
    await removerChave(id);
    res.status(204).send();
  } catch (err) {
    handleError(res, err);
  }
};

// ──────────────────────────────────────────────────────────────────────────────

export const patchReativar = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    if (!id) {
      res.status(400).json({ mensagem: 'ID inválido' });
      return;
    }
    const chave = await reativarChave(id);
    res.json(chave);
  } catch (err) {
    handleError(res, err);
  }
};
