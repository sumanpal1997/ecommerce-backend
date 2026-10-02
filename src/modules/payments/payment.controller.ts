import { Request, Response, NextFunction } from 'express';
import { paymentService, PaymentService } from './payment.service';
import { orderService, OrderService } from '../orders/order.service';
import { sendSuccess } from '../../app/utils/api-response';

export class PaymentController {
  constructor(
    private readonly payment: PaymentService = paymentService,
    private readonly orders: OrderService = orderService,
  ) {}

  /**
   * Webhook listener endpoint for payment providers (e.g. Stripe, Razorpay, Mock).
   */
  public handleWebhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const signature = (req.headers['stripe-signature'] || req.headers['x-signature']) as
        | string
        | undefined;

      const verification = await this.payment.processWebhook(req.body, signature);

      if (verification.status === 'SUCCEEDED') {
        await this.orders.handlePaymentSuccess(verification.orderId, verification.transactionId);
      } else {
        await this.orders.handlePaymentFailure(verification.orderId);
      }

      sendSuccess(res, { received: true }, 'Webhook processed successfully', 200);
    } catch (error) {
      next(error);
    }
  };
}

export const paymentController = new PaymentController();
