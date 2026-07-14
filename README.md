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
  - [Chaves da Groq](#chaves-da-groq)
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
| `PATCH` | `/capela/:id` | 🔒 Admin | **Editar à mão o que a IA não extraiu** |
| `POST` | `/capela/coletar` | 🔒 Admin | Coletar do YouTube — **background** |
| `GET` | `/capela/coletar/:id` | 🔒 Admin | Progresso da coleta |
| `DELETE` | `/capela/:id` | 🔒 Admin | Deletar |

#### Campos ausentes são `NULL`

`textoBiblico`, `tema` e `pregador` são **anuláveis**. Quando a IA não consegue extrair um deles da pregação, o campo fica `NULL` — e não com um texto `"(não encontrado)"`, que se confundia com dado real e ia parar no relatório do aluno como se fosse verdade.

`NULL` é o sinal de **"falta preencher à mão"**. O fluxo é: coletar → ver o que ficou vazio → assistir ao vídeo → preencher com `PATCH /capela/:id`.

**`PATCH /capela/:id`** — só mexe nos campos enviados; omitir um campo o deixa como está, e mandar `null` explicitamente o limpa.

```json
{ "tema": "A soberania de Deus", "pregador": "Pr. Marcos Lima" }
```

Campos aceitos: `textoBiblico`, `tema`, `pregador`, `data`.

> **Recoletar não apaga o que foi preenchido à mão.** No upsert, um `null` vindo da IA nunca sobrescreve um valor existente — só campos que a IA realmente extraiu são atualizados.

Consequências em cascata, todas tratadas:

- **DOCX** — campo `NULL` vira `—` na tabela, nunca a palavra "null".
- **Relatório** — no prompt da IA, campo vazio entra como "não informado", para ela não escrever reflexão em cima de dado inexistente.
- **Sinopse** — capela sem tema **e** sem texto bíblico devolve `422`: não há do que escrever, e a IA inventaria a pregação inteira. Preencha os dados e gere depois.
- **`POST /capela/manual`** — agora só exige `semestreId`, `indice` e `data`. Dá para criar a capela e preencher o resto depois.

**`POST /capela/coletar`** — busca vídeos no canal, filtra por palavra-chave e dia da semana, extrai texto bíblico / tema / pregador via IA e (opcionalmente) já gera as sinopses.

A coleta faz **~3 chamadas de IA por capela** e passa de 40 num semestre inteiro — não cabe num request HTTP. Por isso roda **em background**: a resposta é imediata (`202`) e o progresso é acompanhado por polling em `GET /capela/coletar/:id`.

Só `semestreId` é obrigatório. Os demais campos sobrescrevem os defaults do semestre e do `.env`:

```jsonc
{
  "semestreId": "uuid-do-semestre",   // obrigatório
  "publishedAfter":  "2026-02-01T00:00:00Z",  // default: data inicial do semestre
  "publishedBefore": "2026-07-01T00:00:00Z",  // default: data final do semestre
  "canal":   "@souseminariodosul",    // default: CHANNEL_HANDLE
  "keyword": "Devoção na Capela",     // default: CHAPEL_KEYWORD
  "weekday": 2,                       // default: CHAPEL_WEEKDAY (0=dom … 6=sáb)
  "gerarSinopses": true               // default: true
}
```

Resposta imediata (`202`):
```json
{ "id": "uuid-da-coleta", "status": "GERANDO", "etapa": "Na fila…", "total": 0, "processadas": 0 }
```

**`GET /capela/coletar/:id`** — faça polling até `status` sair de `GERANDO`:
```json
{
  "id": "uuid",
  "status": "CONCLUIDO",
  "etapa": null,
  "total": 12,
  "processadas": 12,
  "inseridas": 9,
  "atualizadas": 3,
  "ignorados": 3,
  "itens": [
    { "indice": 1, "tema": "A fé que sustenta",  "source": "comentarios", "faltando": [] },
    { "indice": 2, "tema": "Servir com alegria", "source": "comentarios+transcricao", "faltando": [] },
    { "indice": 3, "tema": null, "source": "parcial", "faltando": ["tema", "pregador"] }
  ],
  "erroMsg": null
}
```

- **`ignorados`** — vídeos do canal descartados pelos filtros (sem data `DD/MM/AAAA` no título, ou fora do dia da semana). Antes eram descartados em silêncio; agora aparecem, para o admin entender por que faltou capela.
- **`itens[].source`** — de onde o dado veio: `comentarios`, `comentarios+transcricao`, `parcial` ou `incompleto`. É como se sabe em quais capelas confiar.
- **`itens[].faltando`** — os campos que ficaram `NULL` e precisam ser preenchidos à mão via `PATCH /capela/:id`.

> Uma coleta por semestre de cada vez — disparar outra com uma em andamento devolve `409`.

Erro no meio não perde o que já foi salvo: o upsert é por `videoId`, então basta coletar de novo para retomar.

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

### Chaves da Groq

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| `GET` | `/groq-key` | ✅ | Listar a fila de chaves (só o preview mascarado) |
| `POST` | `/groq-key` | ✅ | Cadastrar uma chave — valida na Groq antes de salvar |
| `DELETE` | `/groq-key/:id` | 🔒 Admin | Remover |
| `PATCH` | `/groq-key/:id/reativar` | 🔒 Admin | Forçar uma chave de volta para `ATIVA` |

Uma chave só da Groq é um ponto único de falha: ao bater o limite de tokens, **tudo** para — coleta, sinopse e relatório. A API mantém uma **fila de chaves** e troca sozinha.

A cada chamada, usa a chave `ATIVA` menos usada recentemente. Se a Groq responder:

- **429** (limite de tokens) → a chave vira `ESGOTADA`, com `resetAt` lido do header `retry-after`, e a chamada é **repetida na próxima chave**.
- **401/403** (chave inválida) → a chave vira `INVALIDA` e a chamada é **repetida na próxima chave**.
- qualquer outro erro → propaga (trocar de chave não resolveria).

Quem chamou nunca vê o erro. Acabando a fila, aí sim: `503` com "cadastre uma nova".
Chaves `ESGOTADA` cujo `resetAt` já passou voltam a `ATIVA` sozinhas, sem cron.

**`POST /groq-key`**
```json
{ "label": "chave do Guilherme", "key": "gsk_..." }
```

Resposta — **a chave nunca é devolvida**, só o preview:
```json
{
  "id": "uuid",
  "label": "chave do Guilherme",
  "preview": "gsk_…4f2a",
  "status": "ATIVA",
  "resetAt": null,
  "lastUsedAt": null,
  "criadoPor": "251000841"
}
```

Pontos de segurança:

1. A chave é **criptografada em repouso** (AES-256-GCM, via `APP_ENCRYPTION_KEY`) e **nunca sai da API** — nem para o admin. Chave que sai numa resposta acaba em log, cache e histórico do navegador.
2. O `POST` **valida a chave contra a Groq antes de gravar**. Chave errada falha no cadastro, não no meio da coleta de outra pessoa.
3. **Qualquer aluno logado pode cadastrar**, mas só o admin remove/reativa. A chave doada entra num pool compartilhado e **gasta tokens servindo os outros alunos** — isso precisa estar claro na interface de quem doa.

> **Retrocompatível:** sem nenhuma chave no banco, tudo continua usando o `GROQ_API_KEY` do `.env`. Nada quebra enquanto a primeira não for cadastrada.

> Trocar a `APP_ENCRYPTION_KEY` torna ilegíveis as chaves já gravadas — elas são marcadas como `INVALIDA` e precisam ser cadastradas de novo.

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
          ├── Relatorio (1:N)
          └── GroqKey (1:N)

Semestre ─┬── Capela (1:N) ── Sinopse (1:1)
          ├── Relatorio (1:N)
          └── Coleta (1:N)
```

| Tabela | Chave primária | Destaques |
|---|---|---|
| `usuarios` | `ra` (VARCHAR 20) | email único, senhaHash bcrypt |
| `personas` | UUID | tipo MBTI (4 chars), tom descritivo |
| `semestres` | UUID | label único, range de datas, flag `ativo` |
| `capelas` | UUID | videoId único, índice por semestre; **textoBiblico/tema/pregador anuláveis** |
| `sinopses` | UUID | texto gerado por IA, vinculado 1:1 à chapel |
| `relatorios` | UUID | docx em base64, status, foco criativo |
| `coletas` | UUID | job de coleta: status, progresso, log por capela |
| `groq_keys` | UUID | fila de chaves; chave cifrada (AES-256-GCM), status, `resetAt` |

---

## Proxy Corporativo

Em redes corporativas com proxy HTTP, configure `PROXY_HOST`, `PROXY_PORT`, `PROXY_USER` e `PROXY_PASS`. A API registra automaticamente um dispatcher global no **undici**, garantindo que todas as requisições externas (Groq, YouTube) passem pelo proxy — incluindo o `fetch` nativo usado pelo `youtube-caption-extractor`.
