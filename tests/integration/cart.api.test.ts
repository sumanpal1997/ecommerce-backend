import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app/app';
import { connectTestDB, clearTestDB, closeTestDB } from '../helpers/db.helper';
import { UserModel } from '../../src/modules/users/user.model';
import { tokenService } from '../../src/modules/auth/token.service';
import { CategoryModel } from '../../src/modules/catalog/category.model';
import { ProductModel } from '../../src/modules/catalog/product.model';
import { InventoryModel } from '../../src/modules/inventory/inventory.model';

describe('Cart Domain API Integration Tests', () => {
  let customerAccessToken: string;
  let customerUserId: string;
  let productAId: string;
  let productBId: string;
  const skuA = 'CART-PROD-A';
  const skuB = 'CART-PROD-B';
  const guestId = 'guest-session-uuid-999';

  beforeAll(async () => {
    await connectTestDB();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();

    // 1. Create User
    const customer = await UserModel.create({
      email: 'cartshopper@example.com',
      passwordHash: 'dummy_hash',
      firstName: 'Cart',
      lastName: 'Shopper',
      role: 'CUSTOMER',
      isActive: true,
      refreshTokenVersion: 0,
    });
    customerUserId = customer._id.toString();
    customerAccessToken = tokenService.generateTokens(
      customerUserId,
      customer.email,
      'CUSTOMER',
      0,
    ).accessToken;

    // 2. Create Category
    const category = await CategoryModel.create({
      name: 'Gear',
      slug: 'gear',
      path: '/gear',
      level: 0,
      isActive: true,
    });

    // 3. Create Product A ($40, stock: 50)
    const prodA = await ProductModel.create({
      title: 'Ergonomic Mouse',
      slug: 'ergonomic-mouse',
      description: 'Comfortable wireless mouse',
      brand: 'LogiTech',
      categoryId: category._id,
      sku: skuA,
      basePrice: 40,
      images: [{ url: 'https://example.com/mouse.jpg', isPrimary: true }],
      status: 'ACTIVE',
    });
    productAId = prodA._id.toString();
    await InventoryModel.create({
      productId: prodA._id,
      sku: skuA,
      availableStock: 50,
      reservedStock: 0,
    });

    // 4. Create Product B ($60, stock: 30)
    const prodB = await ProductModel.create({
      title: 'Mechanical Keyboard',
      slug: 'mechanical-keyboard',
      description: 'Tactile mechanical keyboard',
      brand: 'Keychron',
      categoryId: category._id,
      sku: skuB,
      basePrice: 60,
      images: [{ url: 'https://example.com/keyboard.jpg', isPrimary: true }],
      status: 'ACTIVE',
    });
    productBId = prodB._id.toString();
    await InventoryModel.create({
      productId: prodB._id,
      sku: skuB,
      availableStock: 30,
      reservedStock: 0,
    });
  });

  it('should support full guest cart workflow, price calculations, and cart merge upon login', async () => {
    // 1. Guest adds Product A (qty: 2) -> Subtotal = $80, Shipping = $10, Total = $90
    const addRes1 = await request(app)
      .post('/api/v1/cart/items')
      .set('X-Guest-Id', guestId)
      .send({
        productId: productAId,
        sku: skuA,
        quantity: 2,
      });

    expect(addRes1.status).toBe(200);
    expect(addRes1.body.data.items).toHaveLength(1);
    expect(addRes1.body.data.itemCount).toBe(2);
    expect(addRes1.body.data.subtotal).toBe(80);
    expect(addRes1.body.data.estimatedShipping).toBe(10);
    expect(addRes1.body.data.total).toBe(90);

    // 2. Guest adds Product B (qty: 1) -> Subtotal = $140, Shipping = $0 (Free shipping > $100), Total = $140
    const addRes2 = await request(app)
      .post('/api/v1/cart/items')
      .set('X-Guest-Id', guestId)
      .send({
        productId: productBId,
        sku: skuB,
        quantity: 1,
      });

    expect(addRes2.status).toBe(200);
    expect(addRes2.body.data.items).toHaveLength(2);
    expect(addRes2.body.data.itemCount).toBe(3);
    expect(addRes2.body.data.subtotal).toBe(140);
    expect(addRes2.body.data.estimatedShipping).toBe(0);
    expect(addRes2.body.data.total).toBe(140);

    // 3. Guest updates quantity of SKU-A to 1 -> Subtotal = $100, Shipping = $0, Total = $100
    const updateRes = await request(app)
      .patch('/api/v1/cart/items')
      .set('X-Guest-Id', guestId)
      .send({
        sku: skuA,
        quantity: 1,
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.subtotal).toBe(100);

    // 4. Customer logs in and merges guest cart into account
    const mergeRes = await request(app)
      .post('/api/v1/cart/merge')
      .set('Authorization', `Bearer ${customerAccessToken}`)
      .send({ guestId });

    expect(mergeRes.status).toBe(200);
    expect(mergeRes.body.data.items).toHaveLength(2);

    // 5. Customer fetches authenticated cart (without guest header)
    const getRes = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${customerAccessToken}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.data.items).toHaveLength(2);
    expect(getRes.body.data.items[0].title).toBeDefined(); // Populated metadata

    // 6. Customer removes SKU-B
    const removeRes = await request(app)
      .delete(`/api/v1/cart/items/${skuB}`)
      .set('Authorization', `Bearer ${customerAccessToken}`);

    expect(removeRes.status).toBe(200);
    expect(removeRes.body.data.items).toHaveLength(1);
    expect(removeRes.body.data.items[0].sku).toBe(skuA);

    // 7. Customer clears cart
    const clearRes = await request(app)
      .delete('/api/v1/cart')
      .set('Authorization', `Bearer ${customerAccessToken}`);

    expect(clearRes.status).toBe(200);
    expect(clearRes.body.data.items).toHaveLength(0);
    expect(clearRes.body.data.total).toBe(0);
  });
});
