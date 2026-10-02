import { randomUUID } from 'crypto';
import {
  CreatePaymentIntentParams,
  IPaymentProvider,
  PaymentIntentResult,
  RefundResult,
  WebhookVerificationResult,
} from './payment-provider.interface';

/**
 * Mock Payment Provider implementation.
 * Used for fast, reliable unit and integration tests without network dependencies.
 */
export class MockPaymentProvider implements IPaymentProvider {
  public readonly name = 'MOCK_GATEWAY';

  public async createPaymentIntent(
    params: CreatePaymentIntentParams,
  ): Promise<PaymentIntentResult> {
    const transactionId = `txn_mock_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const clientSecret = `sec_mock_${randomUUID().replace(/-/g, '').slice(0, 24)}`;

    return {
      transactionId,
      clientSecret,
      amount: params.amount,
      currency: params.currency || 'USD',
      status: 'PENDING',
    };
  }

  public async verifyWebhook(
    payload: unknown,
    _signatureHeader?: string,
  ): Promise<WebhookVerificationResult> {
    const data = payload as {
      orderId: string;
      transactionId?: string;
      status?: 'SUCCEEDED' | 'FAILED';
    };

    return {
      orderId: data.orderId,
      transactionId: data.transactionId || `txn_mock_${randomUUID().slice(0, 8)}`,
      status: data.status || 'SUCCEEDED',
      rawEvent: payload,
    };
  }

  public async refund(transactionId: string, amount = 0): Promise<RefundResult> {
    return {
      refundId: `ref_mock_${randomUUID().slice(0, 12)}`,
      transactionId,
      amount,
      status: 'REFUNDED',
    };
  }
}

export const mockPaymentProvider = new MockPaymentProvider();
