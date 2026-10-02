import { Schema, model } from 'mongoose';
import { IPaymentDoc } from './payment.types';

const paymentSchema = new Schema<IPaymentDoc>(
  {
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    orderNumber: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    provider: {
      type: String,
      required: true,
      default: 'MOCK_GATEWAY',
    },
    transactionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    clientSecret: {
      type: String,
    },
    amount: {
      type: Number,
      required: true,
      min: [0, 'Payment amount cannot be negative'],
    },
    currency: {
      type: String,
      default: 'USD',
      uppercase: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED'],
      default: 'PENDING',
      index: true,
    },
    idempotencyKey: {
      type: String,
      sparse: true,
      index: true,
    },
    refundId: {
      type: String,
      sparse: true,
    },
    rawResponse: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        delete ret.__v;
        return ret;
      },
    },
  },
);

paymentSchema.index({ orderId: 1, status: 1 });

export const PaymentModel = model<IPaymentDoc>('Payment', paymentSchema);
