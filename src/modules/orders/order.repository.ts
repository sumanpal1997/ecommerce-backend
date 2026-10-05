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

  public async findAll(
    filter: { status?: OrderStatus } = {},
    page = 1,
    limit = 20,
  ): Promise<{ orders: IOrderDoc[]; meta: PaginationMeta }> {
    const query: Record<string, unknown> = {};
    if (filter.status) {
      query.status = filter.status;
    }

    const skip = (page - 1) * limit;
    const [orders, totalItems] = await Promise.all([
      OrderModel.find(query)
        .populate('userId', 'email firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      OrderModel.countDocuments(query),
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

  public async getOrderStats(): Promise<{
    totalRevenue: number;
    totalOrders: number;
    averageOrderValue: number;
    statusCounts: Record<string, number>;
    recentOrders: IOrderDoc[];
  }> {
    const [allOrders, recentOrders] = await Promise.all([
      OrderModel.find({}, { status: 1, 'pricing.totalAmount': 1, createdAt: 1 }).lean(),
      OrderModel.find({})
        .populate('userId', 'email firstName lastName')
        .sort({ createdAt: -1 })
        .limit(6),
    ]);

    const statusCounts: Record<string, number> = {
      PENDING_PAYMENT: 0,
      PAID: 0,
      PROCESSING: 0,
      SHIPPED: 0,
      DELIVERED: 0,
      CANCELLED: 0,
      REFUNDED: 0,
    };

    let totalRevenue = 0;
    let completedOrdersCount = 0;

    for (const ord of allOrders) {
      statusCounts[ord.status] = (statusCounts[ord.status] || 0) + 1;
      if (['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'].includes(ord.status)) {
        totalRevenue += ord.pricing?.totalAmount || 0;
        completedOrdersCount++;
      }
    }

    const totalOrders = allOrders.length;
    const averageOrderValue =
      completedOrdersCount > 0
        ? Math.round((totalRevenue / completedOrdersCount) * 100) / 100
        : 0;

    return {
      totalRevenue,
      totalOrders,
      averageOrderValue,
      statusCounts,
      recentOrders,
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
