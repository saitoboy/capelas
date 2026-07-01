import { Router } from 'express';
import {
  postSemestre,
  getSemestres,
  getSemestreAtivo,
  getSemestreById,
  patchAtivar,
} from '../controllers/semestre.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { adminOnly } from '../middleware/adminOnly.middleware';

const router = Router();

// Rotas públicas
router.get('/', getSemestres);
router.get('/ativo', getSemestreAtivo);
router.get('/:id', getSemestreById);

// Rotas admin
router.post('/', authMiddleware, adminOnly, postSemestre);
router.patch('/:id/ativar', authMiddleware, adminOnly, patchAtivar);

export default router;
