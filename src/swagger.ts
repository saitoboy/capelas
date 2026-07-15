export const swaggerSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Capela API',
    version: '1.0.0',
    description:
      'API de gestão de capelas, relatórios, personas, usuários e chaves da Groq.',
  },
  // Origem relativa: o "Try it out" bate no mesmo host onde o /docs está aberto,
  // então funciona igual em localhost e em produção.
  servers: [{ url: '/', description: 'Mesma origem' }],
  tags: [
    { name: 'Auth' },
    { name: 'Usuário' },
    { name: 'Semestre' },
    { name: 'Capela' },
    { name: 'Sinopse' },
    { name: 'Persona' },
    { name: 'Relatório' },
    { name: 'Chaves Groq' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: { mensagem: { type: 'string' } },
      },

      Usuario: {
        type: 'object',
        properties: {
          ra:        { type: 'string', example: '251000841' },
          nome:      { type: 'string', example: 'Débora Silva' },
          email:     { type: 'string', format: 'email', example: 'debora@email.com' },
          curso:     { type: 'string', enum: ['TEOLOGIA'], example: 'TEOLOGIA' },
          isAdmin:   { type: 'boolean', example: false },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },

      Capela: {
        type: 'object',
        properties: {
          id:           { type: 'string', format: 'uuid' },
          semestreId:   { type: 'string', format: 'uuid' },
          indice:       { type: 'integer', example: 7 },
          data:         { type: 'string', format: 'date', example: '2026-04-28' },
          videoId:      { type: 'string', nullable: true, example: 'dQw4w9WgXcQ' },
          url:          { type: 'string', nullable: true },
          // null = a IA não extraiu; falta o admin preencher à mão.
          textoBiblico: { type: 'string', nullable: true, example: 'Salmos 27:4-8' },
          tema:         { type: 'string', nullable: true, example: 'O chamado ministerial' },
          pregador:     { type: 'string', nullable: true, example: 'Pastor Artur' },
          source:       { type: 'string', example: 'descricao' },
          createdAt:    { type: 'string', format: 'date-time' },
          sinopse:      { $ref: '#/components/schemas/Sinopse' },
        },
      },

      Sinopse: {
        type: 'object',
        properties: {
          id:       { type: 'string', format: 'uuid' },
          capelaId: { type: 'string', format: 'uuid' },
          texto:    { type: 'string' },
          geradoEm: { type: 'string', format: 'date-time' },
        },
      },

      ColetaItem: {
        type: 'object',
        properties: {
          indice:   { type: 'integer', example: 7 },
          tema:     { type: 'string', nullable: true },
          source:   { type: 'string', example: 'comentarios' },
          faltando: {
            type: 'array',
            items: { type: 'string' },
            example: ['tema'],
          },
          erro: { type: 'string' },
        },
      },

      Coleta: {
        type: 'object',
        description: 'Job de coleta em background. O progresso é lido por GET /capela/coletar/{id}.',
        properties: {
          id:          { type: 'string', format: 'uuid' },
          semestreId:  { type: 'string', format: 'uuid' },
          status:      { type: 'string', enum: ['GERANDO', 'CONCLUIDO', 'ERRO'] },
          etapa:       { type: 'string', nullable: true },
          total:       { type: 'integer' },
          processadas: { type: 'integer' },
          inseridas:   { type: 'integer' },
          atualizadas: { type: 'integer' },
          ignorados:   { type: 'integer' },
          itens:       { type: 'array', items: { $ref: '#/components/schemas/ColetaItem' } },
          erroMsg:     { type: 'string', nullable: true },
          createdAt:   { type: 'string', format: 'date-time' },
          updatedAt:   { type: 'string', format: 'date-time' },
        },
      },

      GroqKey: {
        type: 'object',
        description: 'A chave em si nunca volta — só o preview mascarado.',
        properties: {
          id:         { type: 'string', format: 'uuid' },
          label:      { type: 'string', example: 'chave do Guilherme' },
          preview:    { type: 'string', example: 'gsk_…IpVr' },
          status:     { type: 'string', enum: ['ATIVA', 'ESGOTADA', 'INVALIDA'] },
          resetAt:    { type: 'string', format: 'date-time', nullable: true },
          lastUsedAt: { type: 'string', format: 'date-time', nullable: true },
          erroMsg:    { type: 'string', nullable: true },
          criadoPor:  { type: 'string', example: '251000841' },
          createdAt:  { type: 'string', format: 'date-time' },
          tokensHoje: { type: 'integer', description: 'Tokens gastos hoje (cota diária TPD).', example: 12340 },
          tpd:        { type: 'integer', nullable: true, description: 'Limite diário; null se GROQ_TPD não configurado.', example: 100000 },
        },
      },
    },
  },
  paths: {
    /* ─── AUTH ─────────────────────────────────────────────── */
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Registrar usuário',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['ra', 'nome', 'email', 'senha', 'confirmSenha', 'curso'],
                properties: {
                  ra:           { type: 'string', example: '251000841' },
                  nome:         { type: 'string', example: 'Débora Silva' },
                  email:        { type: 'string', format: 'email', example: 'debora@email.com' },
                  senha:        { type: 'string', example: '@Debora123' },
                  confirmSenha: { type: 'string', example: '@Debora123' },
                  curso:        { type: 'string', enum: ['TEOLOGIA'], example: 'TEOLOGIA' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Usuário criado + token JWT' },
          400: { description: 'Campos faltando ou senhas divergentes' },
          409: { description: 'RA ou e-mail já cadastrado' },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['ra', 'senha'],
                properties: {
                  ra:    { type: 'string', example: '251000841' },
                  senha: { type: 'string', example: '@Debora123' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Token JWT + usuário' },
          401: { description: 'Credenciais inválidas' },
        },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Ver meus dados',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Usuário logado',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Usuario' } } },
          },
          401: { description: 'Token inválido' },
        },
      },
    },

    /* ─── USUÁRIO (admin) ───────────────────────────────────── */
    '/usuario': {
      get: {
        tags: ['Usuário'],
        summary: 'Listar usuários (admin)',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Array de usuários (mais recentes primeiro)',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Usuario' } },
              },
            },
          },
          403: { description: 'Acesso restrito a administradores' },
        },
      },
      post: {
        tags: ['Usuário'],
        summary: 'Criar usuário (admin)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['ra', 'nome', 'email', 'senha', 'curso'],
                properties: {
                  ra:      { type: 'string', example: '251000841' },
                  nome:    { type: 'string', example: 'Débora Silva' },
                  email:   { type: 'string', format: 'email', example: 'debora@email.com' },
                  senha:   { type: 'string', minLength: 6, example: 'trocar123' },
                  curso:   { type: 'string', enum: ['TEOLOGIA'], example: 'TEOLOGIA' },
                  isAdmin: { type: 'boolean', default: false },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Usuário criado',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Usuario' } } },
          },
          400: { description: 'Campos faltando ou senha curta' },
          403: { description: 'Acesso restrito a administradores' },
          409: { description: 'RA ou e-mail já cadastrado' },
        },
      },
    },
    '/usuario/{ra}': {
      patch: {
        tags: ['Usuário'],
        summary: 'Editar usuário (admin)',
        description: 'Campo omitido não muda. O admin não pode remover o próprio acesso de admin.',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'ra', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  nome:    { type: 'string' },
                  email:   { type: 'string', format: 'email' },
                  curso:   { type: 'string', enum: ['TEOLOGIA'] },
                  isAdmin: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Usuário atualizado',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Usuario' } } },
          },
          400: { description: 'Tentativa de remover o próprio admin' },
          403: { description: 'Acesso restrito a administradores' },
          404: { description: 'Usuário não encontrado' },
          409: { description: 'E-mail já cadastrado' },
        },
      },
      delete: {
        tags: ['Usuário'],
        summary: 'Remover usuário (admin)',
        description: 'Apaga em cascata a persona, os relatórios e as chaves da conta. O admin não pode remover a própria conta.',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'ra', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          204: { description: 'Removido' },
          400: { description: 'Tentativa de remover a própria conta' },
          403: { description: 'Acesso restrito a administradores' },
          404: { description: 'Usuário não encontrado' },
        },
      },
    },
    '/usuario/{ra}/senha': {
      patch: {
        tags: ['Usuário'],
        summary: 'Trocar senha de um usuário (admin)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'ra', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['senha'],
                properties: { senha: { type: 'string', minLength: 6, example: 'novaSenha123' } },
              },
            },
          },
        },
        responses: {
          204: { description: 'Senha trocada' },
          400: { description: 'Senha muito curta' },
          403: { description: 'Acesso restrito a administradores' },
          404: { description: 'Usuário não encontrado' },
        },
      },
    },

    /* ─── SEMESTRE ──────────────────────────────────────────── */
    '/semestre': {
      get: {
        tags: ['Semestre'],
        summary: 'Listar semestres',
        responses: { 200: { description: 'Array de semestres' } },
      },
      post: {
        tags: ['Semestre'],
        summary: 'Criar semestre (admin)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['label', 'publishedAfter', 'publishedBefore'],
                properties: {
                  label:           { type: 'string', example: '1º Semestre 2026' },
                  publishedAfter:  { type: 'string', format: 'date-time', example: '2026-02-01T00:00:00Z' },
                  publishedBefore: { type: 'string', format: 'date-time', example: '2026-07-01T00:00:00Z' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Semestre criado' },
          403: { description: 'Acesso negado' },
        },
      },
    },
    '/semestre/ativo': {
      get: {
        tags: ['Semestre'],
        summary: 'Semestre ativo',
        responses: {
          200: { description: 'Semestre ativo' },
          404: { description: 'Nenhum semestre ativo' },
        },
      },
    },
    '/semestre/{id}': {
      get: {
        tags: ['Semestre'],
        summary: 'Buscar semestre por ID',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Semestre encontrado' }, 404: { description: 'Não encontrado' } },
      },
    },
    '/semestre/{id}/ativar': {
      patch: {
        tags: ['Semestre'],
        summary: 'Ativar semestre (admin)',
        description: 'Ativar um semestre desativa os demais — só um fica ativo por vez.',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Semestre ativado' }, 403: { description: 'Acesso negado' } },
      },
    },

    /* ─── CAPELA ────────────────────────────────────────────── */
    '/capela': {
      get: {
        tags: ['Capela'],
        summary: 'Listar capelas do semestre',
        parameters: [{ name: 'semestreId', in: 'query', required: true, schema: { type: 'string' } }],
        responses: {
          200: {
            description: 'Array de capelas',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Capela' } },
              },
            },
          },
          400: { description: 'Query semestreId faltando' },
        },
      },
    },
    '/capela/coletar': {
      post: {
        tags: ['Capela'],
        summary: 'Iniciar coleta do YouTube (admin)',
        description: 'Dispara o job e responde 202 na hora — o trabalho roda em background. Campos omitidos caem nas datas do semestre e nos defaults do servidor.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['semestreId'],
                properties: {
                  semestreId:      { type: 'string', format: 'uuid' },
                  publishedAfter:  { type: 'string', format: 'date-time' },
                  publishedBefore: { type: 'string', format: 'date-time' },
                  canal:           { type: 'string', example: '@souseminariodosul' },
                  keyword:         { type: 'string', example: 'Devoção na Capela' },
                  weekday:         { type: 'integer', minimum: 0, maximum: 6, description: '0 = domingo … 6 = sábado' },
                  gerarSinopses:   { type: 'boolean', default: true },
                },
              },
            },
          },
        },
        responses: {
          202: {
            description: 'Job de coleta criado (status GERANDO)',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Coleta' } } },
          },
          400: { description: 'semestreId faltando ou weekday inválido' },
          403: { description: 'Acesso negado' },
        },
      },
      get: {
        tags: ['Capela'],
        summary: 'Histórico de coletas do semestre (admin)',
        description: 'A coleta mais recente vem primeiro — permite retomar o acompanhamento de um job.',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'semestreId', in: 'query', required: true, schema: { type: 'string' } }],
        responses: {
          200: {
            description: 'Array de coletas',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Coleta' } },
              },
            },
          },
          400: { description: 'Query semestreId faltando' },
          403: { description: 'Acesso negado' },
        },
      },
    },
    '/capela/coletar/{id}': {
      get: {
        tags: ['Capela'],
        summary: 'Progresso de uma coleta (admin)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: {
            description: 'Estado atual do job',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Coleta' } } },
          },
          403: { description: 'Acesso negado' },
          404: { description: 'Coleta não encontrada' },
        },
      },
    },
    '/capela/manual': {
      post: {
        tags: ['Capela'],
        summary: 'Inserir capela manualmente (admin)',
        description: 'textoBiblico, tema e pregador são opcionais — dá para criar agora e preencher depois com PATCH /capela/{id}.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['semestreId', 'indice', 'data'],
                properties: {
                  semestreId:   { type: 'string', format: 'uuid' },
                  indice:       { type: 'integer', example: 1 },
                  data:         { type: 'string', format: 'date', example: '2026-03-05' },
                  textoBiblico: { type: 'string', nullable: true, example: 'João 3:16' },
                  tema:         { type: 'string', nullable: true, example: 'O Amor de Deus' },
                  pregador:     { type: 'string', nullable: true, example: 'Pastor Richard' },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Capela criada',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Capela' } } },
          },
          400: { description: 'Campos obrigatórios faltando' },
          403: { description: 'Acesso negado' },
        },
      },
    },
    '/capela/{id}': {
      get: {
        tags: ['Capela'],
        summary: 'Buscar capela por ID',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: {
            description: 'Capela encontrada',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Capela' } } },
          },
          404: { description: 'Não encontrada' },
        },
      },
      patch: {
        tags: ['Capela'],
        summary: 'Editar capela — preencher o que a IA não achou (admin)',
        description: 'Campo omitido fica como está; null explícito limpa o campo.',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  textoBiblico: { type: 'string', nullable: true },
                  tema:         { type: 'string', nullable: true },
                  pregador:     { type: 'string', nullable: true },
                  data:         { type: 'string', format: 'date' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Capela atualizada',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Capela' } } },
          },
          403: { description: 'Acesso negado' },
          404: { description: 'Não encontrada' },
        },
      },
      delete: {
        tags: ['Capela'],
        summary: 'Deletar capela (admin)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 204: { description: 'Deletada' }, 403: { description: 'Acesso negado' } },
      },
    },

    /* ─── SINOPSE ───────────────────────────────────────────── */
    '/sinopse/{capelaId}': {
      get: {
        tags: ['Sinopse'],
        summary: 'Buscar sinopse de uma capela',
        parameters: [{ name: 'capelaId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: {
            description: 'Sinopse encontrada',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Sinopse' } } },
          },
          404: { description: 'Ainda não gerada' },
        },
      },
      post: {
        tags: ['Sinopse'],
        summary: 'Gerar sinopse para uma capela (admin)',
        description: 'Exige tema ou texto bíblico preenchido — sem nenhum dos dois, a IA recusa (422).',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'capelaId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          201: {
            description: 'Sinopse gerada',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Sinopse' } } },
          },
          403: { description: 'Acesso negado' },
          422: { description: 'Sem tema nem texto bíblico' },
        },
      },
    },

    /* ─── PERSONA ───────────────────────────────────────────── */
    '/persona/perguntas': {
      get: {
        tags: ['Persona'],
        summary: 'Listar perguntas do teste MBTI (contexto: comportamento no culto)',
        responses: {
          200: {
            description: 'Array com as 8 perguntas do teste',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id:       { type: 'integer', example: 1 },
                      pergunta: { type: 'string' },
                      opcaoA:   { type: 'string' },
                      opcaoB:   { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/persona/me': {
      get: {
        tags: ['Persona'],
        summary: 'Ver minha persona',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Persona do aluno' }, 404: { description: 'Não definida' } },
      },
    },
    '/persona/preset': {
      post: {
        tags: ['Persona'],
        summary: 'Definir persona por tipo MBTI',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['tipo'],
                properties: {
                  tipo: {
                    type: 'string',
                    enum: ['INTJ','INTP','ENTJ','ENTP','INFJ','INFP','ENFJ','ENFP','ISTJ','ISFJ','ESTJ','ESFJ','ISTP','ISFP','ESTP','ESFP'],
                    example: 'ENFJ',
                  },
                },
              },
            },
          },
        },
        responses: { 200: { description: '{ tipo, nome, tom }' } },
      },
    },
    '/persona/teste': {
      post: {
        tags: ['Persona'],
        summary: 'Fazer teste MBTI (8 respostas A/B)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['respostas'],
                properties: {
                  respostas: {
                    type: 'array',
                    items: { type: 'string', enum: ['A', 'B'] },
                    minItems: 8,
                    maxItems: 8,
                    example: ['A','B','A','B','A','B','A','B'],
                  },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Tipo calculado + persona salva' } },
      },
    },

    /* ─── RELATÓRIO ─────────────────────────────────────────── */
    '/relatorio/gerar': {
      post: {
        tags: ['Relatório'],
        summary: 'Gerar relatório (retorna imediatamente, processa em background)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['semestreId'],
                properties: { semestreId: { type: 'string', example: 'uuid-do-semestre' } },
              },
            },
          },
        },
        responses: { 201: { description: '{ id, status: "PENDENTE", ... }' } },
      },
    },
    '/relatorio/me': {
      get: {
        tags: ['Relatório'],
        summary: 'Ver meus relatórios',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Array de relatórios' } },
      },
    },
    '/relatorio/{id}': {
      get: {
        tags: ['Relatório'],
        summary: 'Buscar relatório por ID',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Relatório com status atual' }, 404: { description: 'Não encontrado' } },
      },
    },
    '/relatorio/{id}/docx': {
      get: {
        tags: ['Relatório'],
        summary: 'Baixar relatório em DOCX',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: {
            description: 'Arquivo .docx para download',
            content: {
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
                schema: { type: 'string', format: 'binary' },
              },
            },
          },
          404: { description: 'Relatório não encontrado ou ainda não concluído' },
        },
      },
    },

    /* ─── CHAVES GROQ ───────────────────────────────────────── */
    '/groq-key': {
      get: {
        tags: ['Chaves Groq'],
        summary: 'Listar chaves da fila (logado)',
        description: 'Qualquer aluno logado vê a fila — só o preview mascarado, nunca a chave.',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Array de chaves',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/GroqKey' } },
              },
            },
          },
          401: { description: 'Token inválido' },
        },
      },
      post: {
        tags: ['Chaves Groq'],
        summary: 'Cadastrar chave na fila (logado)',
        description: 'A chave é validada na Groq antes de gravar e fica criptografada em repouso.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['label', 'key'],
                properties: {
                  label: { type: 'string', example: 'chave do Guilherme' },
                  key:   { type: 'string', example: 'gsk_...' },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Chave cadastrada',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/GroqKey' } } },
          },
          400: { description: 'Chave inválida (não começa com gsk_ ou recusada pela Groq)' },
          409: { description: 'Chave já cadastrada' },
        },
      },
    },
    '/groq-key/{id}': {
      delete: {
        tags: ['Chaves Groq'],
        summary: 'Remover chave (admin)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          204: { description: 'Removida' },
          403: { description: 'Acesso negado' },
          404: { description: 'Chave não encontrada' },
        },
      },
    },
    '/groq-key/{id}/reativar': {
      patch: {
        tags: ['Chaves Groq'],
        summary: 'Reativar chave esgotada/inválida (admin)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: {
            description: 'Chave reativada',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/GroqKey' } } },
          },
          403: { description: 'Acesso negado' },
          404: { description: 'Chave não encontrada' },
        },
      },
    },
  },
};
