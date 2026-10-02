import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/app-error';
import { sendError } from '../utils/api-response';
import { config } from '../config/env.config';

/**
 * Global Centralized Error Handling Middleware.
 * Catches all operational and unexpected errors, standardizes response format,
 * logs appropriately, and hides internal details in production.
 */
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void => {
  const requestId = req.id;

  // 1. Handle Known Operational Application Errors
  if (err instanceof AppError) {
    sendError(res, err.statusCode, err.code, err.message, err.details, requestId);
    return;
  }

  // 2. Handle MongoDB Duplicate Key Errors (E11000)
  if ('code' in err && (err as { code: number }).code === 11000) {
    const keyVal = (err as { keyValue?: Record<string, unknown> }).keyValue;
    const field = keyVal ? Object.keys(keyVal)[0] : 'field';
    const message = `A record with that ${field} already exists`;
    sendError(res, 409, 'CONFLICT', message, keyVal, requestId);
    return;
  }

  // 3. Handle JSON Web Token Errors
  if (err.name === 'JsonWebTokenError') {
    sendError(res, 401, 'INVALID_TOKEN', 'Authentication token is invalid', undefined, requestId);
    return;
  }

  if (err.name === 'TokenExpiredError') {
    sendError(res, 401, 'TOKEN_EXPIRED', 'Authentication token has expired', undefined, requestId);
    return;
  }

  // 4. Handle SyntaxError (Malformed JSON in request body)
  if (err instanceof SyntaxError && 'status' in err && (err as { status: number }).status === 400) {
    sendError(res, 400, 'MALFORMED_JSON', 'Malformed JSON in request body', undefined, requestId);
    return;
  }

  // 5. Unhandled / Unexpected Errors (Bugs, DB crashes, etc.)
  console.error(`[Unhandled Error] [ReqID: ${requestId}]:`, err);

  const message =
    config.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message || 'Internal Server Error';

  sendError(
    res,
    500,
    'INTERNAL_SERVER_ERROR',
    message,
    config.NODE_ENV === 'development' ? { stack: err.stack } : undefined,
    requestId,
  );
};
