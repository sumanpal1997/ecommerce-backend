import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app/app';
import { connectTestDB, clearTestDB, closeTestDB } from '../helpers/db.helper';

describe('Auth & Core API Integration Tests', () => {
  beforeAll(async () => {
    await connectTestDB();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  const validCustomer = {
    email: 'customer@example.com',
    password: 'SecurePassword123!',
    firstName: 'Sarah',
    lastName: 'Connor',
  };

  describe('GET /api/v1/health', () => {
    it('should return 200 OK with health status', async () => {
      const res = await request(app).get('/api/v1/health');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('UP');
      expect(res.headers['x-request-id']).toBeDefined();
    });
  });

  describe('404 Unknown Routes', () => {
    it('should return 404 with standardized error envelope for unknown routes', async () => {
      const res = await request(app).get('/api/v1/does-not-exist');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('POST /api/v1/auth/register', () => {
    it('should successfully register a customer and return an access token with an HttpOnly cookie', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(validCustomer);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.user.email).toBe(validCustomer.email);
      expect(res.body.data.user.role).toBe('CUSTOMER');
      expect(res.body.data.user.passwordHash).toBeUndefined(); // Verify password hash is never leaked!

      // Verify HttpOnly cookie header
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const cookieStr = Array.isArray(cookies) ? cookies.join(';') : cookies;
      expect(cookieStr).toContain('jid=');
      expect(cookieStr.toLowerCase()).toContain('httponly');
    });

    it('should reject registration if email is invalid', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          ...validCustomer,
          email: 'invalid-email-address',
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details).toBeInstanceOf(Array);
    });

    it('should reject registration if password is weak', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          ...validCustomer,
          password: 'weak',
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject registration with 409 Conflict if email is already taken', async () => {
      await request(app).post('/api/v1/auth/register').send(validCustomer);

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(validCustomer);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      await request(app).post('/api/v1/auth/register').send(validCustomer);
    });

    it('should successfully log in with valid credentials and return access token + cookie', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: validCustomer.email,
          password: validCustomer.password,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.user.email).toBe(validCustomer.email);

      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
    });

    it('should reject login with 401 when password is wrong', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: validCustomer.email,
          password: 'IncorrectPassword1!',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject login with 401 when email does not exist', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'unknown@example.com',
          password: 'Password123!',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('GET /api/v1/auth/me (Protected Route)', () => {
    it('should return user profile when valid Bearer token is provided', async () => {
      const registerRes = await request(app)
        .post('/api/v1/auth/register')
        .send(validCustomer);
      const accessToken = registerRes.body.data.accessToken;

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(validCustomer.email);
    });

    it('should return 401 when no token is supplied', async () => {
      const res = await request(app).get('/api/v1/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 401 when token is invalid or corrupted', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid.token.payload');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/refresh & logout', () => {
    it('should refresh tokens when refresh cookie is sent', async () => {
      const registerRes = await request(app)
        .post('/api/v1/auth/register')
        .send(validCustomer);

      const rawCookie = registerRes.headers['set-cookie'];

      const refreshRes = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', rawCookie);

      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.success).toBe(true);
      expect(refreshRes.body.data.accessToken).toBeDefined();
    });

    it('should clear refresh cookie on logout', async () => {
      const res = await request(app).post('/api/v1/auth/logout');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const cookies = res.headers['set-cookie'];
      if (cookies) {
        const cookieStr = Array.isArray(cookies) ? cookies.join(';') : cookies;
        expect(cookieStr).toContain('jid=;'); // Cookie cleared
      }
    });
  });
});
