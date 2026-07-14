import { Router } from 'express';
import {
  getCapelas,
  getCapelaById,
  postCapelaManual,
  postColetarCapelas,
  getColeta,
  getColetas,
  patchCapela,
  deleteCapelaById,
} from '../controllers/capela.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { adminOnly } from '../middleware/adminOnly.middleware';

const router = Router();

// Rotas admin — declaradas antes de '/:id' para que 'coletar' não seja lido como id
router.post('/coletar',     authMiddleware, adminOnly, postColetarCapelas);  // POST  /capela/coletar    → 202
router.get('/coletar',      authMiddleware, adminOnly, getColetas);          // GET   /capela/coletar?semestreId= → histórico
router.get('/coletar/:id',  authMiddleware, adminOnly, getColeta);           // GET   /capela/coletar/:id → progresso
router.post('/manual',      authMiddleware, adminOnly, postCapelaManual);    // POST  /capela/manual
router.patch('/:id',        authMiddleware, adminOnly, patchCapela);         // PATCH /capela/:id → edição manual
router.delete('/:id',       authMiddleware, adminOnly, deleteCapelaById);    // DELETE /capela/:id

// Rotas públicas
router.get('/',    getCapelas);      // GET /capela?semestreId=...
router.get('/:id', getCapelaById);   // GET /capela/:id

export default router;
