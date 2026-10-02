import { Router } from 'express';
import { cartController } from './cart.controller';
import { authenticate, optionalAuthenticate } from '../auth/middleware/auth.middleware';
import { validateRequest } from '../../app/middleware/validate.middleware';
import {
  addItemSchema,
  mergeCartSchema,
  removeItemSchema,
  updateQuantitySchema,
} from './cart.schema';

const router = Router();

// Routes supporting both Guests and Logged-in Users
router.get('/', optionalAuthenticate, cartController.getCart);
router.post('/items', optionalAuthenticate, validateRequest({ body: addItemSchema }), cartController.addItem);
router.patch('/items', optionalAuthenticate, validateRequest({ body: updateQuantitySchema }), cartController.updateQuantity);
router.delete('/items/:sku', optionalAuthenticate, validateRequest({ params: removeItemSchema }), cartController.removeItem);
router.delete('/', optionalAuthenticate, cartController.clearCart);

// Merge Guest Cart into Authenticated Account
router.post('/merge', authenticate, validateRequest({ body: mergeCartSchema }), cartController.mergeCart);

export default router;
