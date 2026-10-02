import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app/app';
import { connectTestDB, clearTestDB, closeTestDB } from '../helpers/db.helper';
import { UserModel } from '../../src/modules/users/user.model';
import { tokenService } from '../../src/modules/auth/token.service';
import { CategoryModel } from '../../src/modules/catalog/category.model';
import { ProductModel } from '../../src/modules/catalog/product.model';
import { InventoryModel } from '../../src/modules/inventory/inventory.model';
import { OrderModel } from '../../src/modules/orders/order.model';

describe('Order & Payment Lifecycle Integration Tests', () => {
  let customerAToken: string;
  let customerAId: string;
  let customerBToken: string;
  let adminToken: string;

  let productId: string;
  const itemSku = 'ORD-PROD-SKU';

  beforeAll(async () => {
    await connectTestDB();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();

    // 1. Create Customer A
    const custA = await UserModel.create({
      email: 'customera@example.com',
      passwordHash: 'dummy_hash',
      firstName: 'Alice',
      lastName: 'Smith',
      role: 'CUSTOMER',
      isActive: true,
      refreshTokenVersion: 0,
    });
    customerAId = custA._id.toString();
    customerAToken = tokenService.generateTokens(
      customerAId,
      custA.email,
      'CUSTOMER',
      0,
    ).accessToken;

    // 2. Create Customer B
    const custB = await UserModel.create({
      email: 'customerb@example.com',
      passwordHash: 'dummy_hash',
      firstName: 'Bob',
      lastName: 'Jones',
      role: 'CUSTOMER',
      isActive: true,
      refreshTokenVersion: 0,
    });
    customerBToken = tokenService.generateTokens(
      custB._id.toString(),
      custB.email,
      'CUSTOMER',
      0,
    ).accessToken;

    // 3. Create Admin
    const admin = await UserModel.create({
      email: 'admin@example.com',
      passwordHash: 'dummy_hash',
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
      isActive: true,
      refreshTokenVersion: 0,
    });
    adminToken = tokenService.generateTokens(
      admin._id.toString(),
      admin.email,
      'ADMIN',
      0,
    ).accessToken;

    // 4. Create Category, Product ($50) and Inventory (10 units)
    const category = await CategoryModel.create({
      name: 'Footwear',
      slug: 'footwear',
      path: '/footwear',
      level: 0,
    });

    const product = await ProductModel.create({
      title: 'Pro Running Shoes',
      slug: 'pro-running-shoes',
      description: 'High performance marathon shoes',
      brand: 'Swift',
      categoryId: category._id,
      sku: itemSku,
      basePrice: 50,
      images: [{ url: 'https://example.com/shoes.jpg', isPrimary: true }],
      status: 'ACTIVE',
    });
    productId = product._id.toString();

    await InventoryModel.create({
      productId: product._id,
      sku: itemSku,
      availableStock: 10,
      reservedStock: 0,
    });
  });

  const validShipping = {
    fullName: 'Alice Smith',
    street: '123 Main St Apt 4B',
    city: 'Seattle',
    state: 'WA',
    postalCode: '98101',
    country: 'USA',
    phone: '+1-206-555-0199',
  };

  it('should orchestrate full checkout: cart -> stock reservation -> order draft -> payment intent', async () => {
    // 1. Customer A adds 2 units to cart ($100 total)
    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({
        productId,
        sku: itemSku,
        quantity: 2,
      });

    // 2. Customer A checks out
    const checkoutRes = await request(app)
      .post('/api/v1/orders/checkout')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({
        shippingAddress: validShipping,
        idempotencyKey: 'idemp-checkout-key-1',
      });

    expect(checkoutRes.status).toBe(201);
    expect(checkoutRes.body.success).toBe(true);

    const { order, paymentIntent } = checkoutRes.body.data;
    expect(order.orderNumber).toBeDefined();
    expect(order.status).toBe('PENDING_PAYMENT');
    expect(order.pricing.totalAmount).toBe(100);
    expect(order.items).toHaveLength(1);
    expect(order.items[0].title).toBe('Pro Running Shoes'); // Historical snapshot!
    expect(order.items[0].unitPrice).toBe(50);
    expect(order.items[0].quantity).toBe(2);

    expect(paymentIntent.transactionId).toBeDefined();
    expect(paymentIntent.clientSecret).toBeDefined();

    // 3. Verify Inventory was atomically reserved
    const inv = await InventoryModel.findOne({ sku: itemSku });
    expect(inv!.availableStock).toBe(8); // 10 - 2 = 8
    expect(inv!.reservedStock).toBe(2);

    // 4. Verify Customer cart was cleared
    const cartRes = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${customerAToken}`);
    expect(cartRes.body.data.items).toHaveLength(0);

    // 5. Payment Gateway Webhook arrives: Payment SUCCEEDED
    const webhookRes = await request(app)
      .post('/api/v1/payments/webhook')
      .send({
        orderId: order._id,
        transactionId: paymentIntent.transactionId,
        status: 'SUCCEEDED',
      });

    expect(webhookRes.status).toBe(200);

    // 6. Verify Order transitioned to PAID
    const paidOrder = await OrderModel.findById(order._id);
    expect(paidOrder!.status).toBe('PAID');

    // 7. Verify Inventory reservation was COMMITTED (deducted from reserved pool)
    const finalInv = await InventoryModel.findOne({ sku: itemSku });
    expect(finalInv!.availableStock).toBe(8);
    expect(finalInv!.reservedStock).toBe(0); // Deducted!

    // 8. Re-trigger webhook (Idempotency test)
    const duplicateWebhookRes = await request(app)
      .post('/api/v1/payments/webhook')
      .send({
        orderId: order._id,
        transactionId: paymentIntent.transactionId,
        status: 'SUCCEEDED',
      });
    expect(duplicateWebhookRes.status).toBe(200);

    // 9. Admin updates order status: PAID -> PROCESSING -> SHIPPED
    const shipRes = await request(app)
      .patch(`/api/v1/orders/${order._id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'PROCESSING',
      });
    expect(shipRes.status).toBe(200);
    expect(shipRes.body.data.order.status).toBe('PROCESSING');

    // 10. Object-Level Authorization: Customer B tries to view Customer A's order -> 403 Forbidden!
    const intruderRes = await request(app)
      .get(`/api/v1/orders/${order._id}`)
      .set('Authorization', `Bearer ${customerBToken}`);
    expect(intruderRes.status).toBe(403);
    expect(intruderRes.body.error.code).toBe('FORBIDDEN');

    // 11. Customer A views their own order -> 200 OK
    const ownerRes = await request(app)
      .get(`/api/v1/orders/${order._id}`)
      .set('Authorization', `Bearer ${customerAToken}`);
    expect(ownerRes.status).toBe(200);
    expect(ownerRes.body.data.order.orderNumber).toBe(order.orderNumber);
  });
});
