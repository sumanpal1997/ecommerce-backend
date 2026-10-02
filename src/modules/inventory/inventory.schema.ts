import { z } from 'zod';

export const adjustStockSchema = z.object({
  sku: z.string().trim().min(3).toUpperCase(),
  quantityDelta: z
    .number()
    .int('Quantity delta must be an integer')
    .refine((val) => val !== 0, 'Quantity delta cannot be zero'),
});

export const reserveStockSchema = z.object({
  reservationId: z.string().trim().min(1, 'Reservation ID is required'),
  orderId: z.string().trim().optional(),
  items: z
    .array(
      z.object({
        sku: z.string().trim().min(3).toUpperCase(),
        quantity: z.number().int().positive('Quantity must be at least 1'),
      }),
    )
    .min(1, 'At least one item must be reserved'),
  ttlMinutes: z.number().int().positive().max(60).optional().default(15),
});

export const reservationActionSchema = z.object({
  reservationId: z.string().trim().min(1, 'Reservation ID is required'),
});

export type AdjustStockInput = z.infer<typeof adjustStockSchema>;
export type ReserveStockInput = z.infer<typeof reserveStockSchema>;
export type ReservationActionInput = z.infer<typeof reservationActionSchema>;
