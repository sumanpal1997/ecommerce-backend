import { UserRole } from '../users/user.types';

export interface JwtAccessTokenPayload {
  sub: string;        // User ID
  email: string;
  role: UserRole;
}

export interface JwtRefreshTokenPayload {
  sub: string;        // User ID
  tokenVersion: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthenticatedUserPayload {
  id: string;
  email: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUserPayload;
    }
  }
}
