import { Response, NextFunction } from 'express';
import { jwtVerify } from 'jose';
import { AuthRequest } from '../types';
import { logWarning } from '../utils/logger';

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ mensagem: 'Token não fornecido' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
    const { payload } = await jwtVerify(token, secret);

    req.user = {
      sub: payload.sub as string,
      isAdmin: payload['isAdmin'] as boolean,
    };

    next();
  } catch {
    logWarning('Token inválido ou expirado', 'auth');
    res.status(401).json({ mensagem: 'Token inválido ou expirado' });
  }
};
