import { Router } from 'express';
import { getMinhaPersona, postPreset, postTeste, getPerguntas } from '../controllers/persona.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.get('/perguntas', getPerguntas); // pública, antes do authMiddleware


router.use(authMiddleware);

router.get('/me', getMinhaPersona);
router.post('/preset', postPreset);
router.post('/teste', postTeste);

export default router;
