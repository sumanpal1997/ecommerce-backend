import { Document, Types } from 'mongoose';

export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REFUNDED';

export interface IOrderItem {
  productId: Types.ObjectId;
  sku: string;
  title: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
  image: string;
}

export interface IShippingAddress {
  fullName: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
}

export interface IOrderPricing {
  subtotal: number;
  shippingFee: number;
  discountAmount: number;
  tax: number;
  totalAmount: number;
}

export interface IOrder {
  orderNumber: string;
  userId: Types.ObjectId;
  items: IOrderItem[];
  shippingAddress: IShippingAddress;
  pricing: IOrderPricing;
  status: OrderStatus;
  reservationId: string;
  trackingNumber?: string;
  idempotencyKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IOrderDoc extends IOrder, Document {
  _id: Types.ObjectId;
}

export interface CheckoutInput {
  shippingAddress: IShippingAddress;
  idempotencyKey?: string;
}
