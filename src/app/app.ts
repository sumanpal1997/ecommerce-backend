import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from './config/env.config';
import { requestIdMiddleware } from './middleware/request-id.middleware';
import { errorHandler } from './middleware/error.middleware';
import v1Routes from './routes/v1.routes';
import { NotFoundError } from './errors/app-error';

const createApp = (): Application => {
  const app: Application = express();

  // 1. Security Headers
  app.use(helmet());

  // 2. Cross-Origin Resource Sharing (CORS)
  app.use(
    cors({
      origin: [config.CLIENT_URL, 'http://localhost:3000', 'http://127.0.0.1:3000'],
      credentials: true, // Crucial for receiving and setting HttpOnly cookies cross-origin
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Request-Id',
        'X-Guest-Id',
        'x-guest-id',
        'stripe-signature',
        'x-signature',
      ],
    }),
  );

  // 3. Request Parsing Middlewares
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  // 4. Observability / Tracing
  app.use(requestIdMiddleware);

  // 5. Root Welcome & API Routes
  app.get('/', (_req: Request, res: Response) => {
    res.status(200).json({
      name: 'ShopFlow Studio Enterprise API',
      status: 'ONLINE',
      version: '1.0.0',
      health: '/api/v1/health',
      catalog: '/api/v1/products',
    });
  });

  app.use('/api/v1', v1Routes);

  // 6. 404 Handler for Unmatched Routes
  app.use((req: Request, _res: Response, next: NextFunction) => {
    next(new NotFoundError(`Endpoint '${req.method} ${req.originalUrl}' does not exist on this server`));
  });

  // 7. Centralized Global Error Handler
  app.use(errorHandler);

  return app;
};

export const app = createApp();
