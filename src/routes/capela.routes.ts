import { Router } from 'express';
import { getCapelas, getCapelaById, postCapelaManual, postColetarCapelas, deleteCapelaById } from '../controllers/capela.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { adminOnly } from '../middleware/adminOnly.middleware';

const router = Router();

// Rotas públicas
router.get('/', getCapelas);           // GET /capela?semestreId=1
router.get('/:id', getCapelaById);     // GET /capela/:id

// Rotas admin
router.post('/manual',  authMiddleware, adminOnly, postCapelaManual);     // POST /capela/manual
router.post('/coletar', authMiddleware, adminOnly, postColetarCapelas);   // POST /capela/coletar
router.delete('/:id',   authMiddleware, adminOnly, deleteCapelaById);     // DELETE /capela/:id

export default router;
