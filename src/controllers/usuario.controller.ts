import { Response } from 'express';
import {
  listarUsuarios,
  criarUsuario,
  atualizarUsuario,
  trocarSenha,
  removerUsuario,
} from '../services/usuario.service';
import {
  AuthRequest,
  AdminCreateUsuarioBody,
  AdminUpdateUsuarioBody,
  TrocarSenhaBody,
} from '../types';
import { logError } from '../utils/logger';

const handleError = (res: Response, err: unknown): void => {
  const e = err as any;
  const status: number = e?.status ?? 500;
  const mensagem: string = status < 500 ? e.message : 'Erro interno do servidor';
  if (status >= 500) logError(e.message, 'usuario', e);
  res.status(status).json({ mensagem });
};

// ──────────────────────────────────────────────────────────────────────────────

export const getUsuarios = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await listarUsuarios());
  } catch (err) {
    handleError(res, err);
  }
};

export const postUsuario = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const usuario = await criarUsuario(req.body as AdminCreateUsuarioBody);
    res.status(201).json(usuario);
  } catch (err) {
    handleError(res, err);
  }
};

export const patchUsuario = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const ra = req.params.ra as string;
    const usuario = await atualizarUsuario(
      ra,
      req.body as AdminUpdateUsuarioBody,
      req.user!.sub,
    );
    res.json(usuario);
  } catch (err) {
    handleError(res, err);
  }
};

export const patchSenha = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const ra = req.params.ra as string;
    const { senha } = req.body as TrocarSenhaBody;
    await trocarSenha(ra, senha);
    res.status(204).send();
  } catch (err) {
    handleError(res, err);
  }
};

export const deleteUsuario = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const ra = req.params.ra as string;
    await removerUsuario(ra, req.user!.sub);
    res.status(204).send();
  } catch (err) {
    handleError(res, err);
  }
};
