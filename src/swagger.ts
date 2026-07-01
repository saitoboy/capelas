export const swaggerSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Capela API',
    version: '1.0.0',
    description: 'API de gestão de capelas, relatórios e personas para alunos.',
  },
  servers: [{ url: 'http://localhost:3003' }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: { mensagem: { type: 'string' } },
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
                required: ['ra', 'nome', 'senha', 'curso'],
                properties: {
                  ra:    { type: 'string', example: '251000841' },
                  nome:  { type: 'string', example: 'Débora Silva' },
                  senha: { type: 'string', example: '@Debora123' },
                  curso: {
                    type: 'string',
                    enum: ['TEOLOGIA', 'PEDAGOGIA', 'ENFERMAGEM', 'ADMINISTRACAO', 'DIREITO'],
                    example: 'TEOLOGIA',
                  },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Usuário criado' },
          409: { description: 'RA já cadastrado' },
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
          200: { description: 'Token JWT retornado' },
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
          200: { description: 'Dados do usuário logado' },
          401: { description: 'Token inválido' },
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
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Semestre encontrado' }, 404: { description: 'Não encontrado' } },
      },
    },
    '/semestre/{id}/ativar': {
      patch: {
        tags: ['Semestre'],
        summary: 'Ativar semestre (admin)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Semestre ativado' }, 403: { description: 'Acesso negado' } },
      },
    },

    /* ─── CAPELA ────────────────────────────────────────────── */
    '/capela': {
      get: {
        tags: ['Capela'],
        summary: 'Listar capelas do semestre',
        parameters: [{ name: 'semestreId', in: 'query', required: true, schema: { type: 'integer' }, example: 1 }],
        responses: { 200: { description: 'Array de capelas' } },
      },
    },
    '/capela/{id}': {
      get: {
        tags: ['Capela'],
        summary: 'Buscar chapel por ID',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Chapel encontrada' }, 404: { description: 'Não encontrada' } },
      },
      delete: {
        tags: ['Capela'],
        summary: 'Deletar chapel (admin)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 204: { description: 'Deletada' }, 403: { description: 'Acesso negado' } },
      },
    },
    '/capela/manual': {
      post: {
        tags: ['Capela'],
        summary: 'Inserir chapel manual (admin)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['semestreId', 'indice', 'data', 'textoBiblico', 'tema', 'pregador'],
                properties: {
                  semestreId:    { type: 'integer', example: 1 },
                  indice:        { type: 'integer', example: 1 },
                  data:          { type: 'string', format: 'date', example: '2026-03-05' },
                  textoBiblico:  { type: 'string', example: 'João 3:16' },
                  tema:          { type: 'string', example: 'O Amor de Deus' },
                  pregador:      { type: 'string', example: 'Pastor Richard Blackaby' },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Chapel criada' } },
      },
    },
    '/capela/coletar': {
      post: {
        tags: ['Capela'],
        summary: 'Coletar capelas do YouTube (admin)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['semestreId'],
                properties: { semestreId: { type: 'integer', example: 1 } },
              },
            },
          },
        },
        responses: { 200: { description: '{ inseridas, atualizadas, erros[] }' } },
      },
    },

    /* ─── SINOPSE ───────────────────────────────────────────── */
    '/sinopse/{capelaId}': {
      get: {
        tags: ['Sinopse'],
        summary: 'Buscar sinopse de uma chapel',
        parameters: [{ name: 'capelaId', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Sinopse encontrada' }, 404: { description: 'Ainda não gerada' } },
      },
      post: {
        tags: ['Sinopse'],
        summary: 'Gerar sinopse para uma chapel (admin)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'capelaId', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 201: { description: '{ id, capelaId, texto, geradoEm }' } },
      },
    },

    /* ─── PERSONA ───────────────────────────────────────────── */
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
                properties: { semestreId: { type: 'integer', example: 1 } },
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
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Relatório com status atual' }, 404: { description: 'Não encontrado' } },
      },
    },
    '/relatorio/{id}/docx': {
      get: {
        tags: ['Relatório'],
        summary: 'Baixar relatório em DOCX',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
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
  },
};
