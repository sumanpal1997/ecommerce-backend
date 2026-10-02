import { describe, it, expect } from 'vitest';
import { tokenService } from '../../src/modules/auth/token.service';

describe('TokenService (JWT)', () => {
  const mockUser = {
    id: '64b1f2a3c4d5e6f7a8b9c0d1',
    email: 'alex@example.com',
    role: 'CUSTOMER' as const,
    tokenVersion: 1,
  };

  it('should generate valid access and refresh token pair', () => {
    const tokens = tokenService.generateTokens(
      mockUser.id,
      mockUser.email,
      mockUser.role,
      mockUser.tokenVersion,
    );

    expect(tokens.accessToken).toBeTypeOf('string');
    expect(tokens.refreshToken).toBeTypeOf('string');
    expect(tokens.accessToken.split('.')).toHaveLength(3); // Header.Payload.Signature
    expect(tokens.refreshToken.split('.')).toHaveLength(3);
  });

  it('should decode and verify valid access token payload correctly', () => {
    const tokens = tokenService.generateTokens(
      mockUser.id,
      mockUser.email,
      mockUser.role,
      mockUser.tokenVersion,
    );

    const payload = tokenService.verifyAccessToken(tokens.accessToken);
    expect(payload.sub).toBe(mockUser.id);
    expect(payload.email).toBe(mockUser.email);
    expect(payload.role).toBe(mockUser.role);
  });

  it('should decode and verify valid refresh token payload correctly', () => {
    const tokens = tokenService.generateTokens(
      mockUser.id,
      mockUser.email,
      mockUser.role,
      mockUser.tokenVersion,
    );

    const payload = tokenService.verifyRefreshToken(tokens.refreshToken);
    expect(payload.sub).toBe(mockUser.id);
    expect(payload.tokenVersion).toBe(mockUser.tokenVersion);
  });

  it('should throw an error when verifying a tampered token', () => {
    const tokens = tokenService.generateTokens(
      mockUser.id,
      mockUser.email,
      mockUser.role,
      mockUser.tokenVersion,
    );

    const tampered = tokens.accessToken.slice(0, -6) + 'abcdef';
    expect(() => tokenService.verifyAccessToken(tampered)).toThrow();
  });
});
