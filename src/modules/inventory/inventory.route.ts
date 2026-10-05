import { Router } from 'express';
import { inventoryController } from './inventory.controller';
import { authenticate, authorize } from '../auth/middleware/auth.middleware';
import { validateRequest } from '../../app/middleware/validate.middleware';
import {
  adjustStockSchema,
  reservationActionSchema,
  reserveStockSchema,
} from './inventory.schema';

const router = Router();

// Public / Authenticated reads
router.get('/alerts/low-stock', authenticate, authorize('ADMIN'), inventoryController.getLowStockAlerts);
router.get('/', authenticate, authorize('ADMIN'), inventoryController.getAllInventory);
router.get('/:sku', inventoryController.getStatus);

// Admin stock adjustments (warehouse restock / physical counts)
router.post(
  '/adjust',
  authenticate,
  authorize('ADMIN'),
  validateRequest({ body: adjustStockSchema }),
  inventoryController.adjustStock,
);

// Reservation lifecycle (used during checkout workflows)
router.post(
  '/reserve',
  authenticate,
  validateRequest({ body: reserveStockSchema }),
  inventoryController.reserve,
);

router.post(
  '/release',
  authenticate,
  validateRequest({ body: reservationActionSchema }),
  inventoryController.release,
);

router.post(
  '/commit',
  authenticate,
  authorize('ADMIN'),
  validateRequest({ body: reservationActionSchema }),
  inventoryController.commit,
);

// Sweeper endpoint for cron jobs / workers
router.post('/sweep', authenticate, authorize('ADMIN'), inventoryController.sweep);

export default router;
