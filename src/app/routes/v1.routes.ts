import { Router } from 'express';
import authRoutes from '../../modules/auth/auth.route';
import { sendSuccess } from '../utils/api-response';

const router = Router();

// Health check endpoint for uptime monitors and load balancers
router.get('/health', (_req, res) => {
  sendSuccess(
    res,
    {
      status: 'UP',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
    'Service is healthy',
  );
});

// Domain Routes
router.use('/auth', authRoutes);

export default router;
