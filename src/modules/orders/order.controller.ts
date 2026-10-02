import { Request, Response, NextFunction } from 'express';
import { orderService, OrderService } from './order.service';
import { sendSuccess } from '../../app/utils/api-response';
import { UnauthorizedError } from '../../app/errors/app-error';

export class OrderController {
  constructor(private readonly orders: OrderService = orderService) {}

  public checkout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required to checkout');
      }

      const result = await this.orders.checkout(req.user.id, req.user.email, req.body);
      sendSuccess(res, result, 'Order placed successfully. Proceed to payment.', 201);
    } catch (error) {
      next(error);
    }
  };

  public getMyOrders = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const page = parseInt((req.query.page as string) || '1', 10);
      const limit = parseInt((req.query.limit as string) || '10', 10);

      const result = await this.orders.getUserOrders(req.user.id, page, limit);
      sendSuccess(res, result.orders, 'Order history retrieved successfully', 200, result.meta);
    } catch (error) {
      next(error);
    }
  };

  public getOrderById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const isAdmin = req.user.role === 'ADMIN';
      const order = await this.orders.getOrderById(req.params.id as string, req.user.id, isAdmin);
      sendSuccess(res, { order }, 'Order details retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  };

  public updateStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { status, trackingNumber } = req.body;
      const order = await this.orders.updateOrderStatus(
        req.params.id as string,
        status,
        trackingNumber,
      );
      sendSuccess(res, { order }, 'Order status updated successfully', 200);
    } catch (error) {
      next(error);
    }
  };
}

export const orderController = new OrderController();
