import { Request, Response } from 'express';
import {
  criarManual,
  listarPorSemestre,
  buscarCapelaPorId,
  deletarCapela,
  editarCapela,
  iniciarColeta,
  buscarColeta,
  listarColetas,
} from '../services/capela.service';
import { CreateCapelaManualBody, ColetarCapelasBody, UpdateCapelaBody } from '../types';
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
    const semestreId = String(req.query.semestreId ?? '');
    if (!semestreId) {
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
    const id = req.params.id as string;
    if (!id) {
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

    // textoBiblico, tema e pregador são opcionais: dá para criar a capela agora
    // e preencher depois, com PATCH /capela/:id.
    if (!semestreId || !indice || !data) {
      res.status(400).json({ mensagem: 'Campos obrigatórios: semestreId, indice, data' });
      return;
    }

    const chapel = await criarManual({ semestreId, indice: Number(indice), data, textoBiblico, tema, pregador });
    res.status(201).json(chapel);
  } catch (err) {
    handleError(res, err);
  }
};

// ──────────────────────────────────────────────────────────────────────────────

/**
 * Dispara a coleta e responde 202 na hora — o trabalho roda em background.
 * O progresso é lido em GET /capela/coletar/:id.
 */
export const postColetarCapelas = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as ColetarCapelasBody;

    if (!body.semestreId) {
      res.status(400).json({ mensagem: 'Campo obrigatório: semestreId' });
      return;
    }

    if (body.weekday !== undefined) {
      const dia = Number(body.weekday);
      if (!Number.isInteger(dia) || dia < 0 || dia > 6) {
        res.status(400).json({ mensagem: 'weekday deve ser um inteiro de 0 (domingo) a 6 (sábado)' });
        return;
      }
      body.weekday = dia;
    }

    const coleta = await iniciarColeta(body);
    res.status(202).json(coleta);
  } catch (err) {
    handleError(res, err);
  }
};

// ──────────────────────────────────────────────────────────────────────────────

export const getColetas = async (req: Request, res: Response): Promise<void> => {
  try {
    const semestreId = String(req.query.semestreId ?? '');
    if (!semestreId) {
      res.status(400).json({ mensagem: 'Query obrigatória: semestreId' });
      return;
    }
    const coletas = await listarColetas(semestreId);
    res.json(coletas);
  } catch (err) {
    handleError(res, err);
  }
};

// ──────────────────────────────────────────────────────────────────────────────

export const getColeta = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    if (!id) {
      res.status(400).json({ mensagem: 'ID inválido' });
      return;
    }
    const coleta = await buscarColeta(id);
    res.json(coleta);
  } catch (err) {
    handleError(res, err);
  }
};

// ──────────────────────────────────────────────────────────────────────────────

/**
 * Edição manual — o admin assiste ao vídeo e preenche o que a IA não achou.
 */
export const patchCapela = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    if (!id) {
      res.status(400).json({ mensagem: 'ID inválido' });
      return;
    }

    const capela = await editarCapela(id, req.body as UpdateCapelaBody);
    res.json(capela);
  } catch (err) {
    handleError(res, err);
  }
};

// ──────────────────────────────────────────────────────────────────────────────

export const deleteCapelaById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    if (!id) {
      res.status(400).json({ mensagem: 'ID inválido' });
      return;
    }
    await deletarCapela(id);
    res.status(204).send();
  } catch (err) {
    handleError(res, err);
  }
};
