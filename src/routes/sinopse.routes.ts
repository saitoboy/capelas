import { Router } from 'express';
import { postGerar, getById } from '../controllers/sinopse.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { adminOnly } from '../middleware/adminOnly.middleware';

const router = Router();

router.get('/:capelaId', getById);                               // GET  /sinopse/:capelaId  (público)
router.post('/:capelaId', authMiddleware, adminOnly, postGerar); // POST /sinopse/:capelaId  (admin)

export default router;
