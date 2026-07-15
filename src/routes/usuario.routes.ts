import { Router } from 'express';
import {
  getUsuarios,
  postUsuario,
  patchUsuario,
  patchSenha,
  deleteUsuario,
} from '../controllers/usuario.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { adminOnly } from '../middleware/adminOnly.middleware';

const router = Router();

// Toda a gestão de usuários é restrita a admin.
router.use(authMiddleware, adminOnly);

router.get('/',           getUsuarios);
router.post('/',          postUsuario);
router.patch('/:ra',      patchUsuario);
router.patch('/:ra/senha', patchSenha);
router.delete('/:ra',     deleteUsuario);

export default router;
