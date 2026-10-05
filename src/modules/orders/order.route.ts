import { Router } from 'express';
import { orderController } from './order.controller';
import { authenticate, authorize } from '../auth/middleware/auth.middleware';
import { validateRequest } from '../../app/middleware/validate.middleware';
import { checkoutSchema, updateOrderStatusSchema } from './order.schema';

const router = Router();

router.post(
  '/checkout',
  authenticate,
  validateRequest({ body: checkoutSchema }),
  orderController.checkout,
);

// Customer orders
router.get('/me', authenticate, orderController.getMyOrders);

// Admin queries (MUST be mounted before /:id)
router.get('/admin/metrics', authenticate, authorize('ADMIN'), orderController.getMetrics);
router.get('/', authenticate, authorize('ADMIN'), orderController.getAllOrders);

router.get('/:id', authenticate, orderController.getOrderById);

router.patch(
  '/:id/status',
  authenticate,
  authorize('ADMIN'),
  validateRequest({ body: updateOrderStatusSchema }),
  orderController.updateStatus,
);

export default router;
