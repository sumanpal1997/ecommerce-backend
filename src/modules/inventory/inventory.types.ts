import { Document, Types } from 'mongoose';

export interface IInventory {
  productId: Types.ObjectId;
  sku: string;
  availableStock: number;
  reservedStock: number;
  lowStockThreshold: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IInventoryDoc extends IInventory, Document {
  _id: Types.ObjectId;
}

export type ReservationStatus = 'PENDING' | 'COMMITTED' | 'RELEASED';

export interface IReservationItem {
  sku: string;
  quantity: number;
}

export interface IInventoryReservation {
  reservationId: string;
  orderId?: string;
  items: IReservationItem[];
  status: ReservationStatus;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IInventoryReservationDoc extends IInventoryReservation, Document {
  _id: Types.ObjectId;
}

export interface StockReservationRequest {
  reservationId: string;
  orderId?: string;
  items: {
    sku: string;
    quantity: number;
  }[];
  ttlMinutes?: number;
}

export interface StockReservationResult {
  success: boolean;
  reservationId: string;
  expiresAt: Date;
  items: {
    sku: string;
    quantity: number;
    availableStockRemaining: number;
  }[];
}
