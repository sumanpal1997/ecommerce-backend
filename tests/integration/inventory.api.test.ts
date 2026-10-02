import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app/app';
import { connectTestDB, clearTestDB, closeTestDB } from '../helpers/db.helper';
import { UserModel } from '../../src/modules/users/user.model';
import { tokenService } from '../../src/modules/auth/token.service';
import { InventoryModel, InventoryReservationModel } from '../../src/modules/inventory/inventory.model';
import { Types } from 'mongoose';

describe('Inventory API Integration Tests', () => {
  let adminAccessToken: string;
  let customerAccessToken: string;
  const testSku = 'TEST-ITEM-SKU';

  beforeAll(async () => {
    await connectTestDB();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();

    // 1. Create Admin
    const admin = await UserModel.create({
      email: 'admin@ecommerce.com',
      passwordHash: 'dummy_hash',
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
      isActive: true,
      refreshTokenVersion: 0,
    });
    adminAccessToken = tokenService.generateTokens(
      admin._id.toString(),
      admin.email,
      'ADMIN',
      0,
    ).accessToken;

    // 2. Create Customer
    const customer = await UserModel.create({
      email: 'customer@ecommerce.com',
      passwordHash: 'dummy_hash',
      firstName: 'Customer',
      lastName: 'User',
      role: 'CUSTOMER',
      isActive: true,
      refreshTokenVersion: 0,
    });
    customerAccessToken = tokenService.generateTokens(
      customer._id.toString(),
      customer.email,
      'CUSTOMER',
      0,
    ).accessToken;

    // 3. Initialize Inventory
    await InventoryModel.create({
      productId: new Types.ObjectId(),
      sku: testSku,
      availableStock: 50,
      reservedStock: 0,
      lowStockThreshold: 10,
    });
  });

  describe('GET /api/v1/inventory/:sku', () => {
    it('should return stock status for a valid SKU', async () => {
      const res = await request(app).get(`/api/v1/inventory/${testSku}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.inventory.sku).toBe(testSku);
      expect(res.body.data.inventory.availableStock).toBe(50);
      expect(res.body.data.inventory.reservedStock).toBe(0);
    });

    it('should return 404 for nonexistent SKU', async () => {
      const res = await request(app).get('/api/v1/inventory/NON-EXISTENT');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/inventory/adjust (Admin only)', () => {
    it('should allow ADMIN to restock inventory', async () => {
      const res = await request(app)
        .post('/api/v1/inventory/adjust')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          sku: testSku,
          quantityDelta: 25,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.inventory.availableStock).toBe(75);
    });

    it('should reject adjustment from non-ADMIN users with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/v1/inventory/adjust')
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send({
          sku: testSku,
          quantityDelta: 10,
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('Reservation Lifecycle (Reserve -> Release -> Commit)', () => {
    it('should successfully reserve and release inventory', async () => {
      const reservationId = 'res-lifecycle-1';

      // 1. Reserve 5 units
      const reserveRes = await request(app)
        .post('/api/v1/inventory/reserve')
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send({
          reservationId,
          items: [{ sku: testSku, quantity: 5 }],
          ttlMinutes: 15,
        });

      expect(reserveRes.status).toBe(200);
      expect(reserveRes.body.data.items[0].availableStockRemaining).toBe(45);

      // Verify DB state
      let inv = await InventoryModel.findOne({ sku: testSku });
      expect(inv!.availableStock).toBe(45);
      expect(inv!.reservedStock).toBe(5);

      // 2. Release reservation
      const releaseRes = await request(app)
        .post('/api/v1/inventory/release')
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send({ reservationId });

      expect(releaseRes.status).toBe(200);

      // Verify stock was restored
      inv = await InventoryModel.findOne({ sku: testSku });
      expect(inv!.availableStock).toBe(50);
      expect(inv!.reservedStock).toBe(0);
    });

    it('should successfully commit reservation on payment success', async () => {
      const reservationId = 'res-lifecycle-2';

      // 1. Reserve 10 units
      await request(app)
        .post('/api/v1/inventory/reserve')
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send({
          reservationId,
          items: [{ sku: testSku, quantity: 10 }],
        });

      // 2. Commit reservation (Admin / Payment Webhook)
      const commitRes = await request(app)
        .post('/api/v1/inventory/commit')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ reservationId });

      expect(commitRes.status).toBe(200);

      // Verify stock deduction: reservedStock decremented to 0, availableStock remains 40
      const inv = await InventoryModel.findOne({ sku: testSku });
      expect(inv!.availableStock).toBe(40);
      expect(inv!.reservedStock).toBe(0);
    });

    it('should sweep expired pending reservations', async () => {
      const pastDate = new Date(Date.now() - 30 * 60 * 1000); // 30 mins ago

      // Create an expired reservation directly in DB
      await InventoryReservationModel.create({
        reservationId: 'res-expired-1',
        items: [{ sku: testSku, quantity: 10 }],
        status: 'PENDING',
        expiresAt: pastDate,
      });

      // Adjust inventory as if 10 were reserved
      await InventoryModel.findOneAndUpdate(
        { sku: testSku },
        { $inc: { availableStock: -10, reservedStock: 10 } },
      );

      // Call sweep endpoint
      const sweepRes = await request(app)
        .post('/api/v1/inventory/sweep')
        .set('Authorization', `Bearer ${adminAccessToken}`);

      expect(sweepRes.status).toBe(200);
      expect(sweepRes.body.data.sweptCount).toBe(1);

      // Stock should be restored
      const inv = await InventoryModel.findOne({ sku: testSku });
      expect(inv!.availableStock).toBe(50);
      expect(inv!.reservedStock).toBe(0);
    });
  });
});
