import { Types } from 'mongoose';
import { OrderModel } from './order.model';
import { IOrder, IOrderDoc, OrderStatus } from './order.types';
import { PaginationMeta } from '../../app/utils/api-response';

export class OrderRepository {
  public async create(data: Partial<IOrder>): Promise<IOrderDoc> {
    return OrderModel.create(data);
  }

  public async findById(id: string): Promise<IOrderDoc | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return OrderModel.findById(id).populate('userId', 'email firstName lastName');
  }

  public async findByOrderNumber(orderNumber: string): Promise<IOrderDoc | null> {
    return OrderModel.findOne({ orderNumber }).populate('userId', 'email firstName lastName');
  }

  public async findByIdempotencyKey(idempotencyKey: string): Promise<IOrderDoc | null> {
    return OrderModel.findOne({ idempotencyKey });
  }

  public async findByUserId(
    userId: string,
    page = 1,
    limit = 10,
  ): Promise<{ orders: IOrderDoc[]; meta: PaginationMeta }> {
    const validUserId = new Types.ObjectId(userId);
    const skip = (page - 1) * limit;

    const [orders, totalItems] = await Promise.all([
      OrderModel.find({ userId: validUserId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      OrderModel.countDocuments({ userId: validUserId }),
    ]);

    const totalPages = Math.ceil(totalItems / limit);

    return {
      orders,
      meta: {
        page,
        limit,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  public async updateStatus(
    id: string,
    status: OrderStatus,
    trackingNumber?: string,
  ): Promise<IOrderDoc | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return OrderModel.findByIdAndUpdate(
      id,
      {
        status,
        ...(trackingNumber ? { trackingNumber } : {}),
      },
      { returnDocument: 'after' },
    );
  }
}

export const orderRepository = new OrderRepository();
