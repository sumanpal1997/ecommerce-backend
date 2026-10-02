import jwt, { SignOptions } from 'jsonwebtoken';
import { Response } from 'express';
import { config } from '../../app/config/env.config';
import {
  AuthTokens,
  JwtAccessTokenPayload,
  JwtRefreshTokenPayload,
} from './auth.types';

export const REFRESH_COOKIE_NAME = 'jid';

export class TokenService {
  /**
   * Generates both Access and Refresh tokens.
   */
  public generateTokens(
    userId: string,
    email: string,
    role: 'CUSTOMER' | 'ADMIN',
    tokenVersion: number,
  ): AuthTokens {
    const accessPayload: JwtAccessTokenPayload = {
      sub: userId,
      email,
      role,
    };

    const refreshPayload: JwtRefreshTokenPayload = {
      sub: userId,
      tokenVersion,
    };

    const accessOptions: SignOptions = {
      expiresIn: config.JWT_ACCESS_EXPIRES_IN as SignOptions['expiresIn'],
    };

    const refreshOptions: SignOptions = {
      expiresIn: config.JWT_REFRESH_EXPIRES_IN as SignOptions['expiresIn'],
    };

    const accessToken = jwt.sign(accessPayload, config.JWT_ACCESS_SECRET, accessOptions);
    const refreshToken = jwt.sign(refreshPayload, config.JWT_REFRESH_SECRET, refreshOptions);

    return { accessToken, refreshToken };
  }

  /**
   * Verifies an access token and returns its decoded payload.
   */
  public verifyAccessToken(token: string): JwtAccessTokenPayload {
    return jwt.verify(token, config.JWT_ACCESS_SECRET) as JwtAccessTokenPayload;
  }

  /**
   * Verifies a refresh token and returns its decoded payload.
   */
  public verifyRefreshToken(token: string): JwtRefreshTokenPayload {
    return jwt.verify(token, config.JWT_REFRESH_SECRET) as JwtRefreshTokenPayload;
  }

  /**
   * Sets the refresh token inside an HttpOnly, Secure cookie.
   * This protects against Cross-Site Scripting (XSS) attacks.
   */
  public setRefreshTokenCookie(res: Response, token: string): void {
    const isProduction = config.NODE_ENV === 'production';
    const maxAgeMs = 7 * 24 * 60 * 60 * 1000; // 7 days

    res.cookie(REFRESH_COOKIE_NAME, token, {
      httpOnly: true, // Inaccessible to JavaScript document.cookie
      secure: isProduction, // Only sent over HTTPS in production
      sameSite: isProduction ? 'strict' : 'lax', // CSRF protection
      path: '/api/v1/auth', // Scoped exclusively to auth routes to prevent leakage
      maxAge: maxAgeMs,
    });
  }

  /**
   * Clears the refresh token cookie upon logout.
   */
  public clearRefreshTokenCookie(res: Response): void {
    const isProduction = config.NODE_ENV === 'production';

    res.clearCookie(REFRESH_COOKIE_NAME, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      path: '/api/v1/auth',
    });
  }
}

export const tokenService = new TokenService();
