# Capela API

API REST para gestão de capelas universitárias — controla semestres, cultos (capelas), personas MBTI e geração automática de relatórios acadêmicos em DOCX com IA.

---

## Sumário

- [Visão Geral](#visão-geral)
- [Stack](#stack)
- [Arquitetura](#arquitetura)
- [Pré-requisitos](#pré-requisitos)
- [Instalação](#instalação)
- [Variáveis de Ambiente](#variáveis-de-ambiente)
- [Scripts](#scripts)
- [Endpoints](#endpoints)
  - [Auth](#auth)
  - [Semestre](#semestre)
  - [Capela](#capela)
  - [Sinopse](#sinopse)
  - [Persona](#persona)
  - [Relatório](#relatório)
- [Autenticação](#autenticação)
- [Roles & Permissões](#roles--permissões)
- [Modelo de Dados](#modelo-de-dados)
- [Proxy Corporativo](#proxy-corporativo)

---

## Visão Geral

A **Capela API** é o backend de um sistema acadêmico que:

1. **Coleta** cultos de devoção (capelas) diretamente do YouTube via API do Google, filtrando por canal, palavra-chave e dia da semana.
2. **Gera sinopses** de cada pregação automaticamente usando Groq AI com base nos metadados do vídeo.
3. **Personaliza** a experiência do aluno por meio de um perfil MBTI (teste interativo ou escolha direta).
4. **Produz relatórios** semestrais em `.docx`, escrevendo reflexões teológicas e análises litúrgicas adaptadas à persona do aluno, com tom e foco criativo configuráveis.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Runtime | Node.js + TypeScript |
| Framework | Express 5 |
| Banco de dados | PostgreSQL |
| ORM | Prisma 7 |
| Autenticação | JWT (jose) + bcryptjs |
| IA | Groq (llama3) |
| YouTube | YouTube Data API v3 + youtube-caption-extractor |
| Documentação | Swagger UI (`/docs`) |
| Geração DOCX | docx |
| Proxy | https-proxy-agent + undici dispatcher |

---

## Arquitetura

```
src/
├── index.ts                  # Entry point — Express + rotas + Swagger
├── swagger.ts                # Especificação OpenAPI 3.0
├── connection.ts             # Configuração de conexão
├── controllers/              # Recebe req/res, valida body, chama services
├── services/                 # Lógica de negócio
├── routes/                   # Definição de rotas por domínio
├── middleware/
│   ├── auth.middleware.ts    # Verifica JWT e injeta req.user
│   └── adminOnly.middleware  # Bloqueia não-admins
├── utils/
│   ├── prisma.ts             # Instância singleton do PrismaClient
│   ├── groq.ts               # Cliente Groq + proxy undici
│   └── logger.ts             # Logger com timestamp e cores
└── types/
    └── index.ts              # Interfaces e enums globais
```

---

## Pré-requisitos

- **Node.js** ≥ 20
- **PostgreSQL** ≥ 14
- Chave da **YouTube Data API v3**
- Chave da **Groq API**

---

## Instalação

```bash
# 1. Clone e instale dependências
git clone <repo-url>
cd capela
npm install

# 2. Configure o ambiente
cp .envexample .env
# edite .env com suas credenciais

# 3. Execute as migrations
npx prisma migrate dev

# 4. Inicie o servidor
npm run dev
```

A API estará disponível em `http://localhost:3003`.  
A documentação interativa em `http://localhost:3003/docs`.

---

## Variáveis de Ambiente

| Variável | Descrição | Exemplo |
|---|---|---|
| `DATABASE_URL` | Connection string PostgreSQL | `postgresql://user:pass@localhost:5432/db` |
| `PORT` | Porta do servidor | `3003` |
| `NODE_ENV` | Ambiente | `development` |
| `JWT_SECRET` | Segredo para assinar tokens | string aleatória longa |
| `JWT_EXPIRES_IN` | Validade do token | `7d` |
| `GROQ_API_KEY` | Chave da API Groq | `gsk_...` |
| `YOUTUBE_API_KEY` | Chave da YouTube Data API v3 | `AIza...` |
| `CHANNEL_HANDLE` | Handle do canal YouTube | `@souseminariodosul` |
| `CHAPEL_KEYWORD` | Palavra-chave para filtrar vídeos | `Devoção na Capela` |
| `CHAPEL_WEEKDAY` | Dia da semana dos cultos (0=Dom, 2=Ter) | `2` |
| `LOGO_URL` | URL da logo usada no DOCX | `https://...` |
| `PROXY_HOST` | Host do proxy corporativo (opcional) | `10.0.0.1` |
| `PROXY_PORT` | Porta do proxy (opcional) | `3128` |
| `PROXY_USER` | Usuário do proxy (opcional) | `usuario` |
| `PROXY_PASS` | Senha do proxy (opcional) | `senha` |

---

## Scripts

| Comando | Descrição |
|---|---|
| `npm run dev` | Inicia com ts-node-dev (hot-reload) |
| `npm run dev:full` | API + Prisma Studio em paralelo |
| `npm run studio` | Abre o Prisma Studio |
| `npm run prisma:generate` | Regenera o Prisma Client |
| `npm run prisma:migrate` | Executa migrations pendentes |

---

## Endpoints

> Todos os endpoints retornam JSON. Erros seguem o formato `{ "mensagem": "string" }`.

### Auth

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| `POST` | `/auth/register` | ❌ | Cadastrar novo usuário |
| `POST` | `/auth/login` | ❌ | Login — retorna token JWT |
| `GET` | `/auth/me` | ✅ | Dados do usuário autenticado |

**`POST /auth/register`**
```json
{
  "ra": "251000841",
  "nome": "Débora Silva",
  "email": "debora@email.com",
  "senha": "@Debora123",
  "confirmSenha": "@Debora123",
  "curso": "TEOLOGIA"
}
```

**`POST /auth/login`**
```json
{
  "ra": "251000841",
  "senha": "@Debora123"
}
```

Resposta (register e login):
```json
{
  "token": "eyJ...",
  "usuario": {
    "ra": "251000841",
    "nome": "Débora Silva",
    "email": "debora@email.com",
    "curso": "TEOLOGIA",
    "isAdmin": false
  }
}
```

---

### Semestre

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| `GET` | `/semestre` | ❌ | Listar todos os semestres |
| `GET` | `/semestre/ativo` | ❌ | Semestre atualmente ativo |
| `GET` | `/semestre/:id` | ❌ | Buscar semestre por ID |
| `POST` | `/semestre` | 🔒 Admin | Criar semestre |
| `PATCH` | `/semestre/:id/ativar` | 🔒 Admin | Ativar semestre |

**`POST /semestre`**
```json
{
  "label": "1º Semestre 2026",
  "publishedAfter": "2026-02-01T00:00:00Z",
  "publishedBefore": "2026-07-01T00:00:00Z"
}
```

---

### Capela

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| `GET` | `/capela?semestreId=` | ❌ | Listar capelas do semestre |
| `GET` | `/capela/:id` | ❌ | Buscar by ID |
| `POST` | `/capela/manual` | 🔒 Admin | Inserir manualmente |
| `POST` | `/capela/coletar` | 🔒 Admin | Coletar do YouTube |
| `DELETE` | `/capela/:id` | 🔒 Admin | Deletar |

**`POST /capela/coletar`** — busca vídeos no YouTube filtrando por `CHAPEL_KEYWORD`, `CHAPEL_WEEKDAY` e o intervalo de datas do semestre. Insere ou atualiza automaticamente.

```json
{ "semestreId": "uuid-do-semestre" }
```

Resposta:
```json
{ "inseridas": 12, "atualizadas": 2, "erros": [] }
```

---

### Sinopse

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| `GET` | `/sinopse/:capelaId` | ❌ | Buscar sinopse de uma capela |
| `POST` | `/sinopse/:capelaId` | 🔒 Admin | Gerar sinopse via Groq AI |

A sinopse é gerada a partir dos metadados da pregação (data, texto bíblico, tema, pregador) e escrita em português formal para uso em relatórios acadêmicos.

---

### Persona

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| `GET` | `/persona/me` | ✅ | Ver minha persona |
| `POST` | `/persona/preset` | ✅ | Definir persona por tipo MBTI |
| `POST` | `/persona/teste` | ✅ | Calcular tipo via teste de 8 questões |

**`POST /persona/preset`**
```json
{ "tipo": "ENFJ" }
```

**`POST /persona/teste`** — 8 respostas `A` ou `B`, cada par mapeia uma dimensão MBTI (E/I, N/S, F/T, J/P):
```json
{ "respostas": ["A","B","A","B","A","B","A","B"] }
```

Resposta (ambos):
```json
{
  "tipo": "ENFJ",
  "nome": "O Protagonista",
  "tom": "Empático, inspirador e orientado a pessoas"
}
```

Tipos suportados: todos os 16 tipos MBTI.

---

### Relatório

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| `POST` | `/relatorio/gerar` | ✅ | Iniciar geração em background |
| `GET` | `/relatorio/me` | ✅ | Listar meus relatórios |
| `GET` | `/relatorio/:id` | ✅ | Status de um relatório |
| `GET` | `/relatorio/:id/docx` | ✅ | Download do arquivo `.docx` |

**`POST /relatorio/gerar`**
```json
{ "semestreId": "uuid-do-semestre" }
```

O relatório é processado **em background**. A resposta imediata retorna `status: "PENDENTE"`. Faça polling em `GET /relatorio/:id` até `status: "CONCLUIDO"`.

**Fluxo:**
```
PENDENTE → (Groq gera reflexão + análise) → CONCLUIDO
                                          ↘ ERRO (erroMsg preenchido)
```

O DOCX gerado contém:
- Capa com logo institucional e dados do aluno
- Reflexão teológica adaptada ao **foco criativo** do aluno
- Análise litúrgica por chapel, usando sinopses pré-geradas
- Temperatura da IA ajustada por foco: `pastoral (0.9)`, `litúrgico (0.8)`, `histórico-bíblico (0.75)`, `teológico (0.7)`

---

## Autenticação

A API usa **JWT Bearer Token**. Após o login/registro, inclua o token no header:

```
Authorization: Bearer <token>
```

O token expira conforme `JWT_EXPIRES_IN` (padrão `7d`).

---

## Roles & Permissões

| Ação | Aluno (`isAdmin: false`) | Admin (`isAdmin: true`) |
|---|---|---|
| Registrar / Login | ✅ | ✅ |
| Ver capelas e sinopses | ✅ | ✅ |
| Gerenciar persona | ✅ | ✅ |
| Gerar e baixar relatório | ✅ | ✅ |
| Criar/ativar semestre | ❌ | ✅ |
| Coletar capelas do YouTube | ❌ | ✅ |
| Gerar sinopses (IA) | ❌ | ✅ |

> Admins são definidos diretamente no banco (`isAdmin = true`).

---

## Modelo de Dados

```
Usuario ──┬── Persona (1:1)
          └── Relatorio (1:N)

Semestre ─┬── Capela (1:N) ── Sinopse (1:1)
          └── Relatorio (1:N)
```

| Tabela | Chave primária | Destaques |
|---|---|---|
| `usuarios` | `ra` (VARCHAR 20) | email único, senhaHash bcrypt |
| `personas` | UUID | tipo MBTI (4 chars), tom descritivo |
| `semestres` | UUID | label único, range de datas, flag `ativo` |
| `capelas` | UUID | videoId único, índice por semestre |
| `sinopses` | UUID | texto gerado por IA, vinculado 1:1 à chapel |
| `relatorios` | UUID | docx em base64, status, foco criativo |

---

## Proxy Corporativo

Em redes corporativas com proxy HTTP, configure `PROXY_HOST`, `PROXY_PORT`, `PROXY_USER` e `PROXY_PASS`. A API registra automaticamente um dispatcher global no **undici**, garantindo que todas as requisições externas (Groq, YouTube) passem pelo proxy — incluindo o `fetch` nativo usado pelo `youtube-caption-extractor`.
