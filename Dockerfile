# Backend Capela — Node 22 + Prisma 7 (driver adapter pg)
FROM node:22-slim

# openssl é exigido pelo engine de migração do Prisma.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instala TODAS as dependências (precisamos do prisma CLI e do tsc no build).
COPY package*.json ./
RUN npm ci

# Copia o código e o schema, gera o Prisma Client e compila TS -> build/.
COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3003
EXPOSE 3003

# `start` aplica as migrações pendentes (prisma migrate deploy) e sobe o servidor.
CMD ["npm", "start"]
