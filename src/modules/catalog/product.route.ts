import { Router } from 'express';
import { productController } from './product.controller';
import { authenticate, authorize } from '../auth/middleware/auth.middleware';
import { validateRequest } from '../../app/middleware/validate.middleware';
import {
  createProductSchema,
  productQuerySchema,
  updateProductSchema,
} from './product.schema';

const router = Router();

// Public routes
router.get('/', validateRequest({ query: productQuerySchema }), productController.list);
router.get('/autocomplete', productController.autocomplete);
router.get('/slug/:slug', productController.getBySlug);
router.get('/:id', productController.getById);

// Protected Admin routes
router.post(
  '/',
  authenticate,
  authorize('ADMIN'),
  validateRequest({ body: createProductSchema }),
  productController.create,
);

router.patch(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  validateRequest({ body: updateProductSchema }),
  productController.update,
);

router.delete('/:id', authenticate, authorize('ADMIN'), productController.delete);

export default router;
