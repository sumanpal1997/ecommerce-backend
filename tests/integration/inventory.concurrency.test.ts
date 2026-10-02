import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app/app';
import { connectTestDB, clearTestDB, closeTestDB } from '../helpers/db.helper';
import { UserModel } from '../../src/modules/users/user.model';
import { tokenService } from '../../src/modules/auth/token.service';
import { InventoryModel } from '../../src/modules/inventory/inventory.model';
import { Types } from 'mongoose';

describe('Inventory Concurrency & Race Condition Defense (Flash Sale Stress Test)', () => {
  let customerAccessToken: string;
  const flashSaleSku = 'FLASH-SALE-SKU';

  beforeAll(async () => {
    await connectTestDB();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();

    // 1. Create Customer & Token
    const customer = await UserModel.create({
      email: 'shopper@example.com',
      passwordHash: 'dummy_hash',
      firstName: 'Fast',
      lastName: 'Shopper',
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

    // 2. Initialize inventory with only 3 physical units in stock
    await InventoryModel.create({
      productId: new Types.ObjectId(),
      sku: flashSaleSku,
      availableStock: 3,
      reservedStock: 0,
      lowStockThreshold: 1,
    });
  });

  it('should prevent overselling when 20 concurrent requests race for the final 3 units', async () => {
    const totalConcurrentRequests = 20;

    // Generate 20 simultaneous reservation requests
    const reservationPromises = Array.from({ length: totalConcurrentRequests }).map((_, index) => {
      const reservationId = `res-race-${index + 1}`;

      return request(app)
        .post('/api/v1/inventory/reserve')
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send({
          reservationId,
          items: [{ sku: flashSaleSku, quantity: 1 }],
          ttlMinutes: 15,
        });
    });

    // Fire all 20 requests at the exact same millisecond!
    const responses = await Promise.all(reservationPromises);

    // Filter results by HTTP Status
    const successfulReservations = responses.filter((res) => res.status === 200);
    const failedReservations = responses.filter((res) => res.status === 409);

    // 1. Verify exactly 3 requests succeeded
    expect(successfulReservations).toHaveLength(3);

    // 2. Verify exactly 17 requests failed with 409 CONFLICT
    expect(failedReservations).toHaveLength(17);
    for (const failRes of failedReservations) {
      expect(failRes.body.success).toBe(false);
      expect(failRes.body.error.code).toBe('CONFLICT');
    }

    // 3. Verify Database Integrity: zero overselling!
    const finalInventory = await InventoryModel.findOne({ sku: flashSaleSku });
    expect(finalInventory).toBeDefined();
    expect(finalInventory!.availableStock).toBe(0);
    expect(finalInventory!.reservedStock).toBe(3);

    // 4. Invariant check: total physical stock (available + reserved) is conserved
    expect(finalInventory!.availableStock + finalInventory!.reservedStock).toBe(3);
  });
});
