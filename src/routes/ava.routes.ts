import { Router } from 'express';
import {
  postConectarAva,
  getStatusAva,
  deleteConectarAva,
} from '../controllers/ava.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Conexão do portal do AVA — individual, cada usuário com a própria sessão.
router.post('/conectar',   authMiddleware, postConectarAva);   // POST   /ava/conectar  { senha }
router.get('/conectar',    authMiddleware, getStatusAva);       // GET    /ava/conectar  → status
router.delete('/conectar', authMiddleware, deleteConectarAva);  // DELETE /ava/conectar

export default router;
