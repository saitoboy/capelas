import 'dotenv/config';
import express, { Request, Response } from "express";
import cors from "cors";

import { AddressInfo } from "net";
import { logSuccess, logError } from "./utils/logger";
import authRoutes from "./routes/auth.routes";
import personaRoutes from "./routes/persona.routes";

const app = express();

app.use(express.json());
app.use(cors());

app.get("/", (_req: Request, res: Response) => {
  res.json({ ok: true });
});

app.use("/auth", authRoutes);
app.use("/persona", personaRoutes);

const server = app.listen(process.env.PORT || 3003, () => {
  if (server) {
    const address = server.address() as AddressInfo;
    logSuccess(`Servidor rodando em http://localhost:${address.port}`, 'server');
  } else {
    logError('Falha ao iniciar o servidor', 'server');
  }
});
