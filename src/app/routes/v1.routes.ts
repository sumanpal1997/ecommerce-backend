import { Router } from 'express';
import authRoutes from '../../modules/auth/auth.route';
import categoryRoutes from '../../modules/catalog/category.route';
import productRoutes from '../../modules/catalog/product.route';
import inventoryRoutes from '../../modules/inventory/inventory.route';
import cartRoutes from '../../modules/cart/cart.route';
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
router.use('/categories', categoryRoutes);
router.use('/products', productRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/cart', cartRoutes);

export default router;
