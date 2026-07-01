import { Request, Response } from 'express';
import { registrar, autenticar, buscarPorRa } from '../services/auth.service';
import { RegisterBody, LoginBody, AuthRequest } from '../types';
import { logError } from '../utils/logger';

const handleError = (res: Response, err: unknown): void => {
  const e = err as any;
  const status: number = e?.status ?? 500;
  const mensagem: string = status < 500 ? e.message : 'Erro interno do servidor';
  if (status >= 500) logError(e.message, 'auth', e);
  res.status(status).json({ mensagem });
};

// ──────────────────────────────────────────────────────────────────────────────

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { ra, nome, senha, curso } = req.body as RegisterBody;

    if (!ra || !nome || !senha || !curso) {
      res.status(400).json({ mensagem: 'Campos obrigatórios: ra, nome, senha, curso' });
      return;
    }

    const resultado = await registrar({ ra, nome, senha, curso });
    res.status(201).json(resultado);
  } catch (err) {
    handleError(res, err);
  }
};

// ──────────────────────────────────────────────────────────────────────────────

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { ra, senha } = req.body as LoginBody;

    if (!ra || !senha) {
      res.status(400).json({ mensagem: 'Campos obrigatórios: ra, senha' });
      return;
    }

    const resultado = await autenticar({ ra, senha });
    res.json(resultado);
  } catch (err) {
    handleError(res, err);
  }
};

// ──────────────────────────────────────────────────────────────────────────────

export const me = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const usuario = await buscarPorRa(req.user!.sub);
    res.json(usuario);
  } catch (err) {
    handleError(res, err);
  }
};
