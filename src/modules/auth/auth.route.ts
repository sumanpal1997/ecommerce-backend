import { Router } from 'express';
import { authController } from './auth.controller';
import { validateRequest } from '../../app/middleware/validate.middleware';
import { registerSchema, loginSchema } from './auth.schema';
import { authenticate } from './middleware/auth.middleware';

const router = Router();

router.post('/register', validateRequest({ body: registerSchema }), authController.register);
router.post('/login', validateRequest({ body: loginSchema }), authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.get('/me', authenticate, authController.getMe);

export default router;
