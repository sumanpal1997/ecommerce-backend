import { app } from './app';
import { config } from './config/env.config';
import { dbConnection } from '../infrastructure/database/mongoose.connection';
import http from 'http';

const startServer = async (): Promise<void> => {
  try {
    // 1. Establish Database Connection
    await dbConnection.connect();

    // 2. Start HTTP Server
    const server = http.createServer(app);

    server.listen(config.PORT, () => {
      console.log(`🚀 Server running in ${config.NODE_ENV} mode on port ${config.PORT}`);
      console.log(`📡 Health check available at: http://localhost:${config.PORT}/api/v1/health`);
    });

    // 3. Graceful Shutdown Handlers
    const shutdown = async (signal: string) => {
      console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

      server.close(async () => {
        console.log('HTTP server closed.');

        try {
          await dbConnection.disconnect();
          console.log('Database connections closed.');
          process.exit(0);
        } catch (err) {
          console.error('Error during graceful shutdown:', err);
          process.exit(1);
        }
      });

      // Force shutdown after 10 seconds if hanging
      setTimeout(() => {
        console.error('Forced shutdown after timeout.');
        process.exit(1);
      }, 10000).unref();
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
