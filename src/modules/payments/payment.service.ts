import { Types } from 'mongoose';
import { paymentRepository, PaymentRepository } from './payment.repository';
import {
  IPaymentProvider,
  PaymentIntentResult,
  WebhookVerificationResult,
} from './providers/payment-provider.interface';
import { mockPaymentProvider } from './providers/mock-payment.provider';
import { IPaymentDoc } from './payment.types';
import { NotFoundError } from '../../app/errors/app-error';

export class PaymentService {
  constructor(
    private readonly paymentRepo: PaymentRepository = paymentRepository,
    private readonly provider: IPaymentProvider = mockPaymentProvider,
  ) {}

  /**
   * Initializes a payment intent through the active payment provider adapter.
   */
  public async createPaymentIntent(
    orderId: string,
    orderNumber: string,
    userId: string,
    userEmail: string,
    totalAmount: number,
    idempotencyKey?: string,
  ): Promise<PaymentIntentResult> {
    const intent = await this.provider.createPaymentIntent({
      orderId,
      orderNumber,
      amount: totalAmount,
      currency: 'USD',
      customerEmail: userEmail,
      idempotencyKey,
    });

    await this.paymentRepo.create({
      orderId: new Types.ObjectId(orderId),
      orderNumber,
      userId: new Types.ObjectId(userId),
      provider: this.provider.name,
      transactionId: intent.transactionId,
      clientSecret: intent.clientSecret,
      amount: intent.amount,
      currency: intent.currency,
      status: 'PENDING',
      idempotencyKey,
    });

    return intent;
  }

  /**
   * Processes incoming webhook events from the payment gateway.
   */
  public async processWebhook(
    payload: unknown,
    signatureHeader?: string,
  ): Promise<WebhookVerificationResult> {
    const verified = await this.provider.verifyWebhook(payload, signatureHeader);

    const payment = await this.paymentRepo.findByTransactionId(verified.transactionId);
    if (payment) {
      await this.paymentRepo.updateStatus(
        verified.transactionId,
        verified.status === 'SUCCEEDED' ? 'SUCCEEDED' : 'FAILED',
        payload as Record<string, unknown>,
      );
    }

    return verified;
  }

  /**
   * Processes a refund for an order.
   */
  public async processRefund(orderId: string, amount?: number): Promise<IPaymentDoc> {
    const payment = await this.paymentRepo.findByOrderId(orderId);
    if (!payment) {
      throw new NotFoundError(`Payment record for order '${orderId}' not found`);
    }

    const refund = await this.provider.refund(payment.transactionId, amount);
    const updated = await this.paymentRepo.updateRefund(payment.transactionId, refund.refundId);

    if (!updated) {
      throw new NotFoundError('Failed to record payment refund');
    }

    return updated;
  }
}

export const paymentService = new PaymentService();
