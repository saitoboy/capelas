-- Login do portal que funcionou na conexão (CPF/RA/e-mail), cifrado — os usuários
-- logavam no app com RA + senha padrão, mas o portal pode exigir outro
-- identificador. Salvo aqui, o auto-conectar do login do app já usa o login certo.
-- AlterTable
ALTER TABLE "ava_sessoes" ADD COLUMN     "login_portal_enc" VARCHAR(300);
