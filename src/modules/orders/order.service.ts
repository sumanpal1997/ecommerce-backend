import { Types } from 'mongoose';
import { orderRepository, OrderRepository } from './order.repository';
import { cartService, CartService } from '../cart/cart.service';
import { inventoryService, InventoryService } from '../inventory/inventory.service';
import { paymentService, PaymentService } from '../payments/payment.service';
import { OrderStateMachine } from './order.state-machine';
import { CheckoutSchemaInput } from './order.schema';
import {
  IOrderDoc,
  IOrderItem,
  OrderStatus,
} from './order.types';
import { PaymentIntentResult } from '../payments/providers/payment-provider.interface';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../app/errors/app-error';
import { PaginationMeta } from '../../app/utils/api-response';
import { randomUUID } from 'crypto';

export class OrderService {
  constructor(
    private readonly orderRepo: OrderRepository = orderRepository,
    private readonly cart: CartService = cartService,
    private readonly inventory: InventoryService = inventoryService,
    private readonly payment: PaymentService = paymentService,
  ) {}

  private generateOrderNumber(): string {
    const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const uniqueSuffix = randomUUID().slice(0, 6).toUpperCase();
    return `ORD-${datePrefix}-${uniqueSuffix}`;
  }

  /**
   * CRITICAL CHECKOUT ORCHESTRATION:
   * 1. Evaluates live cart & verifies stock availability
   * 2. Atomically reserves warehouse stock with a 15-minute TTL
   * 3. Creates an immutable order snapshot (freezing title, price, and specs)
   * 4. Empties the user's shopping cart
   * 5. Initiates payment intent via payment provider adapter
   */
  public async checkout(
    userId: string,
    userEmail: string,
    input: CheckoutSchemaInput,
  ): Promise<{ order: IOrderDoc; paymentIntent: PaymentIntentResult }> {
    // 1. Idempotency Guard (protects against rapid double-clicks on "Place Order")
    if (input.idempotencyKey) {
      const existingOrder = await this.orderRepo.findByIdempotencyKey(input.idempotencyKey);
      if (existingOrder) {
        const payment = await this.payment.createPaymentIntent(
          existingOrder._id.toString(),
          existingOrder.orderNumber,
          userId,
          userEmail,
          existingOrder.pricing.totalAmount,
          input.idempotencyKey,
        );
        return { order: existingOrder, paymentIntent: payment };
      }
    }

    // 2. Validate Cart State
    const cartSummary = await this.cart.getCart(userId);
    if (cartSummary.items.length === 0) {
      throw new BadRequestError('Cannot checkout with an empty cart');
    }

    if (cartSummary.hasUnavailableItems) {
      throw new ConflictError(
        'One or more items in your cart are currently out of stock. Please adjust quantities before checkout.',
      );
    }

    const orderNumber = this.generateOrderNumber();
    const reservationId = `res-${orderNumber.toLowerCase()}`;

    // 3. Atomically Reserve Inventory
    await this.inventory.reserveStock({
      reservationId,
      items: cartSummary.items.map((item) => ({
        sku: item.sku,
        quantity: item.quantity,
      })),
      ttlMinutes: 15,
    });

    // 4. Create Historical Snapshot of Order Items
    const orderItems: IOrderItem[] = cartSummary.items.map((item) => ({
      productId: new Types.ObjectId(item.productId),
      sku: item.sku,
      title: item.title,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      subtotal: item.subtotal,
      image: item.image,
    }));

    // 5. Persist Order in PENDING_PAYMENT Status
    const order = await this.orderRepo.create({
      orderNumber,
      userId: new Types.ObjectId(userId),
      items: orderItems,
      shippingAddress: input.shippingAddress,
      pricing: {
        subtotal: cartSummary.subtotal,
        shippingFee: cartSummary.estimatedShipping,
        discountAmount: 0,
        tax: 0,
        totalAmount: cartSummary.total,
      },
      status: 'PENDING_PAYMENT',
      reservationId,
      idempotencyKey: input.idempotencyKey,
    });

    // 6. Clear Customer Shopping Cart
    await this.cart.clearCart(userId);

    // 7. Initialize Payment Intent
    const paymentIntent = await this.payment.createPaymentIntent(
      order._id.toString(),
      order.orderNumber,
      userId,
      userEmail,
      order.pricing.totalAmount,
      input.idempotencyKey,
    );

    return { order, paymentIntent };
  }

