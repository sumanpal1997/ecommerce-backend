import { Schema, model } from 'mongoose';
import { IInventoryDoc, IInventoryReservationDoc } from './inventory.types';

const inventorySchema = new Schema<IInventoryDoc>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      unique: true,
      index: true,
    },
    sku: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    availableStock: {
      type: Number,
      required: true,
      min: [0, 'Available stock cannot be negative'],
      default: 0,
    },
    reservedStock: {
      type: Number,
      required: true,
      min: [0, 'Reserved stock cannot be negative'],
      default: 0,
    },
    lowStockThreshold: {
      type: Number,
      default: 5,
      min: 0,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret: Record<string, unknown>) {
        delete ret.__v;
        return ret;
      },
    },
  },
);

// Virtual property for physical total warehouse stock
inventorySchema.virtual('totalStock').get(function (this: IInventoryDoc) {
  return this.availableStock + this.reservedStock;
});

const reservationSchema = new Schema<IInventoryReservationDoc>(
  {
    reservationId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    orderId: {
      type: String,
      index: true,
    },
    items: [
      {
        sku: { type: String, required: true, uppercase: true },
        quantity: { type: Number, required: true, min: 1 },
      },
    ],
    status: {
      type: String,
      enum: ['PENDING', 'COMMITTED', 'RELEASED'],
      default: 'PENDING',
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        delete ret.__v;
        return ret;
      },
    },
  },
);

// Compound index for finding pending expired reservations to sweep
reservationSchema.index({ status: 1, expiresAt: 1 });

export const InventoryModel = model<IInventoryDoc>('Inventory', inventorySchema);
export const InventoryReservationModel = model<IInventoryReservationDoc>(
  'InventoryReservation',
  reservationSchema,
);
