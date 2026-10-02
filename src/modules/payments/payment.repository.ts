import { Types } from 'mongoose';
import { PaymentModel } from './payment.model';
import { IPayment, IPaymentDoc, PaymentStatus } from './payment.types';

export class PaymentRepository {
  public async create(data: Partial<IPayment>): Promise<IPaymentDoc> {
    return PaymentModel.create(data);
  }

  public async findByTransactionId(transactionId: string): Promise<IPaymentDoc | null> {
    return PaymentModel.findOne({ transactionId });
  }

  public async findByOrderId(orderId: string): Promise<IPaymentDoc | null> {
    if (!Types.ObjectId.isValid(orderId)) return null;
    return PaymentModel.findOne({ orderId: new Types.ObjectId(orderId) });
  }

  public async updateStatus(
    transactionId: string,
    status: PaymentStatus,
    rawResponse?: Record<string, unknown>,
  ): Promise<IPaymentDoc | null> {
    return PaymentModel.findOneAndUpdate(
      { transactionId },
      {
        status,
        ...(rawResponse ? { rawResponse } : {}),
      },
      { returnDocument: 'after' },
    );
  }

  public async updateRefund(
    transactionId: string,
    refundId: string,
  ): Promise<IPaymentDoc | null> {
    return PaymentModel.findOneAndUpdate(
      { transactionId },
      {
        status: 'REFUNDED',
        refundId,
      },
      { returnDocument: 'after' },
    );
  }
}

export const paymentRepository = new PaymentRepository();
