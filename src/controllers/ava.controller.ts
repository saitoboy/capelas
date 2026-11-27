import { Request, Response } from 'express';
import {
  conectarPortal,
  desconectarPortal,
  statusPortal,
} from '../services/ava.service';
import { ConectarAvaBody } from '../types';
import { logError } from '../utils/logger';
import { AuthRequest } from '../types';

const handleError = (res: Response, err: unknown): void => {
  const e = err as any;
  const status: number = e?.status ?? 500;
  const mensagem: string = status < 500 ? e.message : 'Erro interno do servidor';
  if (status >= 500) logError(e.message, 'ava', e);
  res.status(status).json({ mensagem });
};

// ──────────────────────────────────────────────────────────────────────────────

/**
 * Conecta o portal do AVA com a senha do usuário logado.
 * A senha NÃO é guardada — só os cookies de sessão, cifrados.
 * É também o caminho de reconexão quando a sessão expira.
 */
export const postConectarAva = async (req: Request, res: Response): Promise<void> => {
  try {
    const auth = req as AuthRequest;
    const ra = auth.user!.sub;
    const { senha, login } = req.body as ConectarAvaBody;

    if (!senha) {
      res.status(400).json({ mensagem: 'Campo obrigatório: senha (a sua senha do portal JACAD)' });
      return;
    }

    // `login` é opcional: o CPF (ou RA/e-mail) do portal, para quem não loga no
    // portal pelo RA do app. Salvo cifrado — a próxima reconexão já usa o certo.
    await conectarPortal(ra, senha, undefined, login);
    const status = await statusPortal(ra);
    res.json(status);
  } catch (err) {
    handleError(res, err);
  }
};

// ──────────────────────────────────────────────────────────────────────────────

export const getStatusAva = async (req: Request, res: Response): Promise<void> => {
  try {
    const auth = req as AuthRequest;
    res.json(await statusPortal(auth.user!.sub));
  } catch (err) {
    handleError(res, err);
  }
};

// ──────────────────────────────────────────────────────────────────────────────

export const deleteConectarAva = async (req: Request, res: Response): Promise<void> => {
  try {
    const auth = req as AuthRequest;
    await desconectarPortal(auth.user!.sub);
    res.status(204).send();
  } catch (err) {
    handleError(res, err);
  }
};