  /**
   * Finalizes an order upon verified payment success (PAID).
   * Commits the inventory reservation (deducts from warehouse reserved pool).
   */
  public async handlePaymentSuccess(orderId: string, _transactionId?: string): Promise<IOrderDoc> {
    const order = await this.orderRepo.findById(orderId);
    if (!order) {
      throw new NotFoundError(`Order '${orderId}' not found`);
    }

    if (order.status === 'PAID') {
      return order; // Idempotent
    }

    OrderStateMachine.validateTransition(order.status, 'PAID');

    // 1. Commit reserved inventory
    await this.inventory.commitReservation(order.reservationId);

    // 2. Update status to PAID
    const updated = await this.orderRepo.updateStatus(order._id.toString(), 'PAID');
    return updated || order;
  }

  /**
   * Cancels an order upon payment failure or timeout.
   * Releases reserved stock back to the available pool.
   */
  public async handlePaymentFailure(orderId: string): Promise<IOrderDoc> {
    const order = await this.orderRepo.findById(orderId);
    if (!order) {
      throw new NotFoundError(`Order '${orderId}' not found`);
    }

    if (order.status === 'CANCELLED') {
      return order; // Idempotent
    }

    OrderStateMachine.validateTransition(order.status, 'CANCELLED');

    // 1. Release reserved stock back to available warehouse pool
    await this.inventory.releaseReservation(order.reservationId);

    // 2. Update status to CANCELLED
    const updated = await this.orderRepo.updateStatus(order._id.toString(), 'CANCELLED');
    return updated || order;
  }

  /**
   * Transitions order through its lifecycle using the State Machine.
   */
  public async updateOrderStatus(
    orderId: string,
    nextStatus: OrderStatus,
    trackingNumber?: string,
  ): Promise<IOrderDoc> {
    const order = await this.orderRepo.findById(orderId);
    if (!order) {
      throw new NotFoundError(`Order '${orderId}' not found`);
    }

    OrderStateMachine.validateTransition(order.status, nextStatus);

    // If cancelled while still pending, release reserved stock
    if (nextStatus === 'CANCELLED' && order.status === 'PENDING_PAYMENT') {
      await this.inventory.releaseReservation(order.reservationId);
    }

    // If refunded, initiate payment refund
    if (nextStatus === 'REFUNDED') {
      await this.payment.processRefund(order._id.toString(), order.pricing.totalAmount);
    }

    const updated = await this.orderRepo.updateStatus(
      order._id.toString(),
      nextStatus,
      trackingNumber,
    );
    return updated || order;
  }

  /**
   * Retrieves an order with object-level authorization (Customer can only see their own order).
   */
  public async getOrderById(orderId: string, userId: string, isAdmin = false): Promise<IOrderDoc> {
    const order = await this.orderRepo.findById(orderId);
    if (!order) {
      throw new NotFoundError('Order not found');
    }

    const orderOwnerId = (order.userId as unknown as { _id?: Types.ObjectId })._id
      ? (order.userId as unknown as { _id: Types.ObjectId })._id.toString()
      : order.userId.toString();

    if (!isAdmin && orderOwnerId !== userId) {
      throw new ForbiddenError('You do not have permission to view this order');
    }

    return order;
  }

  /**
   * Paginated order history for customer portal.
   */
  public async getUserOrders(
    userId: string,
    page = 1,
    limit = 10,
  ): Promise<{ orders: IOrderDoc[]; meta: PaginationMeta }> {
    return this.orderRepo.findByUserId(userId, page, limit);
  }

  /**
   * Admin order management: retrieve all customer orders across platform.
   */
  public async getAllOrders(
    filter: { status?: OrderStatus } = {},
    page = 1,
    limit = 20,
  ): Promise<{ orders: IOrderDoc[]; meta: PaginationMeta }> {
    return this.orderRepo.findAll(filter, page, limit);
  }

  /**
   * Executive Dashboard: aggregated metrics for store operators.
   */
  public async getDashboardMetrics(): Promise<{
    revenue: { total: number; aov: number };
    orders: { total: number; statusBreakdown: Record<string, number> };
    recentOrders: IOrderDoc[];
    inventory: { lowStockCount: number; lowStockItems: unknown[] };
  }> {
    const [orderStats, lowStockItems] = await Promise.all([
      this.orderRepo.getOrderStats(),
      this.inventory.getLowStockAlerts(),
    ]);

    return {
      revenue: {
        total: orderStats.totalRevenue,
        aov: orderStats.averageOrderValue,
      },
      orders: {
        total: orderStats.totalOrders,
        statusBreakdown: orderStats.statusCounts,
      },
      recentOrders: orderStats.recentOrders,
      inventory: {
        lowStockCount: lowStockItems.length,
        lowStockItems,
      },
    };
  }
}

export const orderService = new OrderService();
