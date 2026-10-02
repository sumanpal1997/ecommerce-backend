import { z } from 'zod';

export const shippingAddressSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters'),
  street: z.string().trim().min(5, 'Street address must be at least 5 characters'),
  city: z.string().trim().min(2, 'City is required'),
  state: z.string().trim().min(2, 'State/Province is required'),
  postalCode: z.string().trim().min(2, 'Postal/Zip code is required'),
  country: z.string().trim().min(2, 'Country is required'),
  phone: z.string().trim().min(5, 'Valid phone number is required'),
});

export const checkoutSchema = z.object({
  shippingAddress: shippingAddressSchema,
  idempotencyKey: z.string().trim().optional(),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum([
    'PENDING_PAYMENT',
    'PAID',
    'PROCESSING',
    'SHIPPED',
    'DELIVERED',
    'CANCELLED',
    'REFUNDED',
  ]),
  trackingNumber: z.string().trim().optional(),
});

export type CheckoutSchemaInput = z.infer<typeof checkoutSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
