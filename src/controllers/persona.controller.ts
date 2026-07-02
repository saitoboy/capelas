import { Response } from 'express';
import { definirPorPreset, definirPorTeste, buscarPersona, listarPerguntas } from '../services/persona.service';
import { AuthRequest, PresetPersonaBody, TestePersonaBody } from '../types';
import { logError } from '../utils/logger';


const handleError = (res: Response, err: unknown): void => {
  const e = err as any;
  const status: number = e?.status ?? 500;
  const mensagem: string = status < 500 ? e.message : 'Erro interno do servidor';
  if (status >= 500) logError(e.message, 'persona', e);
  res.status(status).json({ mensagem });
};

// ──────────────────────────────────────────────────────────────────────────────

export const getMinhaPersona = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const persona = await buscarPersona(req.user!.sub);
    res.json(persona);
  } catch (err) {
    handleError(res, err);
  }
};

// ──────────────────────────────────────────────────────────────────────────────

export const postPreset = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tipo } = req.body as PresetPersonaBody;

    if (!tipo) {
      res.status(400).json({ mensagem: 'Campo obrigatório: tipo' });
      return;
    }

    const persona = await definirPorPreset(req.user!.sub, { tipo });
    res.status(201).json(persona);
  } catch (err) {
    handleError(res, err);
  }
};

// ──────────────────────────────────────────────────────────────────────────────

export const postTeste = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { respostas } = req.body as TestePersonaBody;

    if (!Array.isArray(respostas)) {
      res.status(400).json({ mensagem: 'Campo obrigatório: respostas (array)' });
      return;
    }

    const persona = await definirPorTeste(req.user!.sub, { respostas });
    res.status(201).json(persona);
  } catch (err) {
    handleError(res, err);
  }
};

// ──────────────────────────────────────────────────────────────────────────────

export const getPerguntas = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const perguntas = listarPerguntas();
    res.json(perguntas);
  } catch (err) {
    handleError(res, err);
  }
};