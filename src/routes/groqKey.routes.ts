import { Router } from 'express';
import { getChaves, postChave, deleteChave, patchReativar } from '../controllers/groqKey.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { adminOnly } from '../middleware/adminOnly.middleware';

const router = Router();

router.use(authMiddleware);

// Qualquer aluno logado pode ver a fila e doar uma chave — é o que mantém a
// fila abastecida. A listagem só expõe o preview mascarado, nunca a chave.
router.get('/',  getChaves);
router.post('/', postChave);

// Remover e reativar mexem na fila dos outros — só admin.
router.delete('/:id',        adminOnly, deleteChave);
router.patch('/:id/reativar', adminOnly, patchReativar);

export default router;
