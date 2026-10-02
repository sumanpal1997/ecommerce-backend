import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from '../../src/modules/auth/auth.service';
import { UserRepository } from '../../src/modules/users/user.repository';
import { TokenService } from '../../src/modules/auth/token.service';
import { PasswordUtil } from '../../src/modules/auth/utils/password.util';
import { ConflictError, UnauthorizedError } from '../../src/app/errors/app-error';
import { Types } from 'mongoose';
import { IUserDoc } from '../../src/modules/users/user.types';

describe('AuthService', () => {
  let authService: AuthService;
  let mockUserRepo: UserRepository;
  let mockTokenService: TokenService;

  const sampleUserId = new Types.ObjectId().toString();
  const sampleUser = {
    _id: new Types.ObjectId(sampleUserId),
    email: 'john@example.com',
    passwordHash: 'hashed_password_val',
    firstName: 'John',
    lastName: 'Doe',
    role: 'CUSTOMER',
    isActive: true,
    refreshTokenVersion: 0,
    addresses: [],
  } as unknown as IUserDoc;

  const sampleTokens = {
    accessToken: 'mock_access_token',
    refreshToken: 'mock_refresh_token',
  };

  beforeEach(() => {
    mockUserRepo = {
      findByEmail: vi.fn(),
      findByEmailWithPassword: vi.fn(),
      findById: vi.fn(),
      findByIdWithTokenVersion: vi.fn(),
      create: vi.fn(),
      incrementRefreshTokenVersion: vi.fn(),
    } as unknown as UserRepository;

    mockTokenService = {
      generateTokens: vi.fn().mockReturnValue(sampleTokens),
      verifyAccessToken: vi.fn(),
      verifyRefreshToken: vi.fn(),
      setRefreshTokenCookie: vi.fn(),
      clearRefreshTokenCookie: vi.fn(),
    } as unknown as TokenService;

    authService = new AuthService(mockUserRepo, mockTokenService);
  });

  describe('register', () => {
    it('should successfully register a new customer', async () => {
      vi.spyOn(mockUserRepo, 'findByEmail').mockResolvedValue(null);
      vi.spyOn(PasswordUtil, 'hash').mockResolvedValue('argon2_hashed_secret');
      vi.spyOn(mockUserRepo, 'create').mockResolvedValue(sampleUser);

      const result = await authService.register({
        email: 'john@example.com',
        password: 'Password123!',
        firstName: 'John',
        lastName: 'Doe',
      });

      expect(mockUserRepo.findByEmail).toHaveBeenCalledWith('john@example.com');
      expect(mockUserRepo.create).toHaveBeenCalled();
      expect(result.tokens).toEqual(sampleTokens);
      expect(result.user).toEqual(sampleUser);
    });

    it('should throw ConflictError if user email already exists', async () => {
      vi.spyOn(mockUserRepo, 'findByEmail').mockResolvedValue(sampleUser);

      await expect(
        authService.register({
          email: 'john@example.com',
          password: 'Password123!',
          firstName: 'John',
          lastName: 'Doe',
        }),
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('login', () => {
    it('should authenticate user and return tokens when credentials match', async () => {
      vi.spyOn(mockUserRepo, 'findByEmailWithPassword').mockResolvedValue(sampleUser);
      vi.spyOn(PasswordUtil, 'verify').mockResolvedValue(true);

      const result = await authService.login({
        email: 'john@example.com',
        password: 'Password123!',
      });

      expect(result.tokens).toEqual(sampleTokens);
      expect(result.user).toEqual(sampleUser);
    });

    it('should throw UnauthorizedError when user is not found', async () => {
      vi.spyOn(mockUserRepo, 'findByEmailWithPassword').mockResolvedValue(null);

      await expect(
        authService.login({
          email: 'notfound@example.com',
          password: 'Password123!',
        }),
      ).rejects.toThrow(UnauthorizedError);
    });

    it('should throw UnauthorizedError when password does not match', async () => {
      vi.spyOn(mockUserRepo, 'findByEmailWithPassword').mockResolvedValue(sampleUser);
      vi.spyOn(PasswordUtil, 'verify').mockResolvedValue(false);

      await expect(
        authService.login({
          email: 'john@example.com',
          password: 'WrongPassword!',
        }),
      ).rejects.toThrow(UnauthorizedError);
    });

    it('should throw UnauthorizedError when user account is inactive', async () => {
      const inactiveUser = { ...sampleUser, isActive: false } as unknown as IUserDoc;
      vi.spyOn(mockUserRepo, 'findByEmailWithPassword').mockResolvedValue(inactiveUser);

      await expect(
        authService.login({
          email: 'john@example.com',
          password: 'Password123!',
        }),
      ).rejects.toThrow(UnauthorizedError);
    });
  });

  describe('refreshTokens (Token Reuse Detection)', () => {
    it('should refresh tokens when refresh token version matches user version', async () => {
      vi.spyOn(mockTokenService, 'verifyRefreshToken').mockReturnValue({
        sub: sampleUserId,
        tokenVersion: 0,
      });
      vi.spyOn(mockUserRepo, 'findByIdWithTokenVersion').mockResolvedValue(sampleUser);

      const result = await authService.refreshTokens('valid_raw_token');
      expect(result.tokens).toEqual(sampleTokens);
    });

    it('should trigger family invalidation when token version is mismatched (replay attack)', async () => {
      // Attacker submits older token version 0, but user is currently on version 1
      vi.spyOn(mockTokenService, 'verifyRefreshToken').mockReturnValue({
        sub: sampleUserId,
        tokenVersion: 0,
      });
      const updatedUser = { ...sampleUser, refreshTokenVersion: 1 } as unknown as IUserDoc;
      vi.spyOn(mockUserRepo, 'findByIdWithTokenVersion').mockResolvedValue(updatedUser);

      await expect(authService.refreshTokens('stolen_raw_token')).rejects.toThrow(
        UnauthorizedError,
      );

      // Verify that revocation was triggered on the user account
      expect(mockUserRepo.incrementRefreshTokenVersion).toHaveBeenCalledWith(
        updatedUser._id.toString(),
      );
    });
  });
});
