import { Document, Types } from 'mongoose';

export interface ICartItem {
  productId: Types.ObjectId;
  sku: string;
  quantity: number;
  priceSnapshot: number; // Stored price snapshot from last cart update
}

export interface ICart {
  userId?: Types.ObjectId | null;
  guestId?: string | null;
  items: ICartItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ICartDoc extends ICart, Document {
  _id: Types.ObjectId;
}

export interface EnrichedCartItem {
  productId: string;
  sku: string;
  title: string;
  slug: string;
  image: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
  isAvailable: boolean;
  availableStock: number;
}

export interface CartSummary {
  items: EnrichedCartItem[];
  itemCount: number;
  subtotal: number;
  estimatedShipping: number;
  total: number;
  hasUnavailableItems: boolean;
}
