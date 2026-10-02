import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app/app';
import { connectTestDB, clearTestDB, closeTestDB } from '../helpers/db.helper';
import { UserModel } from '../../src/modules/users/user.model';
import { tokenService } from '../../src/modules/auth/token.service';

describe('Catalog (Categories & Products) Integration Tests', () => {
  let adminAccessToken: string;
  let customerAccessToken: string;

  beforeAll(async () => {
    await connectTestDB();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();

    // 1. Create Admin User & Token
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

    // 2. Create Regular Customer & Token
    const customer = await UserModel.create({
      email: 'customer@ecommerce.com',
      passwordHash: 'dummy_hash',
      firstName: 'Regular',
      lastName: 'Customer',
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
  });

  describe('Category Endpoints', () => {
    it('should allow ADMIN to create categories and build a tree hierarchy', async () => {
      // 1. Create Root Category: Electronics
      const rootRes = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          name: 'Electronics',
          description: 'Electronic devices and gadgets',
        });

      expect(rootRes.status).toBe(201);
      expect(rootRes.body.data.category.slug).toBe('electronics');
      expect(rootRes.body.data.category.path).toBe('/electronics');
      expect(rootRes.body.data.category.level).toBe(0);

      const rootId = rootRes.body.data.category._id;

      // 2. Create Subcategory: Audio
      const subRes = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          name: 'Audio',
          parentId: rootId,
        });

      expect(subRes.status).toBe(201);
      expect(subRes.body.data.category.path).toBe('/electronics/audio');
      expect(subRes.body.data.category.level).toBe(1);

      // 3. Fetch Tree (Public)
      const treeRes = await request(app).get('/api/v1/categories');
      expect(treeRes.status).toBe(200);
      expect(treeRes.body.data.tree).toHaveLength(1);
      expect(treeRes.body.data.tree[0].name).toBe('Electronics');
      expect(treeRes.body.data.tree[0].children).toHaveLength(1);
      expect(treeRes.body.data.tree[0].children[0].name).toBe('Audio');

      // 4. Fetch Breadcrumbs
      const breadcrumbRes = await request(app).get(
        `/api/v1/categories/${subRes.body.data.category._id}/breadcrumbs`,
      );
      expect(breadcrumbRes.status).toBe(200);
      expect(breadcrumbRes.body.data.breadcrumbs).toHaveLength(2);
      expect(breadcrumbRes.body.data.breadcrumbs[0].name).toBe('Electronics');
      expect(breadcrumbRes.body.data.breadcrumbs[1].name).toBe('Audio');
    });

    it('should reject category creation from non-ADMIN users with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send({
          name: 'Illegal Category',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('Product Endpoints', () => {
    let categoryId: string;

    beforeEach(async () => {
      const catRes = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ name: 'Laptops' });
      categoryId = catRes.body.data.category._id;
    });

    const sampleProduct = {
      title: 'MacBook Pro 16 M3',
      description: 'Supercharged for pros with M3 Max chip',
      brand: 'Apple',
      sku: 'MBP-16-M3',
      basePrice: 2499.99,
      images: [{ url: 'https://example.com/macbook.jpg', isPrimary: true }],
      attributes: { color: 'Space Black', memory: '36GB' },
    };

    it('should allow ADMIN to create a product and index it for autocomplete', async () => {
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          ...sampleProduct,
          categoryId,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.product.title).toBe(sampleProduct.title);
      expect(res.body.data.product.slug).toBe('macbook-pro-16-m3');
      expect(res.body.data.product.sku).toBe('MBP-16-M3');

      // Test instant Trie autocomplete
      const autoRes = await request(app).get('/api/v1/products/autocomplete?q=mac');
      expect(autoRes.status).toBe(200);
      expect(autoRes.body.data.suggestions).toHaveLength(1);
      expect(autoRes.body.data.suggestions[0].term).toBe(sampleProduct.title);
    });

    it('should reject duplicate SKU with 409 Conflict', async () => {
      await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ ...sampleProduct, categoryId });

      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          ...sampleProduct,
          title: 'Different Title MacBook',
          categoryId,
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('should support Offset Pagination and filtering by price and brand', async () => {
      // Create 3 products
      await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ ...sampleProduct, title: 'Laptop A', sku: 'LAP-A', basePrice: 1000, categoryId });

      await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ ...sampleProduct, title: 'Laptop B', sku: 'LAP-B', basePrice: 2000, categoryId });

      await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ ...sampleProduct, title: 'Laptop C', sku: 'LAP-C', basePrice: 3000, categoryId });

      // Query with limit=2, price filter minPrice=1500
      const listRes = await request(app).get('/api/v1/products?minPrice=1500&limit=2');

      expect(listRes.status).toBe(200);
      expect(listRes.body.data).toHaveLength(2);
      expect(listRes.body.meta.totalItems).toBe(2);
      expect(listRes.body.meta.limit).toBe(2);
    });

    it('should support Cursor Pagination for infinite scrolling', async () => {
      await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ ...sampleProduct, title: 'Phone 1', sku: 'SKU-P1', categoryId });

      await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ ...sampleProduct, title: 'Phone 2', sku: 'SKU-P2', categoryId });

      const page1 = await request(app).get('/api/v1/products?limit=1&cursor=');
      expect(page1.status).toBe(200);

      // In cursor mode, payload has { items, nextCursor, hasMore }
      expect(page1.body.data.items).toHaveLength(1);
      expect(page1.body.data.hasMore).toBe(true);
      expect(page1.body.data.nextCursor).toBeDefined();

      const page2 = await request(app).get(
        `/api/v1/products?limit=1&cursor=${page1.body.data.nextCursor}`,
      );
      expect(page2.status).toBe(200);
      expect(page2.body.data.items).toHaveLength(1);
      expect(page2.body.data.hasMore).toBe(false);
    });

    it('should fetch product by slug', async () => {
      await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ ...sampleProduct, categoryId });

      const res = await request(app).get('/api/v1/products/slug/macbook-pro-16-m3');
      expect(res.status).toBe(200);
      expect(res.body.data.product.title).toBe(sampleProduct.title);
      expect(res.body.data.product.categoryId.name).toBe('Laptops'); // Populated!
    });
  });
});
