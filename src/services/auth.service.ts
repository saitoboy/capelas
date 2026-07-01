import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import prisma from '../utils/prisma';
import { RegisterBody, LoginBody, UsuarioPublico, JwtPayload } from '../types';
import { logSuccess, logWarning } from '../utils/logger';

const getSecret = () => new TextEncoder().encode(process.env.JWT_SECRET!);

// ──────────────────────────────────────────────────────────────────────────────

export const registrar = async (body: RegisterBody): Promise<LoginResult> => {
  const { ra, nome, email, senha, curso } = body;

  const existe = await prisma.usuario.findUnique({ where: { ra } });
  if (existe) {
    const err = new Error('RA já cadastrado') as any;
    err.status = 409;
    throw err;
  }

  const emailExiste = await prisma.usuario.findUnique({ where: { email } });
  if (emailExiste) {
    const err = new Error('E-mail já cadastrado') as any;
    err.status = 409;
    throw err;
  }

  const senhaHash = await bcrypt.hash(senha, 10);

  const usuario = await prisma.usuario.create({
    data: { ra, nome, email, senhaHash, curso },
    select: { ra: true, nome: true, email: true, curso: true, isAdmin: true, createdAt: true },
  });

  const token = await new SignJWT({ sub: usuario.ra, isAdmin: usuario.isAdmin })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(process.env.JWT_EXPIRES_IN ?? '7d')
    .sign(getSecret());

  logSuccess(`Usuário registrado: ${ra}`, 'auth');
  return { token, usuario: { ra: usuario.ra, nome: usuario.nome, email: usuario.email, curso: usuario.curso, isAdmin: usuario.isAdmin } };
};

// ──────────────────────────────────────────────────────────────────────────────

export interface LoginResult {
  token: string;
  usuario: Pick<UsuarioPublico, 'ra' | 'nome' | 'email' | 'curso' | 'isAdmin'>;
}

export const autenticar = async (body: LoginBody): Promise<LoginResult> => {
  const { ra, senha } = body;

  const usuario = await prisma.usuario.findUnique({ where: { ra } });
  if (!usuario) {
    const err = new Error('RA ou senha inválidos') as any;
    err.status = 401;
    throw err;
  }

  const senhaValida = await bcrypt.compare(senha, usuario.senhaHash);
  if (!senhaValida) {
    logWarning(`Senha incorreta para RA: ${ra}`, 'auth');
    const err = new Error('RA ou senha inválidos') as any;
    err.status = 401;
    throw err;
  }

  const token = await new SignJWT({ sub: usuario.ra, isAdmin: usuario.isAdmin })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(process.env.JWT_EXPIRES_IN ?? '7d')
    .sign(getSecret());

  logSuccess(`Login realizado: ${ra}`, 'auth');
  return {
    token,
    usuario: { ra: usuario.ra, nome: usuario.nome, email: usuario.email, curso: usuario.curso, isAdmin: usuario.isAdmin },
  };
};

// ──────────────────────────────────────────────────────────────────────────────

export const verificarToken = async (token: string): Promise<JwtPayload> => {
  const { payload } = await jwtVerify(token, getSecret());

  return {
    sub: payload.sub as string,
    isAdmin: payload['isAdmin'] as boolean,
  };
};

// ──────────────────────────────────────────────────────────────────────────────

export const buscarPorRa = async (ra: string): Promise<UsuarioPublico> => {
  const usuario = await prisma.usuario.findUnique({
    where: { ra },
    select: { ra: true, nome: true, email: true, curso: true, isAdmin: true, createdAt: true },
  });

  if (!usuario) {
    const err = new Error('Usuário não encontrado') as any;
    err.status = 404;
    throw err;
  }

  return usuario;
};
