export interface CreatePaymentIntentParams {
  orderId: string;
  orderNumber: string;
  amount: number; // In base currency units, e.g. 150.00
  currency?: string; // Default 'usd'
  customerEmail: string;
  idempotencyKey?: string;
}

export interface PaymentIntentResult {
  transactionId: string;
  clientSecret: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED';
}

export interface WebhookVerificationResult {
  orderId: string;
  transactionId: string;
  status: 'SUCCEEDED' | 'FAILED';
  rawEvent?: unknown;
}

export interface RefundResult {
  refundId: string;
  transactionId: string;
  amount: number;
  status: 'REFUNDED';
}

/**
 * Pluggable Payment Provider Interface.
 * Shields the core application domains from vendor-specific payment APIs (Stripe, Razorpay, PayPal).
 */
export interface IPaymentProvider {
  readonly name: string;

  createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntentResult>;

  verifyWebhook(
    payload: unknown,
    signatureHeader?: string,
  ): Promise<WebhookVerificationResult>;

  refund(transactionId: string, amount?: number): Promise<RefundResult>;
}
