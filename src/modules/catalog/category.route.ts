import { Router } from 'express';
import { categoryController } from './category.controller';
import { authenticate, authorize } from '../auth/middleware/auth.middleware';
import { validateRequest } from '../../app/middleware/validate.middleware';
import { createCategorySchema, updateCategorySchema } from './category.schema';

const router = Router();

// Public routes
router.get('/', categoryController.getTree);
router.get('/tree', categoryController.getTree);
router.get('/slug/:slug', categoryController.getBySlug);
router.get('/:id', categoryController.getById);
router.get('/:id/breadcrumbs', categoryController.getBreadcrumbs);

// Protected Admin routes
router.post(
  '/',
  authenticate,
  authorize('ADMIN'),
  validateRequest({ body: createCategorySchema }),
  categoryController.create,
);

router.patch(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  validateRequest({ body: updateCategorySchema }),
  categoryController.update,
);

router.delete('/:id', authenticate, authorize('ADMIN'), categoryController.delete);

export default router;
