import { z } from 'zod';

export const addItemSchema = z.object({
  productId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid Product ID format'),
  sku: z.string().trim().min(3).toUpperCase(),
  quantity: z
    .number()
    .int('Quantity must be an integer')
    .positive('Quantity must be at least 1')
    .max(50, 'Cannot add more than 50 units of a single item at once')
    .default(1),
});

export const updateQuantitySchema = z.object({
  sku: z.string().trim().min(3).toUpperCase(),
  quantity: z
    .number()
    .int('Quantity must be an integer')
    .min(0, 'Quantity cannot be negative'),
});

export const removeItemSchema = z.object({
  sku: z.string().trim().min(3).toUpperCase(),
});

export const mergeCartSchema = z.object({
  guestId: z.string().trim().min(1, 'Guest ID is required'),
});

export type AddItemInput = z.infer<typeof addItemSchema>;
export type UpdateQuantityInput = z.infer<typeof updateQuantitySchema>;
export type RemoveItemInput = z.infer<typeof removeItemSchema>;
export type MergeCartInput = z.infer<typeof mergeCartSchema>;
