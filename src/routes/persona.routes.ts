import { Router } from 'express';
import { getMinhaPersona, postPreset, postTeste } from '../controllers/persona.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/me', getMinhaPersona);
router.post('/preset', postPreset);
router.post('/teste', postTeste);

export default router;
