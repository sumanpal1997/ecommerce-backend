import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

// Extend Express Request interface to include `id` and `user`
declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

/**
 * Middleware that assigns or forwards an X-Request-Id for distributed tracing.
 */
export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const existingId = req.header('X-Request-Id');
  const requestId = existingId || randomUUID();

  req.id = requestId;
  res.setHeader('X-Request-Id', requestId);

  next();
};
