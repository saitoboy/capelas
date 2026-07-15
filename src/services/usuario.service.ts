import bcrypt from 'bcryptjs';
import prisma from '../utils/prisma';
import {
  AdminCreateUsuarioBody,
  AdminUpdateUsuarioBody,
  UsuarioPublico,
} from '../types';
import { logSuccess } from '../utils/logger';

// ──────────────────────────────────────────────────────────────────────────────
// Gestão de usuários pelo admin. A senha nunca sai daqui — `PUBLICO` é o recorte
// seguro de campos, o mesmo que o auth.service usa.
// ──────────────────────────────────────────────────────────────────────────────

const PUBLICO = {
  ra: true,
  nome: true,
  email: true,
  curso: true,
  isAdmin: true,
  createdAt: true,
} as const;

const SENHA_MIN = 6;

function erro(status: number, mensagem: string): Error {
  const e = new Error(mensagem) as any;
  e.status = status;
  return e;
}

// ──────────────────────────────────────────────────────────────────────────────

export const listarUsuarios = async (): Promise<UsuarioPublico[]> =>
  prisma.usuario.findMany({ select: PUBLICO, orderBy: { createdAt: 'desc' } });

// ──────────────────────────────────────────────────────────────────────────────

export const criarUsuario = async (
  body: AdminCreateUsuarioBody,
): Promise<UsuarioPublico> => {
  const ra = body.ra?.trim();
  const nome = body.nome?.trim();
  const email = body.email?.trim().toLowerCase();
  const { senha, curso } = body;

  if (!ra || !nome || !email || !senha || !curso) {
    throw erro(400, 'Campos obrigatórios: ra, nome, email, senha, curso');
  }
  if (senha.length < SENHA_MIN) {
    throw erro(400, `A senha precisa ter ao menos ${SENHA_MIN} caracteres.`);
  }

  if (await prisma.usuario.findUnique({ where: { ra } })) {
    throw erro(409, 'RA já cadastrado');
  }
  if (await prisma.usuario.findUnique({ where: { email } })) {
    throw erro(409, 'E-mail já cadastrado');
  }

  const senhaHash = await bcrypt.hash(senha, 10);

  const usuario = await prisma.usuario.create({
    data: { ra, nome, email, senhaHash, curso, isAdmin: body.isAdmin ?? false },
    select: PUBLICO,
  });

  logSuccess(`Usuário criado pelo admin: ${ra}`, 'usuario');
  return usuario;
};

// ──────────────────────────────────────────────────────────────────────────────

export const atualizarUsuario = async (
  ra: string,
  body: AdminUpdateUsuarioBody,
  atorRa: string,
): Promise<UsuarioPublico> => {
  const alvo = await prisma.usuario.findUnique({ where: { ra } });
  if (!alvo) throw erro(404, 'Usuário não encontrado');

  // Trava anti-lockout: o admin não pode tirar o próprio acesso e ficar de fora.
  if (ra === atorRa && body.isAdmin === false) {
    throw erro(400, 'Você não pode remover o próprio acesso de administrador.');
  }

  const email = body.email?.trim().toLowerCase();
  if (email && email !== alvo.email) {
    const jaUsado = await prisma.usuario.findUnique({ where: { email } });
    if (jaUsado) throw erro(409, 'E-mail já cadastrado');
  }

  const usuario = await prisma.usuario.update({
    where: { ra },
    data: {
      nome:    body.nome?.trim() ?? undefined,
      email:   email ?? undefined,
      curso:   body.curso ?? undefined,
      isAdmin: body.isAdmin ?? undefined,
    },
    select: PUBLICO,
  });

  logSuccess(`Usuário atualizado pelo admin: ${ra}`, 'usuario');
  return usuario;
};

// ──────────────────────────────────────────────────────────────────────────────

export const trocarSenha = async (ra: string, senha: string): Promise<void> => {
  if (!senha || senha.length < SENHA_MIN) {
    throw erro(400, `A senha precisa ter ao menos ${SENHA_MIN} caracteres.`);
  }

  const alvo = await prisma.usuario.findUnique({ where: { ra } });
  if (!alvo) throw erro(404, 'Usuário não encontrado');

  const senhaHash = await bcrypt.hash(senha, 10);
  await prisma.usuario.update({ where: { ra }, data: { senhaHash } });

  logSuccess(`Senha trocada pelo admin: ${ra}`, 'usuario');
};

// ──────────────────────────────────────────────────────────────────────────────

export const removerUsuario = async (ra: string, atorRa: string): Promise<void> => {
  if (ra === atorRa) {
    throw erro(400, 'Você não pode remover a própria conta.');
  }

  const alvo = await prisma.usuario.findUnique({ where: { ra } });
  if (!alvo) throw erro(404, 'Usuário não encontrado');

  // Persona, relatórios e chaves da Groq caem junto (onDelete: Cascade no schema).
  await prisma.usuario.delete({ where: { ra } });

  logSuccess(`Usuário removido pelo admin: ${ra}`, 'usuario');
};
