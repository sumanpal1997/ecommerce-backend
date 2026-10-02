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

router.get('/me', authenticate, orderController.getMyOrders);
router.get('/:id', authenticate, orderController.getOrderById);

router.patch(
  '/:id/status',
  authenticate,
  authorize('ADMIN'),
  validateRequest({ body: updateOrderStatusSchema }),
  orderController.updateStatus,
);

export default router;
