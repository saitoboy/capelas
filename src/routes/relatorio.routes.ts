import { Router } from 'express';
import { postGerar, getMeus, getById } from '../controllers/relatorio.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.post('/gerar', postGerar);
router.get('/me', getMeus);
router.get('/:id', getById);

export default router;
