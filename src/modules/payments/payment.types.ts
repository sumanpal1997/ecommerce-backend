import { Document, Types } from 'mongoose';

export type PaymentStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED';

export interface IPayment {
  orderId: Types.ObjectId;
  orderNumber: string;
  userId: Types.ObjectId;
  provider: string; // e.g. 'MOCK_GATEWAY', 'STRIPE', 'RAZORPAY'
  transactionId: string;
  clientSecret?: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  idempotencyKey?: string;
  refundId?: string;
  rawResponse?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPaymentDoc extends IPayment, Document {
  _id: Types.ObjectId;
}
