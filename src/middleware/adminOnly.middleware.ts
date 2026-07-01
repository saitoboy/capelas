import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';

export const adminOnly = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user?.isAdmin) {
    res.status(403).json({ mensagem: 'Acesso restrito a administradores' });
    return;
  }
  next();
};
