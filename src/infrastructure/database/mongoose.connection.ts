import mongoose from 'mongoose';
import { config } from '../../app/config/env.config';

/**
 * Manages the MongoDB connection lifecycle using Mongoose.
 * Implements connection pooling, event listeners, and graceful shutdown.
 */
export class DatabaseConnection {
  private static instance: DatabaseConnection;
  private isConnected = false;

  private constructor() {
    this.setupListeners();
  }

  public static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  private setupListeners(): void {
    mongoose.connection.on('connected', () => {
      this.isConnected = true;
      console.log('✅ MongoDB connected successfully.');
    });

    mongoose.connection.on('error', (err) => {
      this.isConnected = false;
      console.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      this.isConnected = false;
      console.warn('⚠️ MongoDB connection disconnected.');
    });
  }

  public async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      await mongoose.connect(config.MONGO_URI, {
        maxPoolSize: 20, // Maintain up to 20 socket connections for concurrency
        minPoolSize: 5,  // Maintain a minimum of 5 warm socket connections
        serverSelectionTimeoutMS: 5000, // Timeout fast if cluster is unreachable
        socketTimeoutMS: 45000,
      });
    } catch (error) {
      console.error('❌ Failed to establish initial MongoDB connection:', error);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      await mongoose.disconnect();
      this.isConnected = false;
      console.log('MongoDB connection closed.');
    } catch (error) {
      console.error('Error during MongoDB disconnection:', error);
      throw error;
    }
  }
}

export const dbConnection = DatabaseConnection.getInstance();
