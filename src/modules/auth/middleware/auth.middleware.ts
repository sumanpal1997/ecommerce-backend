import { Request, Response, NextFunction } from 'express';
import { tokenService } from '../token.service';
import { UnauthorizedError, ForbiddenError } from '../../../app/errors/app-error';
import { UserRole } from '../../users/user.types';

/**
 * Middleware that validates the JWT Access Token in the Authorization header.
 * Populates `req.user` with { id, email, role }.
 * Completely stateless: 0 database queries for maximum performance!
 */
export const authenticate = (req: Request, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Authentication token missing or malformed');
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    throw new UnauthorizedError('Authentication token missing');
  }

  try {
    const payload = tokenService.verifyAccessToken(token);

    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };

    next();
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'TokenExpiredError') {
      throw new UnauthorizedError('Authentication token has expired');
    }
    throw new UnauthorizedError('Invalid authentication token');
  }
};

/**
 * Role-Based Access Control (RBAC) guard middleware.
 * Ensures the authenticated user possesses at least one of the allowed roles.
 */
export const authorize = (...allowedRoles: UserRole[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new ForbiddenError('You do not have permission to access this resource');
    }

    next();
  };
};
