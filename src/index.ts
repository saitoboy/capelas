import 'dotenv/config';
import express, { Request, Response } from "express";
import cors from "cors";
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './swagger';
import { initUndiciProxy } from "./utils/groq";

// Registra dispatcher global do undici para que youtube-caption-extractor
// (que usa fetch nativo) também passe pelo proxy corporativo
initUndiciProxy();

import { AddressInfo } from "net";
import { logSuccess, logError } from "./utils/logger";
import authRoutes from "./routes/auth.routes";
import personaRoutes from "./routes/persona.routes";
import relatorioRoutes from "./routes/relatorio.routes";
import semestreRoutes from "./routes/semestre.routes";
import capelaRoutes from "./routes/capela.routes";
import sinopseRoutes from "./routes/sinopse.routes";
import groqKeyRoutes from "./routes/groqKey.routes";

const app = express();

app.use(express.json());
app.use(cors());

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get("/", (_req: Request, res: Response) => {
  res.json({ ok: true });
});

app.use("/auth", authRoutes);
app.use("/persona", personaRoutes);
app.use("/relatorio", relatorioRoutes);
app.use("/semestre", semestreRoutes);
app.use("/capela", capelaRoutes);
app.use("/sinopse", sinopseRoutes);
app.use("/groq-key", groqKeyRoutes);

const port = process.env.PORT || 3003;

const server = app.listen(port, () => {
  const address = server.address() as AddressInfo | null;
  if (address) {
    logSuccess(`Servidor rodando em http://localhost:${address.port}`, 'server');
  }
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    logError(`Porta ${port} já está em uso. Encerre o processo que a ocupa e tente de novo.`, 'server');
  } else {
    logError(`Falha ao iniciar o servidor: ${err.message}`, 'server', err);
  }
  process.exit(1);
});
