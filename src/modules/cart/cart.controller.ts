import { Request, Response, NextFunction } from 'express';
import { cartService, CartService } from './cart.service';
import { sendSuccess } from '../../app/utils/api-response';
import { UnauthorizedError, ForbiddenError } from '../../app/errors/app-error';

export class CartController {
  constructor(private readonly cart: CartService = cartService) {}

  private extractCartIdentity(req: Request): { userId?: string; guestId?: string } {
    const userId = req.user?.id;
    const guestId =
      (req.headers['x-guest-id'] as string) || req.cookies?.guestId || (req.query.guestId as string);

    return { userId, guestId };
  }

  public getCart = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Administrators do not participate in consumer shopping or checkout
      if (req.user?.role === 'ADMIN') {
        return sendSuccess(
          res,
          {
            id: 'admin_cart',
            items: [],
            itemCount: 0,
            subtotal: 0,
            shippingFee: 0,
            tax: 0,
            total: 0,
          },
          'Cart retrieved successfully',
          200,
        );
      }

      const { userId, guestId } = this.extractCartIdentity(req);
      const summary = await this.cart.getCart(userId, guestId);
      sendSuccess(res, summary, 'Cart retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  };

  public addItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (req.user?.role === 'ADMIN') {
        throw new ForbiddenError(
          'Administrators are not permitted to add items to cart or purchase products. Please use a customer account.',
        );
      }

      const { userId, guestId } = this.extractCartIdentity(req);
      const summary = await this.cart.addItem(req.body, userId, guestId);
      sendSuccess(res, summary, 'Item added to cart successfully', 200);
    } catch (error) {
      next(error);
    }
  };

  public updateQuantity = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId, guestId } = this.extractCartIdentity(req);
      const summary = await this.cart.updateItemQuantity(req.body, userId, guestId);
      sendSuccess(res, summary, 'Cart item quantity updated', 200);
    } catch (error) {
      next(error);
    }
  };

  public removeItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId, guestId } = this.extractCartIdentity(req);
      const sku = (req.params.sku as string).toUpperCase();
      const summary = await this.cart.removeItem(sku, userId, guestId);
      sendSuccess(res, summary, 'Item removed from cart', 200);
    } catch (error) {
      next(error);
    }
  };

  public clearCart = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId, guestId } = this.extractCartIdentity(req);
      const summary = await this.cart.clearCart(userId, guestId);
      sendSuccess(res, summary, 'Cart cleared successfully', 200);
    } catch (error) {
      next(error);
    }
  };

  public mergeCart = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.id) {
        throw new UnauthorizedError('Authentication required to merge cart');
      }

      if (req.user?.role === 'ADMIN') {
        return sendSuccess(
          res,
          {
            id: 'admin_cart',
            items: [],
            itemCount: 0,
            subtotal: 0,
            shippingFee: 0,
            tax: 0,
            total: 0,
          },
          'Guest cart ignored for admin session',
          200,
        );
      }

      const guestId = req.body.guestId;
      const summary = await this.cart.mergeGuestCartToUser(guestId, req.user.id);
      sendSuccess(res, summary, 'Guest cart merged into user account successfully', 200);
    } catch (error) {
      next(error);
    }
  };
}

export const cartController = new CartController();
